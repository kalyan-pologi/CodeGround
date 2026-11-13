package com.reidy.platform.entity;

import jakarta.persistence.*;
import java.time.Instant;

// Publication ID identifies one send workflow; event ID identifies the business event and survives
// an intentional replay.
//
// Keeps asynchronous work durable across process crashes, with retries, leases, and dead-letter
// status.
// JPA: managed entities have persistence identity and lifecycle; this mapping does not make an
// instance automatically thread-safe.
@Entity
@Table(
        indexes = {
            @Index(name = "ix_outbox_due", columnList = "status,next_attempt_at"),
            @Index(name = "ix_outbox_lease", columnList = "status,lease_until")
        })
public class NotificationOutbox {
    // PENDING waits for a claim; PROCESSING holds a lease; PUBLISHED succeeded; DEAD requires
    // operator recovery.
    public enum Status {
        PENDING,
        PROCESSING,
        PUBLISHED,
        DEAD
    }

    @Id
    @Column(length = 36)
    public String id;

    // Publication identity differs from event identity so an operator can replay the same event
    // safely.
    @Column(nullable = false, length = 36)
    public String eventId;

    // Store the complete serialized value; its schema is interpreted by the application rather than
    // relational joins.
    @Lob
    @Column(nullable = false)
    public String payload;

    // Persist enum names rather than ordinal positions so reordering constants does not reinterpret
    // stored values.
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    public Status status;

    // Count claimed send attempts, including work interrupted before its completion was recorded.
    @Column(nullable = false)
    public int attempts;

    @Column(nullable = false)
    public Instant createdAt;

    // Backoff schedules when pending work becomes eligible for another claim.
    @Column(name = "next_attempt_at", nullable = false)
    public Instant nextAttemptAt;

    // An expired lease allows another worker to recover work abandoned by a crashed process.
    @Column(name = "lease_until")
    public Instant leaseUntil;

    // Completion must present this token so an older worker cannot acknowledge a newer claim.
    @Column(length = 36)
    public String claimToken;

    // Carry the originating request correlation ID into background publication logs.
    @Column(length = 36)
    public String requestId;

    @Column(length = 200)
    public String lastError;

    // Retention cleanup measures age from successful publication rather than initial event
    // creation.
    public Instant completedAt;

    // JPA compares this version during updates to detect conflicting writes instead of silently
    // overwriting them.
    @Version public Long version;
}
