package com.reidy.communication.dto;

import jakarta.validation.constraints.*;

// Clients should reuse the same message ID after a timeout so retry handling can find the original
// write.
//
// Carries message content and a client-generated retry key to prevent duplicate messages.
// Java records generate component accessors, equals, hashCode and toString; final component
// references do not imply deep immutability.
public record ChatMessageRequest(
        @NotBlank @Size(max = 100) String senderId,
        @NotBlank @Size(max = 100) String clientMessageId,
        @NotBlank @Size(max = 4000) String content) {}
