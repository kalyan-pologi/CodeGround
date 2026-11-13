package com.reidy.communication.entity;

import jakarta.persistence.*;
import java.time.Instant;

// This marker records successful consumer work, not broker publication; producers and consumers
// track different stages of delivery.
//
// Commits consumer deduplication alongside inbox writes so replay after offset loss cannot
// duplicate notifications.
// JPA: managed entities have persistence identity and lifecycle; this mapping does not make an
// instance automatically thread-safe.
@Entity
public class ProcessedEvent {
    @Id
    @Column(length = 36)
    public String eventId;

    @Column(nullable = false)
    public Instant processedAt;
}
