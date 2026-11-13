package com.reidy.contracts.event;

import java.util.List;

// Versioned topic names make contract boundaries explicit; changing an event schema still requires
// coordinating producer and consumer compatibility.
//
// Topic names include contract versions so incompatible event schemas can evolve deliberately.
public final class EventTopics {
    public static final String PROPERTY_CREATED = "reidy.property.created.v1";
    public static final String APPRAISAL_COMPLETED = "reidy.appraisal.completed.v1";
    public static final String CHAT_MESSAGE_CREATED = "reidy.chat.message.created.v1";

    private EventTopics() {}

    public static List<String> all() {
        return List.of(PROPERTY_CREATED, APPRAISAL_COMPLETED, CHAT_MESSAGE_CREATED);
    }

    public static String forType(PlatformEvent.Type type) {
        return switch (type) {
            case PROPERTY_CREATED -> PROPERTY_CREATED;
            case APPRAISAL_COMPLETED -> APPRAISAL_COMPLETED;
            case NEW_CHAT_MESSAGE -> CHAT_MESSAGE_CREATED;
        };
    }
}
