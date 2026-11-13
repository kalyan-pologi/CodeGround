package com.reidy.communication.config;

import com.reidy.communication.service.ChatService;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.*;
import org.springframework.messaging.simp.config.*;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.messaging.support.*;
import org.springframework.web.socket.config.annotation.*;

// Handshake access and STOMP subscription checks serve different purposes; conversation
// authorization must also apply to inbound messaging frames.
//
// Configures STOMP destinations and checks participant access before allowing conversation
// subscriptions.
// Spring: configuration classes declare bean definitions; container-managed beans receive
// dependency injection and lifecycle callbacks.
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    private final ChatService chat;
    private final org.springframework.core.env.Environment environment;

    public WebSocketConfig(ChatService chat, org.springframework.core.env.Environment environment) {
        this.chat = chat;
        this.environment = environment;
    }

    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws");
    }

    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Spring messaging: the simple broker is process-local; it does not share subscriptions or
        // messages across multiple service instances.
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
    }

    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(
                // Java: this anonymous class implements message interception behavior; Spring
                // invokes it before inbound STOMP messages reach handlers.
                new ChannelInterceptor() {
                    public Message<?> preSend(Message<?> message, MessageChannel channel) {
                        var headers =
                                MessageHeaderAccessor.getAccessor(
                                        message, StompHeaderAccessor.class);
                        if (headers == null) return message;
                        if (headers.getCommand() == StompCommand.CONNECT) {
                            if (environment.acceptsProfiles(
                                    org.springframework.core.env.Profiles.of("prod", "uat"))) {
                                if (headers.getUser() == null)
                                    throw new MessagingException(
                                            "Authenticated WebSocket handshake required");
                                return message;
                            }
                            String userId = headers.getFirstNativeHeader("userId");
                            if (userId == null || userId.isBlank() || userId.length() > 100)
                                throw new MessagingException(
                                        "CONNECT requires a demo userId header");
                            headers.setUser(() -> userId);
                        }
                        if (headers.getCommand() == StompCommand.SEND
                                || headers.getCommand() == StompCommand.SUBSCRIBE) {
                            if (headers.getUser() == null)
                                throw new MessagingException("Connect first");
                            String destination = headers.getDestination();
                            if (headers.getCommand() == StompCommand.SEND) {
                                if (destination == null
                                        || !destination.matches(
                                                "/app/conversations/[0-9]+/messages"))
                                    throw new MessagingException("Unsupported SEND destination");
                            } else if (!"/user/queue/errors".equals(destination)) {
                                if (destination == null
                                        || !destination.matches("/topic/conversations/[0-9]+"))
                                    throw new MessagingException("Unsupported subscription");
                                long id =
                                        Long.parseLong(
                                                destination.substring(
                                                        destination.lastIndexOf('/') + 1));
                                chat.get(id, headers.getUser().getName());
                            }
                        }
                        return message;
                    }
                });
    }

    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        registration
                .setMessageSizeLimit(16 * 1024)
                .setSendBufferSizeLimit(64 * 1024)
                .setSendTimeLimit(10000);
    }
}
