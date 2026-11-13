package com.reidy.appraisal.entity;

import com.reidy.appraisal.dto.RentalEndpoint;
import jakarta.persistence.*;
import java.time.Instant;

// Expiry controls data freshness; the separate refresh lease coordinates who may replace that data.
//
// Stores endpoint-specific rental JSON and a refresh lease for concurrent request coordination.
// JPA: managed entities have persistence identity and lifecycle; this mapping does not make an
// instance automatically thread-safe.
@Entity
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"property_id", "endpoint"}))
public class RentalCacheEntry {
    @Id
    // JPA: the database generates the identity on insert; needing generated IDs can restrict
    // Hibernate insert batching.
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    // Remote property identifiers are stored as values rather than cross-database entity
    // relationships.
    @Column(name = "property_id", nullable = false)
    public Long propertyId;

    // Persist enum names rather than ordinal positions so reordering constants does not reinterpret
    // stored values.
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    public RentalEndpoint endpoint;

    // Store the complete serialized value; its schema is interpreted by the application rather than
    // relational joins.
    @Lob
    @Column(nullable = false)
    public String payload;

    @Column(nullable = false)
    public Instant expiresAt;

    @Column(length = 36)
    public String refreshToken;

    public Instant refreshUntil;
    // JPA compares this version during updates to detect conflicting writes instead of silently
    // overwriting them.
    @Version public Long version;
}
