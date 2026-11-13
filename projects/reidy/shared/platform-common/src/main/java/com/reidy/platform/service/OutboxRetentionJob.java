package com.reidy.platform.service;

import com.reidy.platform.entity.NotificationOutbox.Status;
import com.reidy.platform.repository.NotificationOutboxRepository;
import java.time.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

// Only completed publications are eligible for cleanup; pending and dead work remain available for
// recovery and investigation.
//
// Removes old successful outbox records while retaining pending work and failures for
// investigation.
@Component
public class OutboxRetentionJob {
    private final NotificationOutboxRepository outbox;
    private final Duration retention;

    public OutboxRetentionJob(
            NotificationOutboxRepository outbox,
            @Value("${app.outbox.retention:30d}") Duration retention) {
        this.outbox = outbox;
        this.retention = retention;
    }

    @Scheduled(cron = "${app.outbox.cleanup-cron:0 0 2 * * *}", zone = "UTC")
    @Transactional(timeout = 10)
    // Deletes a bounded batch of old successful events without discarding pending or dead-letter
    // work.
    public void prunePublished() {
        var rows =
                outbox.findByStatusAndCompletedAtBefore(
                        Status.PUBLISHED, Instant.now().minus(retention), PageRequest.of(0, 1000));
        if (!rows.isEmpty()) outbox.deleteAllByIdInBatch(rows.stream().map(row -> row.id).toList());
    }
}
