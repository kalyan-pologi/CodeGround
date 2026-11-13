package com.reidy.communication.entity;

import jakarta.persistence.*;
import java.time.Instant;

// Archiving retains the original payload for diagnosis; list responses expose metadata rather than
// the entire stored payload.
//
// Archives failed Kafka records using original coordinates so repeated DLT consumption remains
// idempotent.
// JPA: managed entities have persistence identity and lifecycle; this mapping does not make an
// instance automatically thread-safe.
@Entity
@Table(
        uniqueConstraints =
                @UniqueConstraint(
                        columnNames = {"original_topic", "original_partition", "original_offset"}))
public class DeadLetterRecord {
    @Id
    // JPA: the database generates the identity on insert; needing generated IDs can restrict
    // Hibernate insert batching.
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "original_topic", nullable = false, length = 120)
    public String originalTopic;

    @Column(name = "original_partition", nullable = false)
    public int originalPartition;

    @Column(name = "original_offset", nullable = false)
    public long originalOffset;

    // Store the complete serialized value; its schema is interpreted by the application rather than
    // relational joins.
    @Lob
    @Column(nullable = false)
    public String payload;

    @Column(nullable = false, length = 200)
    public String reason;

    @Column(nullable = false)
    public Instant archivedAt;

    public Instant replayedAt;
}
