package com.reidy.appraisal.repository;

import com.reidy.appraisal.entity.CreditTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

// The ledger is written alongside the report and balance update; repository persistence alone does
// not define the transaction boundary.
//
// Provides database queries for credit transaction records without exposing SQL to controllers.
// Spring Data creates a repository proxy; generic entity and ID types provide compile-time safety,
// while database constraints enforce persisted invariants.
public interface CreditTransactionRepository extends JpaRepository<CreditTransaction, Long> {}
