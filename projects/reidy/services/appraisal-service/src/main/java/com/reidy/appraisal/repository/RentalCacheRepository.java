package com.reidy.appraisal.repository;

import com.reidy.appraisal.dto.RentalEndpoint;
import com.reidy.appraisal.entity.RentalCacheEntry;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

// Property and endpoint together identify cached data because one property can have several
// independent rental resources.
//
// Provides database queries for rental cache records without exposing SQL to controllers.
// Spring Data creates a repository proxy; generic entity and ID types provide compile-time safety,
// while database constraints enforce persisted invariants.
public interface RentalCacheRepository extends JpaRepository<RentalCacheEntry, Long> {
    Optional<RentalCacheEntry> findByPropertyIdAndEndpoint(
            long propertyId, RentalEndpoint endpoint);
}
