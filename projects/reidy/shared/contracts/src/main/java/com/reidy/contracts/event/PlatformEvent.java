package com.reidy.contracts.event;

import java.time.Instant;
import java.util.*;

// A stable event ID supports deduplication; schemaVersion allows consumers to reject formats they
// do not yet understand.
//
// Versioned event envelopes keep consumers independent of producer database schemas and Java entity
// classes.
// Java records generate component accessors, equals, hashCode and toString; final component
// references do not imply deep immutability.
public record PlatformEvent(
        // This identity remains stable through retries and dead-letter replay.
        UUID id,
        // Consumers validate the supported envelope version before processing business data.
        int schemaVersion,
        Type type,
        // The producer uses this value as a Kafka key to select a partition.
        String aggregateId,
        Set<String> recipients,
        String subject,
        // Event creation time differs from broker receipt and consumer processing time.
        Instant occurredAt) {
    public enum Type {
        PROPERTY_CREATED,
        APPRAISAL_COMPLETED,
        NEW_CHAT_MESSAGE
    }

    // Copies recipients so later caller mutations cannot change a recorded event.
    public PlatformEvent {
        // Java records: a compact constructor can normalize constructor parameters before implicit
        // field assignment; collection immutability requires this explicit defensive copy.
        recipients = recipients == null ? null : Set.copyOf(recipients);
    }

    public static PlatformEvent create(
            Type type, String aggregateId, Set<String> recipients, String subject) {
        return new PlatformEvent(
                // Java time: Instant represents a point on the UTC timeline; the event UUID is an
                // identity rather than a sortable business sequence.
                UUID.randomUUID(), 1, type, aggregateId, recipients, subject, Instant.now());
    }
}
