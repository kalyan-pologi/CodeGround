package com.reidy.appraisal.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.reidy.appraisal.dto.*;
import com.reidy.appraisal.entity.*;
import com.reidy.appraisal.mapper.AppraisalJson;
import com.reidy.appraisal.repository.*;
import com.reidy.contracts.dto.PropertySnapshot;
import com.reidy.contracts.event.PlatformEvent;
import com.reidy.platform.exception.ApiException;
import com.reidy.platform.service.*;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Spring applies transactions through this separate bean; a failure rolls back report, balance,
// ledger, cache and publication intent together.
//
// Owns the atomic billing transaction; property snapshots arrive through HTTP and are never joined
// across databases.
// Spring: a service is a component-scanned bean; singleton scope shares this instance across
// request threads, so request state must remain local.
@Service
public class PaidAppraisalStore {
    private final CreditAccountRepository accounts;
    private final CreditTransactionRepository credits;
    private final AppraisalHistoryRepository history;
    private final AppraisalCacheRepository cache;
    private final AppraisalJson json;
    private final ObjectMapper mapper;
    private final NotificationPublisher events;
    private final ActorIdentity actor;

    public PaidAppraisalStore(
            CreditAccountRepository accounts,
            CreditTransactionRepository credits,
            AppraisalHistoryRepository history,
            AppraisalCacheRepository cache,
            AppraisalJson json,
            ObjectMapper mapper,
            NotificationPublisher events,
            ActorIdentity actor) {
        this.accounts = accounts;
        this.credits = credits;
        this.history = history;
        this.cache = cache;
        this.json = json;
        this.mapper = mapper;
        this.events = events;
        this.actor = actor;
    }

    // Transactions: readOnly is an optimization hint, not authorization or guaranteed write
    // prevention; default propagation still joins an existing transaction.
    @Transactional(readOnly = true)
    public AppraisalResponse previous(long propertyId, String key) {
        return history.findByIdempotencyKey(key)
                .map(
                        report -> {
                            if (!report.propertyId.equals(propertyId))
                                throw new ApiException(
                                        HttpStatus.CONFLICT,
                                        "Idempotency key belongs to another property");
                            return response(report);
                        })
                .orElse(null);
    }

    // Transactions: proxy-intercepted calls use REQUIRED propagation by default; unchecked
    // exceptions and Errors trigger rollback unless rules override it.
    @Transactional
    public AppraisalResponse purchase(
            PropertySnapshot property, String key, NormalizedAppraisal valuation) {
        // Serialize purchases against the demo balance before checking credit availability.
        var account = accounts.lockAccount(1L);
        // Recheck after locking because another request may have completed while the HTTP lookup
        // was running.
        // Spring proxies: this self-call bypasses previous() interception; it runs inside
        // purchase()'s existing read-write transaction.
        var previous = previous(property.id(), key);
        if (previous != null) return previous;
        if (account == null || account.balance < 1)
            throw new ApiException(HttpStatus.CONFLICT, "Insufficient credits");
        // Capture the purchase separately from the reusable cache so later refreshes cannot rewrite
        // purchase history.
        var report = new AppraisalHistory();
        report.propertyId = property.id();
        report.idempotencyKey = key;
        try {
            report.propertySnapshotJson = mapper.writeValueAsString(property);
        } catch (com.fasterxml.jackson.core.JsonProcessingException error) {
            throw new IllegalStateException("Cannot serialize property snapshot", error);
        }
        report.resultJson = json.write(valuation);
        report.createdAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
        // Spring Data: a new entity is persisted; save is not a promise that the surrounding
        // transaction has committed.
        history.save(report);
        // The managed account is dirty-checked by JPA; the balance change commits with the ledger
        // entry.
        // JPA dirty checking: account remains managed in this persistence context, so flush detects
        // this mutation without another save call.
        account.balance--;
        var debit = new CreditTransaction();
        debit.account = account;
        debit.report = report;
        debit.amount = -1;
        debit.createdAt = report.createdAt;
        credits.save(debit);
        // Replace reusable valuation data without altering earlier purchased reports.
        var reusable = cache.findById(property.id()).orElseGet(AppraisalCache::new);
        reusable.propertyId = property.id();
        reusable.resultJson = report.resultJson;
        reusable.updatedAt = report.createdAt;
        cache.save(reusable);
        // Record durable publication intent in this transaction; the Kafka send happens later.
        events.publish(
                PlatformEvent.create(
                        PlatformEvent.Type.APPRAISAL_COMPLETED,
                        report.id.toString(),
                        Set.of(actor.currentUserOrDemo()),
                        "report " + report.id));
        return response(report);
    }

    private AppraisalResponse response(AppraisalHistory report) {
        return new AppraisalResponse(
                report.id,
                report.propertyId,
                "PAID",
                report.createdAt,
                json.read(report.resultJson));
    }
}
