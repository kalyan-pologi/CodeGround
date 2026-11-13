package com.reidy.communication.repository;

import com.reidy.communication.entity.Notification;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;

// The existence check avoids ordinary duplicate inserts; the database uniqueness constraint remains
// the final guard under concurrency.
//
// Provides database queries for notification records without exposing SQL to controllers.
// Spring Data creates a repository proxy; generic entity and ID types provide compile-time safety,
// while database constraints enforce persisted invariants.
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    boolean existsByEventIdAndRecipient(String eventId, String recipient);

    Page<Notification> findByRecipientOrderByIdDesc(String recipient, Pageable pageable);
}
