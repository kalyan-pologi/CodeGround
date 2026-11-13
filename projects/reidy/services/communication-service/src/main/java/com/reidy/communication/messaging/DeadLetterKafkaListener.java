package com.reidy.communication.messaging;

import com.reidy.communication.service.DeadLetterService;
import com.reidy.contracts.event.EventTopics;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.header.Headers;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.stereotype.Component;

// Original topic, partition and offset identify the failed source record, allowing archive writes
// to tolerate DLT redelivery.
//
// Persists DLT records before acknowledging them, keeping inspection durable even after broker
// retention expires.
@Component
// Spring Boot: register this configuration or component only when the configured property condition
// matches during startup.
@ConditionalOnProperty(name = "app.kafka.enabled", havingValue = "true", matchIfMissing = true)
public class DeadLetterKafkaListener {
    private final DeadLetterService archive;

    public DeadLetterKafkaListener(DeadLetterService archive) {
        this.archive = archive;
    }

    @KafkaListener(
            topics = {
                EventTopics.PROPERTY_CREATED + ".DLT",
                EventTopics.APPRAISAL_COMPLETED + ".DLT",
                EventTopics.CHAT_MESSAGE_CREATED + ".DLT"
            },
            groupId = "${app.kafka.dead-letter-group:communication-dlt-archive-v1}",
            containerFactory = "deadLetterKafkaFactory",
            autoStartup = "${app.kafka.listener-auto-startup:true}")
    public void consume(ConsumerRecord<String, String> record) {
        String topic =
                text(
                        record.headers(),
                        KafkaHeaders.DLT_ORIGINAL_TOPIC,
                        record.topic().replace(".DLT", ""));
        var partition = record.headers().lastHeader(KafkaHeaders.DLT_ORIGINAL_PARTITION);
        var offset = record.headers().lastHeader(KafkaHeaders.DLT_ORIGINAL_OFFSET);
        int originalPartition =
                partition == null
                        ? record.partition()
                        : ByteBuffer.wrap(partition.value()).getInt();
        long originalOffset =
                offset == null ? record.offset() : ByteBuffer.wrap(offset.value()).getLong();
        archive.archive(
                topic,
                originalPartition,
                originalOffset,
                record.value() == null ? "null" : record.value(),
                text(record.headers(), KafkaHeaders.DLT_EXCEPTION_FQCN, "UnknownFailure"));
    }

    private String text(Headers headers, String key, String fallback) {
        var header = headers.lastHeader(key);
        return header == null ? fallback : new String(header.value(), StandardCharsets.UTF_8);
    }
}
