package com.reidy.communication.repository;

import com.reidy.communication.entity.DeadLetterRecord;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

// The original Kafka coordinates identify one failed record; row locking serializes operator replay
// requests for that archive entry.
//
// Supports duplicate-safe archival and serialized operator replay without exposing event payloads
// in list responses.
// Spring Data creates a repository proxy; generic entity and ID types provide compile-time safety,
// while database constraints enforce persisted invariants.
public interface DeadLetterRepository extends JpaRepository<DeadLetterRecord, Long> {
    boolean existsByOriginalTopicAndOriginalPartitionAndOriginalOffset(
            String topic, int partition, long offset);

    // JPA locking: the database holds a write lock until transaction completion; other processes
    // using this database must respect conflicting locks.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    // Spring Data: this query uses JPQL entity and attribute names unless nativeQuery is enabled;
    // it is not necessarily literal table SQL.
    @Query("select record from DeadLetterRecord record where record.id=:id")
    Optional<DeadLetterRecord> lock(@Param("id") long id);
}
