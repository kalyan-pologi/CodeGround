package com.reidy.platform.config;

import com.reidy.platform.exception.RemoteServiceException;
import io.github.resilience4j.bulkhead.*;
import io.github.resilience4j.circuitbreaker.*;
import io.github.resilience4j.core.IntervalFunction;
import io.github.resilience4j.micrometer.tagged.*;
import io.github.resilience4j.ratelimiter.*;
import io.github.resilience4j.retry.*;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;

// Retry addresses transient errors, the circuit breaker rejects calls during sustained failure, and
// the bulkhead limits concurrent work.
//
// Creates shared resilience policies and exports circuit, retry, and bulkhead metrics.
// Spring: configuration classes declare bean definitions; container-managed beans receive
// dependency injection and lifecycle callbacks.
@Configuration
public class ResilienceConfig {
    @Bean
    public CircuitBreakerRegistry circuitBreakers(
            MeterRegistry metrics,
            @Value("${resilience.breaker.window-size:20}") int window,
            @Value("${resilience.breaker.minimum-calls:10}") int minimumCalls,
            @Value("${resilience.breaker.open-duration:20s}") Duration openDuration) {
        var config =
                CircuitBreakerConfig.custom()
                        .slidingWindowSize(window)
                        .minimumNumberOfCalls(minimumCalls)
                        .failureRateThreshold(50)
                        .waitDurationInOpenState(openDuration)
                        .permittedNumberOfCallsInHalfOpenState(3)
                        .automaticTransitionFromOpenToHalfOpenEnabled(true)
                        .build();
        var registry = CircuitBreakerRegistry.of(config);
        TaggedCircuitBreakerMetrics.ofCircuitBreakerRegistry(registry).bindTo(metrics);
        registry.getEventPublisher()
                .onEntryAdded(
                        event ->
                                event.getAddedEntry()
                                        .getEventPublisher()
                                        .onStateTransition(
                                                change ->
                                                        org.slf4j.LoggerFactory.getLogger(
                                                                        ResilienceConfig.class)
                                                                .atWarn()
                                                                .addKeyValue(
                                                                        "dependency",
                                                                        change
                                                                                .getCircuitBreakerName())
                                                                .addKeyValue(
                                                                        "transition",
                                                                        change.getStateTransition())
                                                                .log("circuit_state_changed")));
        return registry;
    }

    @Bean
    public BulkheadRegistry bulkheads(
            MeterRegistry metrics, @Value("${resilience.rental.max-concurrent:8}") int concurrent) {
        var registry =
                BulkheadRegistry.of(
                        BulkheadConfig.custom()
                                .maxConcurrentCalls(concurrent)
                                .maxWaitDuration(Duration.ZERO)
                                .build());
        TaggedBulkheadMetrics.ofBulkheadRegistry(registry).bindTo(metrics);
        return registry;
    }

    @Bean
    public RetryRegistry retries(
            MeterRegistry metrics, @Value("${resilience.rental.max-attempts:2}") int attempts) {
        var config =
                RetryConfig.custom()
                        .maxAttempts(attempts)
                        .intervalFunction(
                                IntervalFunction.ofExponentialRandomBackoff(100L, 2.0, 0.5))
                        .retryOnException(
                                error ->
                                        error instanceof RemoteServiceException provider
                                                && provider.retryable())
                        .build();
        var registry = RetryRegistry.of(config);
        TaggedRetryMetrics.ofRetryRegistry(registry).bindTo(metrics);
        return registry;
    }

    @Bean
    public RateLimiter apiRateLimiter(
            @Value("${resilience.api.requests-per-second:100}") int permits) {
        return RateLimiter.of(
                "api",
                RateLimiterConfig.custom()
                        .limitForPeriod(permits)
                        .limitRefreshPeriod(Duration.ofSeconds(1))
                        .timeoutDuration(Duration.ZERO)
                        .build());
    }
}
