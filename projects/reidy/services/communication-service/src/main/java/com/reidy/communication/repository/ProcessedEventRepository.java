package com.reidy.communication.repository;

import com.reidy.communication.entity.ProcessedEvent;
import org.springframework.data.jpa.repository.JpaRepository;

// The event UUID is the marker key; checking it is meaningful only alongside transactionally
// committed notification writes.
//
// Enforces event identity uniqueness independently of Kafka offset commits.
// Spring Data creates a repository proxy; generic entity and ID types provide compile-time safety,
// while database constraints enforce persisted invariants.
public interface ProcessedEventRepository extends JpaRepository<ProcessedEvent, String> {}
