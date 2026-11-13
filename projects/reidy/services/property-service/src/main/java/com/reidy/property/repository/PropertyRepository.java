package com.reidy.property.repository;

import com.reidy.property.entity.Property;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

// Spring Data generates standard CRUD implementations; explicit query methods add database behavior
// required by this service.
//
// Provides database queries for property records without exposing SQL to controllers.
public interface PropertyRepository
        extends JpaRepository<Property, Long>, JpaSpecificationExecutor<Property> {
    @org.springframework.data.jpa.repository.Lock(
            jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select p from Property p where p.id = :id")
    java.util.Optional<Property> lockProperty(
            @org.springframework.data.repository.query.Param("id") long id);
}
