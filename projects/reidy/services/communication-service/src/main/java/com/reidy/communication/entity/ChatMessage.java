package com.reidy.communication.entity;

import jakarta.persistence.*;
import java.time.Instant;

// The client-generated message key handles request retries; the server-assigned sequence supports
// ordered history retrieval.
//
// Persists message content with unique retry and ordering constraints per conversation.
// JPA: managed entities have persistence identity and lifecycle; this mapping does not make an
// instance automatically thread-safe.
@Entity
@Table(
        uniqueConstraints = {
            @UniqueConstraint(columnNames = {"conversation_id", "sender_id", "client_message_id"}),
            @UniqueConstraint(columnNames = {"conversation_id", "sequence_number"})
        })
public class ChatMessage {
    @Id
    // JPA: the database generates the identity on insert; needing generated IDs can restrict
    // Hibernate insert batching.
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    // JPA: this association maps a local foreign key; loading behavior depends on fetch settings
    // and the active persistence context.
    @ManyToOne(optional = false)
    @JoinColumn(name = "conversation_id", nullable = false)
    public Conversation conversation;

    @Column(name = "sender_id", nullable = false, length = 100)
    public String senderId;

    @Column(name = "client_message_id", nullable = false, length = 100)
    public String clientMessageId;

    @Column(nullable = false, length = 4000)
    public String content;

    @Column(name = "sequence_number", nullable = false)
    public long sequenceNumber;

    @Column(nullable = false)
    public Instant sentAt;
}
