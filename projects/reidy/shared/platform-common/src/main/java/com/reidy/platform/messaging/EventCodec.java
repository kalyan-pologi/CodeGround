package com.reidy.platform.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.reidy.contracts.event.PlatformEvent;
import com.reidy.platform.exception.InvalidEventException;
import org.springframework.stereotype.Component;

// Explicit envelope validation rejects unsupported or malformed input before notification business
// logic touches the database.
//
// Deserializes only the known envelope type; broker messages never select arbitrary Java classes.
@Component
public class EventCodec {
    private final ObjectMapper json;

    public EventCodec(ObjectMapper json) {
        this.json = json;
    }

    public PlatformEvent decode(String payload) {
        try {
            var event = json.readValue(payload, PlatformEvent.class);
            validate(event);
            return event;
        } catch (InvalidEventException error) {
            throw error;
        } catch (Exception error) {
            throw new InvalidEventException("Malformed event envelope", error);
        }
    }

    public String encode(PlatformEvent event) {
        validate(event);
        try {
            return json.writeValueAsString(event);
        } catch (Exception error) {
            throw new InvalidEventException("Cannot serialize event envelope", error);
        }
    }

    private void validate(PlatformEvent event) {
        if (event == null
                || event.id() == null
                || event.schemaVersion() != 1
                || event.type() == null
                || event.occurredAt() == null
                || event.aggregateId() == null
                || event.aggregateId().isBlank()
                || event.aggregateId().length() > 100
                || event.subject() == null
                || event.subject().length() > 1000
                || event.recipients() == null
                || event.recipients().isEmpty()
                || event.recipients().size() > 20)
            throw new InvalidEventException("Unsupported or incomplete event envelope");
        for (String recipient : event.recipients())
            if (recipient.isBlank() || recipient.length() > 100)
                throw new InvalidEventException("Invalid event recipient");
    }
}
