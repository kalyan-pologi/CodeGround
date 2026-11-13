package com.reidy.communication.dto;

// This is an in-process Spring event for post-commit live delivery, distinct from the durable Kafka
// business-event envelope.
//
// Carries a saved message to the after-commit live delivery listener.
// Java records generate component accessors, equals, hashCode and toString; final component
// references do not imply deep immutability.
public record ChatMessageCommitted(ChatMessageResponse message) {}
