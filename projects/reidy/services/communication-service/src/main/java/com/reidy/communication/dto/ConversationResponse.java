package com.reidy.communication.dto;

import java.time.Instant;
import java.util.Set;

// The response exposes conversation metadata while message history remains a separate paginated
// resource.
//
// Returns conversation metadata without exposing persistence collections or entity lifecycle
// behavior.
// Java records generate component accessors, equals, hashCode and toString; final component
// references do not imply deep immutability.
public record ConversationResponse(
        Long id, Long propertyId, Set<String> participants, Instant createdAt) {}
