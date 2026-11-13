package com.reidy.platform.repository;

import com.reidy.platform.entity.NotificationOutbox;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

// Candidate selection does not grant ownership; workers must still lock and claim rows before
// sending.
//
// Provides database queries for notification outbox records without exposing SQL to controllers.
// Spring Data creates a repository proxy; generic entity and ID types provide compile-time safety,
// while database constraints enforce persisted invariants.
public interface NotificationOutboxRepository extends JpaRepository<NotificationOutbox, String> {
    // Spring Data: this query uses JPQL entity and attribute names unless nativeQuery is enabled;
    // it is not necessarily literal table SQL.
    @Query(
            "select o.id from NotificationOutbox o where (o.status = :pending and o.nextAttemptAt <= :now) or (o.status = :processing and o.leaseUntil <= :now) order by o.createdAt")
    List<String> findDueIds(
            @Param("now") Instant now,
            @Param("pending") NotificationOutbox.Status pending,
            @Param("processing") NotificationOutbox.Status processing,
            Pageable pageable);

    // JPA locking: the database holds a write lock until transaction completion; other processes
    // using this database must respect conflicting locks.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    // Spring Data: this query uses JPQL entity and attribute names unless nativeQuery is enabled;
    // it is not necessarily literal table SQL.
    @Query("select o from NotificationOutbox o where o.id=:id")
    Optional<NotificationOutbox> lock(@Param("id") String id);

    Page<NotificationOutbox> findByStatusOrderByCreatedAtAsc(
            NotificationOutbox.Status status, Pageable pageable);

    long countByStatus(NotificationOutbox.Status status);

    java.util.List<NotificationOutbox> findByStatusAndCompletedAtBefore(
            NotificationOutbox.Status status,
            java.time.Instant before,
            org.springframework.data.domain.Pageable pageable);
}
