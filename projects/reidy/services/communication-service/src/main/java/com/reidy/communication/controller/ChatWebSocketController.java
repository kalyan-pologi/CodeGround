package com.reidy.communication.controller;

import com.reidy.communication.dto.ChatMessageRequest;
import com.reidy.communication.service.ChatService;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.messaging.handler.annotation.*;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;

// STOMP messages use the same chat service as HTTP requests, keeping persistence and duplicate
// handling consistent.
//
// Accepts live chat commands while using the same persistence service as REST requests.
@Controller
public class ChatWebSocketController {
    private final ChatService chat;

    public ChatWebSocketController(ChatService chat) {
        this.chat = chat;
    }

    @MessageMapping("/conversations/{id}/messages")
    public void send(
            @DestinationVariable long id, @Valid ChatMessageRequest request, Principal principal) {
        if (principal == null || !principal.getName().equals(request.senderId()))
            throw new IllegalArgumentException("Sender must match CONNECT userId");
        chat.send(id, request);
    }

    @MessageExceptionHandler
    @SendToUser("/queue/errors")
    public java.util.Map<String, String> error(Exception error) {
        return java.util.Map.of(
                "error",
                "Message rejected; verify participant, message fields, and clientMessageId");
    }
}
