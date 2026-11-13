package com.reidy.communication.entity;

import jakarta.persistence.*;
import java.time.Instant;

// Event and recipient identify a logical inbox delivery, allowing the database to reject duplicate
// entries.
//
// Stores a recipient?s durable inbox entry with event-level duplicate protection.
// JPA: managed entities have persistence identity and lifecycle; this mapping does not make an
// instance automatically thread-safe.
@Entity
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"event_id", "recipient"}))
public class Notification {
    @Id
    // JPA: the database generates the identity on insert; needing generated IDs can restrict
    // Hibernate insert batching.
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "event_id", nullable = false, length = 36)
    public String eventId;

    @Column(nullable = false, length = 100)
    public String recipient;

    @Column(nullable = false, length = 40)
    public String eventType;

    @Column(nullable = false, length = 2000)
    public String body;

    @Column(nullable = false)
    public Instant createdAt;
}
