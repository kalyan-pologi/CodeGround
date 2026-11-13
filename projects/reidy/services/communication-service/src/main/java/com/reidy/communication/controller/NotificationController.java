package com.reidy.communication.controller;

import com.reidy.communication.entity.Notification;
import com.reidy.communication.service.NotificationService;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

// Inbox access checks the requested recipient against the authenticated subject in UAT and
// production.
//
// Reads the caller?s notification inbox with bounded pagination.
// Spring MVC: response values pass through HTTP message converters, typically Jackson JSON, rather
// than resolving a server-side view.
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private final NotificationService notifications;
    private final com.reidy.platform.service.ActorIdentity actor;

    public NotificationController(
            NotificationService notifications, com.reidy.platform.service.ActorIdentity actor) {
        this.notifications = notifications;
        this.actor = actor;
    }

    @GetMapping
    public Page<Notification> list(
            @RequestParam String recipient,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        actor.requireIdentity(recipient);
        return notifications.list(recipient, page, size);
    }
}
