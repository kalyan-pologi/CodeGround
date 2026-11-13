package com.reidy.communication.service;

import com.reidy.communication.dto.ChatMessageCommitted;
import org.slf4j.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

// Live WebSocket delivery is a convenience channel; clients recover missed messages from persisted
// chat history.
//
// Attempts live broadcasts only after persistence commits; REST history remains the recovery
// source.
@Component
public class ChatDeliveryListener {
    private static final Logger log = LoggerFactory.getLogger(ChatDeliveryListener.class);
    private final SimpMessagingTemplate socket;

    public ChatDeliveryListener(SimpMessagingTemplate socket) {
        this.socket = socket;
    }

    // Spring async: intercepted execution moves to this executor; caller transaction and security
    // ThreadLocals are not automatically copied.
    @Async("deliveryExecutor")
    // Spring events: the default phase is AFTER_COMMIT; without a transaction,
    // fallbackExecution=false means this listener is not invoked.
    @TransactionalEventListener
    public void deliver(ChatMessageCommitted event) {
        try {
            socket.convertAndSend(
                    "/topic/conversations/" + event.message().conversationId(), event.message());
        } catch (Exception e) {
            log.warn("event=chat_delivery_failed messageId={}", event.message().id(), e);
        }
    }
}
