package com.reidy.communication.messaging;

import com.reidy.communication.service.NotificationEventHandler;
import com.reidy.contracts.event.*;
import com.reidy.platform.exception.InvalidEventException;
import com.reidy.platform.messaging.EventCodec;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.MDC;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

// The container acknowledges a record after this method returns; transaction failures escape so the
// error handler can retry.
//
// Consumes versioned business facts; successful return permits record acknowledgment after local
// database work commits.
@Component
// Spring Boot: register this configuration or component only when the configured property condition
// matches during startup.
@ConditionalOnProperty(name = "app.kafka.enabled", havingValue = "true", matchIfMissing = true)
public class NotificationKafkaListener {
    private final EventCodec codec;
    private final NotificationEventHandler handler;

    public NotificationKafkaListener(EventCodec codec, NotificationEventHandler handler) {
        this.codec = codec;
        this.handler = handler;
    }

    @KafkaListener(
            topics = {
                EventTopics.PROPERTY_CREATED,
                EventTopics.APPRAISAL_COMPLETED,
                EventTopics.CHAT_MESSAGE_CREATED
            },
            groupId = "${app.kafka.notification-group:communication-notifications-v1}",
            containerFactory = "notificationKafkaFactory",
            concurrency = "${app.kafka.consumer-concurrency:3}",
            autoStartup = "${app.kafka.listener-auto-startup:true}")
    public void consume(ConsumerRecord<String, String> record) {
        var event = codec.decode(record.value());
        if (!EventTopics.forType(event.type()).equals(record.topic()))
            throw new InvalidEventException("Event type does not match its topic");
        var requestId = record.headers().lastHeader("request-id");
        if (requestId != null) {
            String value = new String(requestId.value(), java.nio.charset.StandardCharsets.UTF_8);
            if (value.matches("[0-9a-fA-F-]{36}")) MDC.put("requestId", value);
        }
        MDC.put("eventId", event.id().toString());
        try {
            handler.handle(event);
        } finally {
            MDC.remove("requestId");
            MDC.remove("eventId");
        }
    }
}
