package com.reidy.property.entity;

import com.reidy.contracts.model.PropertyType;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

// This entity belongs only to property-service; other services persist scalar property IDs or
// snapshots instead of cross-database JPA relationships.
//
// Maps editable property details and optimistic version checks to a database row.
// JPA: managed entities have persistence identity and lifecycle; this mapping does not make an
// instance automatically thread-safe.
@Entity
public class Property {
    @Id
    // JPA: the database generates the identity on insert; needing generated IDs can restrict
    // Hibernate insert batching.
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false)
    public String address;

    public String city;
    public String state;
    public String zipCode;

    // Persist enum names rather than ordinal positions so reordering constants does not reinterpret
    // stored values.
    @Enumerated(EnumType.STRING)
    public PropertyType propertyType;

    public Integer bedrooms;
    public BigDecimal bathrooms;
    public Integer squareFootage;
    public Integer yearBuilt;
    public BigDecimal askingPrice;

    @Column(updatable = false)
    public Instant createdAt;

    public Instant updatedAt;
    // JPA compares this version during updates to detect conflicting writes instead of silently
    // overwriting them.
    @Version public Long version;

    // JPA invokes this callback before the entity is first inserted.
    @PrePersist
    void created() {
        createdAt = Instant.now();
        updatedAt = createdAt;
    }

    // JPA invokes this callback before writing an updated managed entity.
    @PreUpdate
    void updated() {
        updatedAt = Instant.now();
    }
}
