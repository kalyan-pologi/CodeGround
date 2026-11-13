package com.reidy.communication.repository;

import com.reidy.communication.entity.NotificationTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

// The event type acts as the template identifier, allowing rendering to select text without a
// producer-specific dependency.
//
// Provides database queries for notification template records without exposing SQL to controllers.
public interface NotificationTemplateRepository
        extends JpaRepository<NotificationTemplate, String> {}
