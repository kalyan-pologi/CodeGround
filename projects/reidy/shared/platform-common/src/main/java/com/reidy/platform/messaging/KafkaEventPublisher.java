package com.reidy.platform.messaging;

import com.reidy.contracts.event.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

// Broker acknowledgment happens before the outbox is marked published; a crash between those steps
// can still cause redelivery.
//
// Waits for broker acknowledgment outside database transactions; database marking can still produce
// harmless duplicate sends after crashes.
@Component
public class KafkaEventPublisher {
    private final KafkaTemplate<String, String> kafka;
    private final EventCodec codec;
    private final String service;

    public KafkaEventPublisher(
            KafkaTemplate<String, String> kafka,
            EventCodec codec,
            @Value("${spring.application.name}") String service) {
        this.kafka = kafka;
        this.codec = codec;
        this.service = service;
    }

    public void publish(String payload, String requestId) throws Exception {
        var event = codec.decode(payload);
        var record =
                new ProducerRecord<String, String>(
                        // Kafka: the key usually selects a partition; order is scoped to a
                        // partition and does not establish global business-event ordering.
                        EventTopics.forType(event.type()), event.aggregateId(), payload);
        record.headers().add("event-id", event.id().toString().getBytes(StandardCharsets.UTF_8));
        record.headers().add("source-service", service.getBytes(StandardCharsets.UTF_8));
        if (requestId != null)
            record.headers().add("request-id", requestId.getBytes(StandardCharsets.UTF_8));
        // Java futures: send is asynchronous, but timed get blocks this worker for acknowledgment;
        // timing out does not prove the broker rejected delivery.
        kafka.send(record).get(12, TimeUnit.SECONDS);
    }
}
