package com.reidy.platform.service;

import com.reidy.platform.entity.NotificationOutbox.Status;
import com.reidy.platform.messaging.KafkaEventPublisher;
import com.reidy.platform.repository.NotificationOutboxRepository;
import java.time.Instant;
import org.slf4j.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

// Polling finds candidate IDs; each candidate must still acquire a database claim before making a
// broker call.
//
// Publishes claimed work outside database transactions, then records broker acknowledgment in a
// separate short transaction.
@Component
// Spring Boot: register this configuration or component only when the configured property condition
// matches during startup.
@ConditionalOnProperty(name = "app.kafka.enabled", havingValue = "true", matchIfMissing = true)
public class NotificationOutboxWorker {
    private static final Logger log = LoggerFactory.getLogger(NotificationOutboxWorker.class);
    private final NotificationOutboxRepository outbox;
    private final NotificationOutboxStore store;
    private final KafkaEventPublisher publisher;
    private final int batch;

    public NotificationOutboxWorker(
            NotificationOutboxRepository outbox,
            NotificationOutboxStore store,
            KafkaEventPublisher publisher,
            @Value("${app.outbox.batch-size:25}") int batch) {
        this.outbox = outbox;
        this.store = store;
        this.publisher = publisher;
        this.batch = batch;
    }

    @Scheduled(
            fixedDelayString = "${app.outbox.poll-delay:1000}",
            initialDelayString = "${app.outbox.initial-delay:1000}")
    public void poll() {
        try {
            for (String id :
                    outbox.findDueIds(
                            Instant.now(),
                            Status.PENDING,
                            Status.PROCESSING,
                            PageRequest.of(0, batch))) {
                try {
                    var claim = store.claim(id);
                    if (claim == null) continue;
                    if (claim.requestId() != null) MDC.put("requestId", claim.requestId());
                    MDC.put("eventId", claim.id());
                    try {
                        publisher.publish(claim.payload(), claim.requestId());
                        store.published(claim);
                    } catch (Exception error) {
                        store.failed(claim, error);
                        if (error instanceof InterruptedException)
                            Thread.currentThread().interrupt();
                    } finally {
                        MDC.remove("requestId");
                        MDC.remove("eventId");
                    }
                } catch (Exception error) {
                    log.error("event=outbox_processing_failed publicationId={}", id, error);
                }
            }
        } catch (Exception error) {
            log.error("event=outbox_poll_failed", error);
        }
    }
}
