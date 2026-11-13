package com.reidy.communication.entity;

import jakarta.persistence.*;

// Templates are addressed by event type, keeping notification wording separate from producer
// business logic.
//
// Stores message wording separately from business logic so delivery can render event-specific
// templates.
// JPA: managed entities have persistence identity and lifecycle; this mapping does not make an
// instance automatically thread-safe.
@Entity
public class NotificationTemplate {
    @Id
    @Column(length = 40)
    public String eventType;

    @Column(nullable = false, length = 1000)
    public String body;
}
