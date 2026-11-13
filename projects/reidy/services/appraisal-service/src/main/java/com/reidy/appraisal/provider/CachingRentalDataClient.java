package com.reidy.appraisal.provider;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.reidy.appraisal.dto.RentalData;
import com.reidy.appraisal.dto.RentalEndpoint;
import com.reidy.appraisal.service.RentalCacheStore;
import com.reidy.platform.exception.ApiException;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Duration;
import java.util.concurrent.locks.LockSupport;
import org.springframework.beans.factory.annotation.*;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

// The primary bean is the outer decorator: cache lookup happens before resilient provider
// execution.
//
// Adds database caching around the transport interface without changing its public contract.
@Component
// Spring: prefer this bean for an unqualified single-value injection; explicit Qualifier selection
// still takes precedence.
@Primary
public class CachingRentalDataClient implements RentalDataClient {
    private final RentalDataClient delegate;
    private final RentalCacheStore cache;
    private final ObjectMapper json;
    private final MeterRegistry metrics;
    private final Duration wait;

    public CachingRentalDataClient(
            @Qualifier("resilientRentalDataClient") RentalDataClient delegate,
            RentalCacheStore cache,
            ObjectMapper json,
            MeterRegistry metrics,
            @Value("${rental.cache.concurrent-wait:2s}") Duration wait) {
        this.delegate = delegate;
        this.cache = cache;
        this.json = json;
        this.metrics = metrics;
        this.wait = wait;
    }

    public RentalData fetch(long propertyId, RentalEndpoint endpoint) {
        // Use monotonic time for elapsed waiting so wall-clock adjustments cannot extend the
        // request budget.
        long deadline = System.nanoTime() + wait.toNanos();
        RentalCacheStore.Lookup lookup;
        while (true) {
            lookup = cache.acquire(propertyId, endpoint);
            if (!lookup.busy()) break;
            if (System.nanoTime() >= deadline || Thread.currentThread().isInterrupted())
                throw new ApiException(
                        HttpStatus.SERVICE_UNAVAILABLE, "Rental refresh in progress; retry later");
            // Wait outside every database transaction. A crashed refresher loses its lease after 15
            // seconds.
            // Java concurrency: parking can return early or spuriously; the loop must recheck lease
            // state, interruption and its deadline.
            LockSupport.parkNanos(Duration.ofMillis(25).toNanos());
        }
        metrics.counter(
                        "rental.cache.requests",
                        "endpoint",
                        endpoint.name(),
                        "result",
                        lookup.result())
                .increment();
        // A cache hit returns before the resilience decorator or transport is invoked.
        if (lookup.payload() != null) {
            try {
                return json.readValue(lookup.payload(), RentalData.class);
            } catch (com.fasterxml.jackson.core.JsonProcessingException error) {
                throw new IllegalStateException("Invalid rental cache JSON", error);
            }
        }
        String token = lookup.token();
        try {
            // The provider call runs after acquire has returned and released its database
            // transaction.
            RentalData result = delegate.fetch(propertyId, endpoint);
            cache.complete(propertyId, endpoint, token, json.writeValueAsString(result));
            return result;
        } catch (Exception error) {
            try {
                cache.release(propertyId, endpoint, token);
            } catch (Exception releaseError) {
                // Preserve the original failure while retaining lease-cleanup failure details for
                // diagnosis.
                error.addSuppressed(releaseError);
            }
            // Java exceptions: preserve unchecked failures; checked serialization failures are
            // wrapped so callers receive a consistent unchecked API.
            if (error instanceof RuntimeException runtime) throw runtime;
            throw new IllegalStateException("Cannot serialize rental result", error);
        }
    }
}
