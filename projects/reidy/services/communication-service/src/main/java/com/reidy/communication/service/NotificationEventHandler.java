package com.reidy.communication.service;

import com.reidy.communication.entity.ProcessedEvent;
import com.reidy.communication.repository.ProcessedEventRepository;
import com.reidy.contracts.event.PlatformEvent;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// The processed marker and inbox writes share one transaction, making replay after an offset-commit
// failure safe.
//
// Commits notification rows and the processed marker atomically before the listener allows Kafka
// offset acknowledgment.
// Spring: a service is a component-scanned bean; singleton scope shares this instance across
// request threads, so request state must remain local.
@Service
public class NotificationEventHandler {
    private final ProcessedEventRepository processed;
    private final NotificationTemplateService templates;
    private final NotificationWriter writer;
    private final MeterRegistry metrics;

    public NotificationEventHandler(
            ProcessedEventRepository processed,
            NotificationTemplateService templates,
            NotificationWriter writer,
            MeterRegistry metrics) {
        this.processed = processed;
        this.templates = templates;
        this.writer = writer;
        this.metrics = metrics;
    }

    @Transactional(timeout = 10)
    public void handle(PlatformEvent event) {
        // Kafka may redeliver after a crash between database commit and offset acknowledgment.
        if (processed.existsById(event.id().toString())) {
            metrics.counter("kafka.notification.events", "result", "duplicate").increment();
            return;
        }
        String body = templates.render(event);
        // Spring proxies: writer is another bean, so its REQUIRED transaction advice joins this
        // handler's transaction rather than committing each recipient.
        for (String recipient : event.recipients()) writer.store(event, recipient, body);
        // Save success only alongside all recipient writes; any failure rolls the complete
        // transaction back.
        var marker = new ProcessedEvent();
        marker.eventId = event.id().toString();
        marker.processedAt = Instant.now();
        processed.saveAndFlush(marker);
        metrics.counter("kafka.notification.events", "result", "processed").increment();
    }
}
