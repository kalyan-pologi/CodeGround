package com.reidy.communication.dto;

import java.time.Instant;

// The sequence number is scoped to a conversation; clients use it as a cursor when recovering
// missed live messages.
//
// Returns durable message ordering information so clients can recover missed live deliveries.
// Java records generate component accessors, equals, hashCode and toString; final component
// references do not imply deep immutability.
public record ChatMessageResponse(
        Long id,
        Long conversationId,
        String senderId,
        String clientMessageId,
        String content,
        long sequenceNumber,
        Instant sentAt) {}
