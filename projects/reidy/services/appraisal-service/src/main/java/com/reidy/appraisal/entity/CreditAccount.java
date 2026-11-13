package com.reidy.appraisal.entity;

import jakarta.persistence.*;

// Purchasing locks this account before checking its balance so concurrent requests cannot
// independently spend the same remaining credit.
//
// Stores the sample account balance that paid requests protect with a database lock.
// JPA: managed entities have persistence identity and lifecycle; this mapping does not make an
// instance automatically thread-safe.
@Entity
public class CreditAccount {
    @Id public Long id;

    @Column(nullable = false)
    public int balance;
}
