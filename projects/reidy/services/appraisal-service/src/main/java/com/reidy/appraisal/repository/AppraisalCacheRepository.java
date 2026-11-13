package com.reidy.appraisal.repository;

import com.reidy.appraisal.entity.AppraisalCache;
import org.springframework.data.jpa.repository.JpaRepository;

// The property ID is the cache key, so retrieving a free report does not require joining
// property-service tables.
//
// Provides database queries for appraisal cache records without exposing SQL to controllers.
// Spring Data creates a repository proxy; generic entity and ID types provide compile-time safety,
// while database constraints enforce persisted invariants.
public interface AppraisalCacheRepository extends JpaRepository<AppraisalCache, Long> {}
