package com.reidy.appraisal;

import static org.junit.jupiter.api.Assertions.*;

import com.reidy.appraisal.dto.RentalData;
import com.reidy.appraisal.dto.RentalEndpoint;
import com.reidy.appraisal.provider.RentalDataClient;
import com.reidy.appraisal.provider.ResilientRentalDataClient;
import com.reidy.platform.exception.RentalProviderException;
import io.github.resilience4j.bulkhead.*;
import io.github.resilience4j.circuitbreaker.*;
import io.github.resilience4j.retry.*;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

// Failure scenarios exercise the decorated rental path, where cache coordination and provider
// resilience interact.
//
// Checks important rental resilience behavior without contacting real customer or paid systems.
class RentalResilienceTest {
    ResilientRentalDataClient client(RentalDataClient delegate, CircuitBreakerRegistry breakers) {
        var retry =
                RetryConfig.custom()
                        .maxAttempts(2)
                        .waitDuration(Duration.ofMillis(1))
                        .retryOnException(
                                error ->
                                        error instanceof RentalProviderException provider
                                                && provider.retryable())
                        .build();
        return new ResilientRentalDataClient(
                delegate, breakers, BulkheadRegistry.ofDefaults(), RetryRegistry.of(retry));
    }

    @Test
    void retriesOnlyTransientReadsAndOpenCircuitStopsProviderCalls() {
        var calls = new AtomicInteger();
        var breakers = CircuitBreakerRegistry.ofDefaults();
        var successful =
                client(
                        (id, endpoint) -> {
                            if (calls.incrementAndGet() == 1)
                                throw new RentalProviderException(true, null);
                            return new RentalData(endpoint, null, null, List.of());
                        },
                        breakers);
        successful.fetch(1, RentalEndpoint.RENTAL_ESTIMATE);
        assertEquals(2, calls.get());
        var permanentCalls = new AtomicInteger();
        var permanent =
                client(
                        (id, endpoint) -> {
                            permanentCalls.incrementAndGet();
                            throw new RentalProviderException(false, null);
                        },
                        CircuitBreakerRegistry.ofDefaults());
        assertThrows(
                RentalProviderException.class,
                () -> permanent.fetch(1, RentalEndpoint.RENTAL_ESTIMATE));
        assertEquals(1, permanentCalls.get());
        var failingCalls = new AtomicInteger();
        var failing =
                client(
                        (id, endpoint) -> {
                            failingCalls.incrementAndGet();
                            throw new RentalProviderException(true, null);
                        },
                        breakers);
        breakers.circuitBreaker("rental").transitionToOpenState();
        assertThrows(
                CallNotPermittedException.class,
                () -> failing.fetch(1, RentalEndpoint.RENTAL_ESTIMATE));
        assertEquals(0, failingCalls.get());
    }
}
