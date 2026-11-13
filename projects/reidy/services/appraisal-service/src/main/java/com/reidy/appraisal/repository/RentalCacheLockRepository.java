package com.reidy.appraisal.repository;

import com.reidy.appraisal.entity.RentalCacheLock;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

// The selected bucket lock is held only for the surrounding transaction, never throughout the
// external provider call.
//
// Serializes short lease updates within one of sixteen database-backed coordination buckets.
// Spring Data creates a repository proxy; generic entity and ID types provide compile-time safety,
// while database constraints enforce persisted invariants.
public interface RentalCacheLockRepository extends JpaRepository<RentalCacheLock, Integer> {
    // JPA locking: the database holds a write lock until transaction completion; other processes
    // using this database must respect conflicting locks.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    // Spring Data: this query uses JPQL entity and attribute names unless nativeQuery is enabled;
    // it is not necessarily literal table SQL.
    @Query("select bucket from RentalCacheLock bucket where bucket.id=:id")
    RentalCacheLock lockBucket(@Param("id") int id);
}
