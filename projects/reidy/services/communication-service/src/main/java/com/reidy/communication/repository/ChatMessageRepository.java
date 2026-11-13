package com.reidy.communication.repository;

import com.reidy.communication.entity.ChatMessage;
import java.util.Optional;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;

// Queries combine conversation scope with retry keys or sequence cursors, matching the chat
// service's two retrieval paths.
//
// Provides database queries for chat message records without exposing SQL to controllers.
// Spring Data creates a repository proxy; generic entity and ID types provide compile-time safety,
// while database constraints enforce persisted invariants.
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    Optional<ChatMessage> findByConversationIdAndSenderIdAndClientMessageId(
            long conversationId, String senderId, String clientMessageId);

    Page<ChatMessage> findByConversationIdAndSequenceNumberGreaterThanOrderBySequenceNumberAsc(
            long conversationId, long after, Pageable pageable);
}
