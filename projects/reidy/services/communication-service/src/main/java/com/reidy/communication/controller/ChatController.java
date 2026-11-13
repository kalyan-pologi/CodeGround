package com.reidy.communication.controller;

import com.reidy.communication.dto.ChatMessageRequest;
import com.reidy.communication.dto.ChatMessageResponse;
import com.reidy.communication.dto.ConversationRequest;
import com.reidy.communication.dto.ConversationResponse;
import com.reidy.communication.service.ChatService;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.data.domain.Page;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

// Identity checks protect caller-supplied user IDs; conversation membership checks remain inside
// the business service.
//
// Exposes persistent conversation and message operations with participant identity checks.
// Spring MVC: response values pass through HTTP message converters, typically Jackson JSON, rather
// than resolving a server-side view.
@RestController
@RequestMapping("/api/conversations")
public class ChatController {
    private final ChatService chat;
    private final com.reidy.platform.service.ActorIdentity actor;

    public ChatController(ChatService chat, com.reidy.platform.service.ActorIdentity actor) {
        this.chat = chat;
        this.actor = actor;
    }

    @PostMapping
    public ResponseEntity<ConversationResponse> create(
            @Valid @RequestBody ConversationRequest request) {
        actor.requireParticipant(request.participants());
        var result = chat.create(request);
        return ResponseEntity.created(URI.create("/api/conversations/" + result.id())).body(result);
    }

    @GetMapping("/{id}")
    public ConversationResponse get(@PathVariable long id, @RequestParam String userId) {
        actor.requireIdentity(userId);
        return chat.get(id, userId);
    }

    @PostMapping("/{id}/messages")
    public ChatMessageResponse send(
            @PathVariable long id, @Valid @RequestBody ChatMessageRequest request) {
        actor.requireIdentity(request.senderId());
        return chat.send(id, request);
    }

    @GetMapping("/{id}/messages")
    public Page<ChatMessageResponse> messages(
            @PathVariable long id,
            @RequestParam String userId,
            @RequestParam(defaultValue = "0") long after,
            @RequestParam(defaultValue = "50") int size) {
        actor.requireIdentity(userId);
        return chat.messages(id, userId, after, size);
    }
}
