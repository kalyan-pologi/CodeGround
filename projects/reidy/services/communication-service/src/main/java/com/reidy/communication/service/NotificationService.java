package com.reidy.communication.service;

import com.reidy.communication.entity.Notification;
import com.reidy.communication.repository.NotificationRepository;
import com.reidy.platform.exception.ApiException;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Pagination limits bound database work and response size; recipient authorization is handled by
// the calling controller.
//
// Reads inbox records through a service boundary with bounded pagination.
// Spring: a service is a component-scanned bean; singleton scope shares this instance across
// request threads, so request state must remain local.
@Service
public class NotificationService {
    private final NotificationRepository notifications;

    public NotificationService(NotificationRepository notifications) {
        this.notifications = notifications;
    }

    // Transactions: readOnly is an optimization hint, not authorization or guaranteed write
    // prevention; default propagation still joins an existing transaction.
    @Transactional(readOnly = true)
    public Page<Notification> list(String recipient, int page, int size) {
        if (recipient.isBlank() || recipient.length() > 100 || page < 0 || size < 1 || size > 100)
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid recipient or pagination");
        return notifications.findByRecipientOrderByIdDesc(recipient, PageRequest.of(page, size));
    }
}
