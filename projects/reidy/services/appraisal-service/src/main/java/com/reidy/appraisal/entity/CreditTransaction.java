package com.reidy.appraisal.entity;

import jakarta.persistence.*;
import java.time.Instant;
import org.hibernate.annotations.Immutable;

// A negative amount records a debit; linking it to the purchased report makes the fictional charge
// traceable.
//
// Records an append-only debit linked uniquely to its purchased appraisal report.
// JPA: managed entities have persistence identity and lifecycle; this mapping does not make an
// instance automatically thread-safe.
@Entity
// Hibernate: immutable mapping suppresses ordinary entity dirty-check updates; it does not prevent
// direct SQL changes or deletion.
@Immutable
public class CreditTransaction {
    @Id
    // JPA: the database generates the identity on insert; needing generated IDs can restrict
    // Hibernate insert batching.
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    // JPA: this association maps a local foreign key; loading behavior depends on fetch settings
    // and the active persistence context.
    @ManyToOne(optional = false)
    public CreditAccount account;

    // JPA: this models a local one-to-one association; it cannot transparently join independently
    // owned service databases.
    @OneToOne(optional = false)
    @JoinColumn(unique = true, nullable = false)
    public AppraisalHistory report;

    public int amount;
    public Instant createdAt;
}
