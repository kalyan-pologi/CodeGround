package com.reidy.communication.service;

import com.reidy.communication.entity.Notification;
import com.reidy.communication.repository.NotificationRepository;
import com.reidy.contracts.event.PlatformEvent;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// When called by the event handler, default transaction propagation joins its transaction instead
// of committing each recipient separately.
//
// Persists inbox entries with event-recipient uniqueness to tolerate repeated delivery attempts.
// Spring: a service is a component-scanned bean; singleton scope shares this instance across
// request threads, so request state must remain local.
@Service
public class NotificationWriter {
    private final NotificationRepository notifications;

    public NotificationWriter(NotificationRepository notifications) {
        this.notifications = notifications;
    }

    // Transactions: proxy-intercepted calls use REQUIRED propagation by default; unchecked
    // exceptions and Errors trigger rollback unless rules override it.
    @Transactional
    public void store(PlatformEvent event, String recipient, String body) {
        // The unique constraint also protects concurrent duplicate delivery.
        if (notifications.existsByEventIdAndRecipient(event.id().toString(), recipient)) return;
        var notification = new Notification();
        notification.eventId = event.id().toString();
        notification.recipient = recipient;
        notification.eventType = event.type().name();
        notification.body = body;
        notification.createdAt = event.occurredAt();
        // Flush exposes uniqueness violations inside the surrounding consumer transaction instead
        // of silently accepting duplicate work.
        // JPA: flush synchronizes SQL with the database inside the transaction; a later rollback
        // can still undo these writes.
        notifications.saveAndFlush(notification);
    }
}
