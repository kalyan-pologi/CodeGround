package com.reidy.communication.service;

import com.reidy.communication.repository.NotificationTemplateRepository;
import com.reidy.contracts.event.PlatformEvent;
import java.time.Duration;
import org.slf4j.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

// Redis stores reusable template text; the database remains the fallback source when cache access
// fails.
//
// Loads database templates with optional Redis caching and graceful fallback when Redis fails.
// Spring: a service is a component-scanned bean; singleton scope shares this instance across
// request threads, so request state must remain local.
@Service
public class NotificationTemplateService {
    private static final Logger log = LoggerFactory.getLogger(NotificationTemplateService.class);
    private final NotificationTemplateRepository templates;
    private final StringRedisTemplate redis;
    private final boolean redisEnabled;
    private final Duration ttl;
    private final io.github.resilience4j.circuitbreaker.CircuitBreaker breaker;

    public NotificationTemplateService(
            NotificationTemplateRepository templates,
            StringRedisTemplate redis,
            @Value("${notifications.redis-enabled:false}") boolean redisEnabled,
            @Value("${notifications.template-ttl:PT1H}") Duration ttl,
            io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry breakers) {
        this.templates = templates;
        this.redis = redis;
        this.redisEnabled = redisEnabled;
        this.ttl = ttl;
        this.breaker = breakers.circuitBreaker("redis-templates");
    }

    public String render(PlatformEvent event) {
        String key = "reidy:template:" + event.type().name();
        String body = null;
        if (redisEnabled) {
            try {
                body = breaker.executeSupplier(() -> redis.opsForValue().get(key));
            } catch (RuntimeException e) {
                log.warn("event=template_cache_unavailable operation=read");
            }
        }
        // A cache miss and cache outage use the same database fallback path.
        if (body == null) {
            body =
                    templates
                            .findById(event.type().name())
                            .orElseThrow(
                                    () ->
                                            new IllegalStateException(
                                                    "Notification template missing"))
                            .body;
            if (redisEnabled) {
                try {
                    String templateBody = body;
                    breaker.executeRunnable(() -> redis.opsForValue().set(key, templateBody, ttl));
                } catch (RuntimeException e) {
                    log.warn("event=template_cache_unavailable operation=write");
                }
            }
        }
        // Cache the reusable template, then substitute this event's subject only for its rendered
        // notification.
        return body.replace("{subject}", event.subject());
    }
}
