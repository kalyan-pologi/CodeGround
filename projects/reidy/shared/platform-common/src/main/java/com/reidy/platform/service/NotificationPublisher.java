package com.reidy.platform.service;

import com.reidy.contracts.event.PlatformEvent;

// The interface separates business services from publication storage; implementations decide how
// event intent is recorded.
//
// Defines durable event publication without requiring business services to know delivery
// infrastructure.
public interface NotificationPublisher {
    void publish(PlatformEvent event);
}
