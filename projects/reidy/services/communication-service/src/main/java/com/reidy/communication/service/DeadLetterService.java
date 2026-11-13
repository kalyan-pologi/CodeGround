package com.reidy.communication.service;

import com.reidy.communication.entity.DeadLetterRecord;
import com.reidy.communication.repository.DeadLetterRepository;
import com.reidy.contracts.event.EventTopics;
import com.reidy.platform.exception.*;
import com.reidy.platform.messaging.EventCodec;
import com.reidy.platform.service.NotificationPublisher;
import java.time.Instant;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Replayed events keep their original event ID so an already successful consumer can still
// recognize duplicates.
//
// Archives consumer failures and requeues valid corrected conditions through the local outbox
// rather than direct broker calls.
// Spring: a service is a component-scanned bean; singleton scope shares this instance across
// request threads, so request state must remain local.
@Service
public class DeadLetterService {
    public record Summary(
            Long id,
            String topic,
            int partition,
            long offset,
            String reason,
            Instant archivedAt,
            Instant replayedAt) {}

    private final DeadLetterRepository records;
    private final EventCodec codec;
    private final NotificationPublisher publisher;

    public DeadLetterService(
            DeadLetterRepository records, EventCodec codec, NotificationPublisher publisher) {
        this.records = records;
        this.codec = codec;
        this.publisher = publisher;
    }

    // Transactions: proxy-intercepted calls use REQUIRED propagation by default; unchecked
    // exceptions and Errors trigger rollback unless rules override it.
    @Transactional
    public void archive(String topic, int partition, long offset, String payload, String reason) {
        if (records.existsByOriginalTopicAndOriginalPartitionAndOriginalOffset(
                topic, partition, offset)) return;
        // Persist original source coordinates so redelivering the DLT record does not create
        // another archive entry.
        var record = new DeadLetterRecord();
        record.originalTopic = topic;
        record.originalPartition = partition;
        record.originalOffset = offset;
        record.payload = payload;
        record.reason = reason.length() > 200 ? reason.substring(0, 200) : reason;
        record.archivedAt = Instant.now();
        records.saveAndFlush(record);
    }

    // Transactions: readOnly is an optimization hint, not authorization or guaranteed write
    // prevention; default propagation still joins an existing transaction.
    @Transactional(readOnly = true)
    public Page<Summary> list(int page, int size) {
        if (page < 0 || size < 1 || size > 100)
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid pagination");
        return records.findAll(PageRequest.of(page, size, Sort.by("id").descending()))
                .map(
                        row ->
                                new Summary(
                                        row.id,
                                        row.originalTopic,
                                        row.originalPartition,
                                        row.originalOffset,
                                        row.reason,
                                        row.archivedAt,
                                        row.replayedAt));
    }

    // Transactions: proxy-intercepted calls use REQUIRED propagation by default; unchecked
    // exceptions and Errors trigger rollback unless rules override it.
    @Transactional
    public void replay(long id) {
        var record =
                records.lock(id)
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.NOT_FOUND,
                                                "Dead-letter record not found"));
        if (record.replayedAt != null)
            throw new ApiException(HttpStatus.CONFLICT, "This archive record was already requeued");
        try {
            var event = codec.decode(record.payload);
            if (!EventTopics.forType(event.type()).equals(record.originalTopic))
                throw new InvalidEventException("Topic and event disagree");
            // Keep the event ID for consumer deduplication; the outbox creates a new publication
            // workflow.
            publisher.publish(event);
            // Commit the replay marker and publication intent together so an interrupted request
            // cannot requeue twice.
            record.replayedAt = Instant.now();
        } catch (InvalidEventException error) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid contracts require a corrected producer event, not replay");
        }
    }
}
