package com.reidy.communication.service;

import com.reidy.communication.dto.*;
import com.reidy.communication.entity.Conversation;
import com.reidy.communication.repository.ConversationRepository;
import java.time.Instant;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Keeping persistence in a separate bean lets the caller finish remote property validation before
// Spring opens this transaction.
//
// Persists conversations only after optional remote validation has completed outside this
// transaction.
// Spring: a service is a component-scanned bean; singleton scope shares this instance across
// request threads, so request state must remain local.
@Service
public class ConversationStore {
    private final ConversationRepository conversations;

    public ConversationStore(ConversationRepository conversations) {
        this.conversations = conversations;
    }

    // Transactions: proxy-intercepted calls use REQUIRED propagation by default; unchecked
    // exceptions and Errors trigger rollback unless rules override it.
    @Transactional
    public ConversationResponse create(ConversationRequest request) {
        var conversation = new Conversation();
        conversation.propertyId = request.propertyId();
        conversation.participants.addAll(request.participants());
        conversation.createdAt = Instant.now();
        conversations.save(conversation);
        return new ConversationResponse(
                conversation.id,
                conversation.propertyId,
                Set.copyOf(conversation.participants),
                conversation.createdAt);
    }
}
