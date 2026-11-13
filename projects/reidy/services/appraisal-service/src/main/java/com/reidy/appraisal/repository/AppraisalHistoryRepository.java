package com.reidy.appraisal.repository;

import com.reidy.appraisal.entity.AppraisalHistory;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

// Idempotency lookup retrieves the original purchase instead of recalculating a valuation or
// creating another debit.
//
// Provides database queries for appraisal history records without exposing SQL to controllers.
// Spring Data creates a repository proxy; generic entity and ID types provide compile-time safety,
// while database constraints enforce persisted invariants.
public interface AppraisalHistoryRepository extends JpaRepository<AppraisalHistory, Long> {
    Optional<AppraisalHistory> findByIdempotencyKey(String key);
}
