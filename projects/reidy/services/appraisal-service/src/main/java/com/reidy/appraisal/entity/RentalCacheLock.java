package com.reidy.appraisal.entity;

import jakarta.persistence.*;

// A small fixed set of lock rows trades some parallelism for coordination without requiring a row
// for every possible property.
//
// Lock buckets coordinate first cache inserts without requiring a property row in this service?s
// database.
// JPA: managed entities have persistence identity and lifecycle; this mapping does not make an
// instance automatically thread-safe.
@Entity
public class RentalCacheLock {
    @Id public Integer id;
}
