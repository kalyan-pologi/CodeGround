package com.reidy.appraisal.entity;

import jakarta.persistence.*;
import java.time.Instant;

// One reusable result per property can be replaced without modifying the immutable report purchased
// by an earlier request.
//
// Stores one reusable valuation per property, separately from immutable purchased report history.
// JPA: managed entities have persistence identity and lifecycle; this mapping does not make an
// instance automatically thread-safe.
@Entity
public class AppraisalCache {
    // A property identifier is also the cache primary key, permitting at most one reusable entry.
    @Id public Long propertyId;
    // Hibernate increments this version and rejects stale concurrent updates.
    // JPA compares this version during updates to detect conflicting writes instead of silently
    // overwriting them.
    @Version public Long version;

    // The property belongs to another service, so this identifier has no local foreign-key
    // relationship.
    // Store the complete serialized value; its schema is interpreted by the application rather than
    // relational joins.
    @Lob
    @Column(nullable = false)
    public String resultJson;

    public Instant updatedAt;
}
