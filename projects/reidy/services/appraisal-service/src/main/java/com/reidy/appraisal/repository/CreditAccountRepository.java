package com.reidy.appraisal.repository;

import com.reidy.appraisal.entity.CreditAccount;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

// The pessimistic lock must be acquired inside a transaction so it protects the balance check and
// subsequent update.
//
// Provides database queries for credit account records without exposing SQL to controllers.
// Spring Data creates a repository proxy; generic entity and ID types provide compile-time safety,
// while database constraints enforce persisted invariants.
public interface CreditAccountRepository extends JpaRepository<CreditAccount, Long> {
    // JPA locking: the database holds a write lock until transaction completion; other processes
    // using this database must respect conflicting locks.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    // Spring Data: this query uses JPQL entity and attribute names unless nativeQuery is enabled;
    // it is not necessarily literal table SQL.
    @Query("select a from CreditAccount a where a.id = :id")
    CreditAccount lockAccount(@Param("id") Long id);
}
