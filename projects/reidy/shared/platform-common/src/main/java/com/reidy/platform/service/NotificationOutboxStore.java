package com.reidy.platform.service;

import com.reidy.platform.entity.NotificationOutbox.Status;
import com.reidy.platform.exception.ApiException;
import com.reidy.platform.repository.NotificationOutboxRepository;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.*;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import org.slf4j.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// A claim token identifies the current lease owner; completion from an older worker cannot
// acknowledge a replacement claim.
//
// Uses short local transactions to claim, acknowledge, retry, or replay Kafka publication work.
// Spring: a service is a component-scanned bean; singleton scope shares this instance across
// request threads, so request state must remain local.
@Service
public class NotificationOutboxStore {
    public record Claim(String id, String token, String payload, String requestId) {}

    public record Summary(
            String id,
            String eventId,
            Status status,
            int attempts,
            Instant createdAt,
            Instant nextAttemptAt,
            String lastError) {}

    private final NotificationOutboxRepository outbox;
    private final MeterRegistry metrics;
    private final int maxAttempts;
    private final Duration lease;
    private static final Logger log = LoggerFactory.getLogger(NotificationOutboxStore.class);

    public NotificationOutboxStore(
            NotificationOutboxRepository outbox,
            MeterRegistry metrics,
            @Value("${app.outbox.max-attempts:5}") int maxAttempts,
            @Value("${app.outbox.lease:30s}") Duration lease) {
        if (maxAttempts < 1 || maxAttempts > 10 || lease.compareTo(Duration.ofSeconds(15)) <= 0)
            throw new IllegalArgumentException("Invalid outbox retry or lease budget");
        this.outbox = outbox;
        this.metrics = metrics;
        this.maxAttempts = maxAttempts;
        this.lease = lease;
        for (Status status : Status.values())
            metrics.gauge(
                    "event.outbox.rows",
                    io.micrometer.core.instrument.Tags.of("status", status.name()),
                    outbox,
                    repo -> repo.countByStatus(status));
    }

    @Transactional(timeout = 5)
    public Claim claim(String id) {
        // Lock again after candidate selection because another worker may already own this row.
        var row = outbox.lock(id).orElse(null);
        var now = Instant.now();
        if (row == null || row.status == Status.PUBLISHED || row.status == Status.DEAD) return null;
        if (row.status == Status.PROCESSING && row.leaseUntil.isAfter(now)) return null;
        if (row.status == Status.PENDING && row.nextAttemptAt.isAfter(now)) return null;
        if (row.attempts >= maxAttempts) {
            row.status = Status.DEAD;
            row.lastError = "Lease expired after final attempt";
            return null;
        }
        row.status = Status.PROCESSING;
        row.attempts++;
        // A fresh token prevents a late worker from completing a claim that another worker
        // replaced.
        row.claimToken = UUID.randomUUID().toString();
        row.leaseUntil = now.plus(lease);
        return new Claim(row.id, row.claimToken, row.payload, row.requestId);
    }

    // Broker acknowledgment and this database commit cannot be atomic, so consumers must
    // deduplicate event IDs.
    @Transactional(timeout = 5)
    public void published(Claim claim) {
        var row = outbox.lock(claim.id()).orElseThrow();
        if (row.status != Status.PROCESSING || !Objects.equals(row.claimToken, claim.token()))
            return;
        row.status = Status.PUBLISHED;
        row.completedAt = Instant.now();
        row.claimToken = null;
        row.leaseUntil = null;
        row.lastError = null;
        metrics.counter("event.outbox.publications", "result", "published").increment();
    }

    @Transactional(timeout = 5)
    public void failed(Claim claim, Exception error) {
        var row = outbox.lock(claim.id()).orElseThrow();
        if (row.status != Status.PROCESSING || !Objects.equals(row.claimToken, claim.token()))
            return;
        row.status = row.attempts >= maxAttempts ? Status.DEAD : Status.PENDING;
        // Exponential delay reduces repeated pressure; jitter spreads retries from different failed
        // publications.
        // Java: left shift calculates powers of two; the capped shift avoids excessive growth
        // before the delay and jitter are applied.
        long delay = Math.min(300L, 1L << Math.min(row.attempts, 8));
        row.nextAttemptAt =
                Instant.now().plusMillis(delay * 1000 + ThreadLocalRandom.current().nextLong(1000));
        // Java reflection: record only the exception type here, keeping arbitrary dependency
        // messages out of persisted operational summaries.
        row.lastError = error.getClass().getSimpleName();
        row.claimToken = null;
        row.leaseUntil = null;
        metrics.counter(
                        "event.outbox.publications",
                        "result",
                        row.status == Status.DEAD ? "dead" : "retry")
                .increment();
        log.atWarn()
                .addKeyValue("publicationId", row.id)
                .addKeyValue("attempt", row.attempts)
                .addKeyValue("status", row.status)
                .log("kafka_publication_failed");
    }

    // Transactions: readOnly is an optimization hint, not authorization or guaranteed write
    // prevention; default propagation still joins an existing transaction.
    @Transactional(readOnly = true)
    public Page<Summary> list(Status status, int page, int size) {
        if (page < 0 || size < 1 || size > 100)
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid pagination");
        return outbox.findByStatusOrderByCreatedAtAsc(status, PageRequest.of(page, size))
                .map(
                        row ->
                                new Summary(
                                        row.id,
                                        row.eventId,
                                        row.status,
                                        row.attempts,
                                        row.createdAt,
                                        row.nextAttemptAt,
                                        row.lastError));
    }

    // Transactions: proxy-intercepted calls use REQUIRED propagation by default; unchecked
    // exceptions and Errors trigger rollback unless rules override it.
    @Transactional
    public void replay(String id) {
        var row =
                outbox.lock(id)
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.NOT_FOUND,
                                                "Outbox publication not found"));
        if (row.status != Status.DEAD)
            throw new ApiException(HttpStatus.CONFLICT, "Only dead publications can be replayed");
        row.status = Status.PENDING;
        // An explicit operator replay starts a fresh attempt budget while preserving the original
        // event identity.
        row.attempts = 0;
        row.nextAttemptAt = Instant.now();
        row.lastError = null;
        row.claimToken = null;
        row.leaseUntil = null;
        log.atWarn().addKeyValue("publicationId", row.id).log("outbox_replay_requested");
    }
}
