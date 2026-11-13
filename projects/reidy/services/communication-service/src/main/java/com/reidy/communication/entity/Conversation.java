package com.reidy.communication.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.*;

// Participants and sequence allocation belong to communication-service; an optional property ID is
// a reference rather than a remote entity relationship.
//
// Groups participants and sequence allocation independently of whether a property is attached.
// JPA: managed entities have persistence identity and lifecycle; this mapping does not make an
// instance automatically thread-safe.
@Entity
public class Conversation {
    @Id
    // JPA: the database generates the identity on insert; needing generated IDs can restrict
    // Hibernate insert batching.
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    // Optional scalar references allow conversations before a deal exists without cross-service
    // foreign keys.
    public Long propertyId;

    // JPA: collection elements have value semantics and live in a collection table rather than
    // independent entity identities.
    @ElementCollection
    @CollectionTable(
            name = "conversation_participant",
            joinColumns = @JoinColumn(name = "conversation_id"),
            uniqueConstraints = @UniqueConstraint(columnNames = {"conversation_id", "user_id"}))
    @Column(name = "user_id", nullable = false, length = 100)
    public Set<String> participants = new HashSet<>();

    public Instant createdAt;
    public long nextSequence;
}
