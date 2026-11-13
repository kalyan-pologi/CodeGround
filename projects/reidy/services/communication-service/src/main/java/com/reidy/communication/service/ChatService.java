package com.reidy.communication.service;

import com.reidy.communication.dto.ChatMessageCommitted;
import com.reidy.communication.dto.ChatMessageRequest;
import com.reidy.communication.dto.ChatMessageResponse;
import com.reidy.communication.dto.ConversationRequest;
import com.reidy.communication.dto.ConversationResponse;
import com.reidy.communication.entity.ChatMessage;
import com.reidy.communication.entity.Conversation;
import com.reidy.communication.repository.ChatMessageRepository;
import com.reidy.communication.repository.ConversationRepository;
import com.reidy.contracts.event.PlatformEvent;
import com.reidy.platform.exception.ApiException;
import com.reidy.platform.provider.PropertyClient;
import com.reidy.platform.service.NotificationPublisher;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// A conversation lock protects sequence allocation; client message IDs make retries return the
// original persisted message.
//
// Serializes message allocation and retry handling while keeping live delivery outside the database
// transaction.
// Spring: a service is a component-scanned bean; singleton scope shares this instance across
// request threads, so request state must remain local.
@Service
public class ChatService {
    private final ConversationRepository conversations;
    private final ChatMessageRepository messages;
    private final PropertyClient properties;
    private final ConversationStore conversationStore;
    private final ApplicationEventPublisher events;
    private final NotificationPublisher notifications;

    public ChatService(
            ConversationRepository conversations,
            ChatMessageRepository messages,
            PropertyClient properties,
            ConversationStore conversationStore,
            ApplicationEventPublisher events,
            NotificationPublisher notifications) {
        this.conversations = conversations;
        this.messages = messages;
        this.properties = properties;
        this.conversationStore = conversationStore;
        this.events = events;
        this.notifications = notifications;
    }

    // Remote validation finishes before the local conversation transaction begins.
    public ConversationResponse create(ConversationRequest request) {
        if (request.propertyId() != null) properties.get(request.propertyId());
        return conversationStore.create(request);
    }

    // Transactions: readOnly is an optimization hint, not authorization or guaranteed write
    // prevention; default propagation still joins an existing transaction.
    @Transactional(readOnly = true)
    public ConversationResponse get(long id, String userId) {
        var c = conversations.findById(id).orElseThrow(() -> missing());
        requireMember(c, userId);
        return response(c);
    }

    // Transactions: proxy-intercepted calls use REQUIRED propagation by default; unchecked
    // exceptions and Errors trigger rollback unless rules override it.
    @Transactional
    public ChatMessageResponse send(long id, ChatMessageRequest request) {
        // Serializes sequence allocation and retries within this conversation across JVMs.
        var c = conversations.lockConversation(id).orElseThrow(() -> missing());
        requireMember(c, request.senderId());
        var previous =
                messages.findByConversationIdAndSenderIdAndClientMessageId(
                        id, request.senderId(), request.clientMessageId());
        // Reuse the stored response for a retry, but reject reuse of its key with different
        // content.
        if (previous.isPresent()) {
            if (!previous.get().content.equals(request.content()))
                throw new ApiException(
                        HttpStatus.CONFLICT, "Message key already used with different content");
            return response(previous.get());
        }
        var m = new ChatMessage();
        m.conversation = c;
        m.senderId = request.senderId();
        m.clientMessageId = request.clientMessageId();
        m.content = request.content();
        // Allocate the next conversation-local sequence while the conversation row remains locked.
        m.sequenceNumber = ++c.nextSequence;
        m.sentAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
        messages.save(m);
        var result = response(m);
        // The transaction-bound listener delivers live messages only after this database
        // transaction commits.
        events.publishEvent(new ChatMessageCommitted(result));
        // Java: copy the participant set before removing the sender; mutating the managed
        // collection would change conversation membership.
        var recipients = new HashSet<>(c.participants);
        // Notify the other participants rather than creating an inbox notification for the sender.
        recipients.remove(m.senderId);
        notifications.publish(
                PlatformEvent.create(
                        PlatformEvent.Type.NEW_CHAT_MESSAGE,
                        Long.toString(id),
                        recipients,
                        "conversation " + id));
        return result;
    }

    // Transactions: readOnly is an optimization hint, not authorization or guaranteed write
    // prevention; default propagation still joins an existing transaction.
    @Transactional(readOnly = true)
    public Page<ChatMessageResponse> messages(long id, String userId, long after, int size) {
        // Enforce membership before querying message history, even when the requested page would be
        // empty.
        // Spring proxies: this self-call does not start a separate read-only transaction;
        // messages() already supplies the transaction boundary.
        get(id, userId);
        if (after < 0 || size < 1 || size > 100)
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "after must be nonnegative; size must be 1-100");
        return messages.findByConversationIdAndSequenceNumberGreaterThanOrderBySequenceNumberAsc(
                        id, after, PageRequest.of(0, size))
                .map(this::response);
    }

    private void requireMember(Conversation c, String userId) {
        if (!c.participants.contains(userId))
            throw new ApiException(HttpStatus.FORBIDDEN, "User is not a conversation participant");
    }

    private ApiException missing() {
        return new ApiException(HttpStatus.NOT_FOUND, "Conversation not found");
    }

    private ConversationResponse response(Conversation c) {
        return new ConversationResponse(
                // Java: Set.copyOf returns an unmodifiable snapshot; String elements are immutable,
                // but the general operation is only a shallow copy.
                c.id, c.propertyId, Set.copyOf(c.participants), c.createdAt);
    }

    private ChatMessageResponse response(ChatMessage m) {
        return new ChatMessageResponse(
                m.id,
                m.conversation.id,
                m.senderId,
                m.clientMessageId,
                m.content,
                m.sequenceNumber,
                m.sentAt);
    }
}
