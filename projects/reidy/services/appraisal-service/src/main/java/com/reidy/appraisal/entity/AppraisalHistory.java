package com.reidy.appraisal.entity;

import jakarta.persistence.*;
import java.time.Instant;
import org.hibernate.annotations.Immutable;

// The stored property snapshot preserves the input used for this purchase even if the property
// changes later.
//
// Preserves each purchased appraisal snapshot so later valuations cannot rewrite the original
// report.
// JPA: managed entities have persistence identity and lifecycle; this mapping does not make an
// instance automatically thread-safe.
@Entity
// Hibernate: immutable mapping suppresses ordinary entity dirty-check updates; it does not prevent
// direct SQL changes or deletion.
@Immutable
@Table(uniqueConstraints = @UniqueConstraint(columnNames = "idempotencyKey"))
public class AppraisalHistory {
    @Id
    // JPA: the database generates the identity on insert; needing generated IDs can restrict
    // Hibernate insert batching.
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    // A scalar reference crosses service boundaries; the original property snapshot preserves
    // report inputs.
    @Column(nullable = false, updatable = false)
    public Long propertyId;

    // Store the complete serialized value; its schema is interpreted by the application rather than
    // relational joins.
    @Lob
    @Column(nullable = false, updatable = false)
    public String propertySnapshotJson;

    @Column(nullable = false, updatable = false, length = 100)
    public String idempotencyKey;

    // Store the complete serialized value; its schema is interpreted by the application rather than
    // relational joins.
    @Lob
    @Column(nullable = false, updatable = false)
    public String resultJson;

    @Column(nullable = false, updatable = false)
    public Instant createdAt;
}
