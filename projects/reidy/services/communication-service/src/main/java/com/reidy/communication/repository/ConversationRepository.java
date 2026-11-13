package com.reidy.communication.repository;

import com.reidy.communication.entity.Conversation;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

// Locking the conversation serializes writes that allocate its next message sequence number.
//
// Provides database queries for conversation records without exposing SQL to controllers.
// Spring Data creates a repository proxy; generic entity and ID types provide compile-time safety,
// while database constraints enforce persisted invariants.
public interface ConversationRepository extends JpaRepository<Conversation, Long> {
    // JPA locking: the database holds a write lock until transaction completion; other processes
    // using this database must respect conflicting locks.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    // Spring Data: this query uses JPQL entity and attribute names unless nativeQuery is enabled;
    // it is not necessarily literal table SQL.
    @Query("select c from Conversation c where c.id=:id")
    Optional<Conversation> lockConversation(@Param("id") long id);
}
