package com.reidy.platform.controller;

import com.reidy.platform.entity.NotificationOutbox.Status;
import com.reidy.platform.service.NotificationOutboxStore;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

// Replay schedules another background attempt; an accepted HTTP response does not mean Kafka has
// already received the event.
//
// Exposes outbox inspection and replay operations for authorized support staff.
// Spring MVC: response values pass through HTTP message converters, typically Jackson JSON, rather
// than resolving a server-side view.
@RestController
@RequestMapping("/api/ops/outbox")
public class OutboxOperationsController {
    private final NotificationOutboxStore outbox;

    public OutboxOperationsController(NotificationOutboxStore outbox) {
        this.outbox = outbox;
    }

    @GetMapping
    public Page<NotificationOutboxStore.Summary> list(
            @RequestParam(defaultValue = "DEAD") Status status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return outbox.list(status, page, size);
    }

    @PostMapping("/{id}/replay")
    @ResponseStatus(org.springframework.http.HttpStatus.ACCEPTED)
    // Requeues exhausted work after an operator has corrected the underlying failure.
    public void replay(@PathVariable String id) {
        outbox.replay(id);
    }
}
