package com.reidy.platform.service;

import com.reidy.contracts.event.PlatformEvent;
import com.reidy.platform.entity.NotificationOutbox;
import com.reidy.platform.messaging.EventCodec;
import com.reidy.platform.repository.NotificationOutboxRepository;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

// Mandatory propagation rejects calls without a transaction, preventing event intent from
// committing separately from its business change.
//
// Saves publication intent with the business transaction, keeping Kafka availability outside the
// request?s commit boundary.
// Spring: a service is a component-scanned bean; singleton scope shares this instance across
// request threads, so request state must remain local.
@Service
public class OutboxNotificationPublisher implements NotificationPublisher {
    private final NotificationOutboxRepository outbox;
    private final EventCodec codec;

    public OutboxNotificationPublisher(NotificationOutboxRepository outbox, EventCodec codec) {
        this.outbox = outbox;
        this.codec = codec;
    }

    // Transactions: MANDATORY requires an existing transaction; it never creates an independent
    // transaction for the outbox insert.
    @Transactional(propagation = Propagation.MANDATORY)
    public void publish(PlatformEvent event) {
        var row = new NotificationOutbox();
        row.id = UUID.randomUUID().toString();
        row.eventId = event.id().toString();
        row.payload = codec.encode(event);
        row.status = NotificationOutbox.Status.PENDING;
        row.createdAt = event.occurredAt();
        row.nextAttemptAt = java.time.Instant.now();
        row.requestId = MDC.get("requestId");
        outbox.save(row);
    }
}
