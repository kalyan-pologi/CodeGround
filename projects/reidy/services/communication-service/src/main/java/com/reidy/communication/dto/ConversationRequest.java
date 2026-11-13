package com.reidy.communication.dto;

import jakarta.validation.constraints.*;
import java.util.Set;

// Participants describe the requested conversation; the controller separately verifies that a
// secured caller may create it.
//
// Defines conversation participants and an optional property reference for a new discussion.
// Java records generate component accessors, equals, hashCode and toString; final component
// references do not imply deep immutability.
public record ConversationRequest(
        Long propertyId,
        @NotNull @Size(min = 2, max = 20) Set<@NotBlank @Size(max = 100) String> participants) {}
