package com.reidy.appraisal.provider;

import com.reidy.appraisal.dto.RentalData;
import com.reidy.appraisal.dto.RentalEndpoint;
import com.reidy.platform.exception.RentalProviderException;
import io.github.resilience4j.bulkhead.*;
import io.github.resilience4j.circuitbreaker.*;
import io.github.resilience4j.retry.*;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

// Transport failures pass through retry and circuit-breaker policies; callers receive a controlled
// failure when dependency access is rejected.
//
// Protects provider reads with bounded concurrency, safe retries, and circuit-breaker recovery
// probes.
@Component("resilientRentalDataClient")
public class ResilientRentalDataClient implements RentalDataClient {
    private final RentalDataClient delegate;
    private final CircuitBreaker breaker;
    private final Bulkhead bulkhead;
    private final Retry retry;

    public ResilientRentalDataClient(
            @Qualifier("rentalTransport") RentalDataClient delegate,
            CircuitBreakerRegistry breakers,
            BulkheadRegistry bulkheads,
            RetryRegistry retries) {
        this.delegate = delegate;
        breaker =
                breakers.circuitBreaker(
                        "rental",
                        CircuitBreakerConfig.from(breakers.getDefaultConfig())
                                .recordException(
                                        error ->
                                                error instanceof RentalProviderException provider
                                                        // Java pattern matching: instanceof binds
                                                        // provider only on a matching type;
                                                        // short-circuit AND makes the following
                                                        // access safe.
                                                        && provider.retryable())
                                .ignoreExceptions(IllegalArgumentException.class)
                                .build());
        bulkhead = bulkheads.bulkhead("rental");
        retry = retries.retry("rental");
    }

    public RentalData fetch(long propertyId, RentalEndpoint endpoint) {
        // The bulkhead covers the whole retry sequence; each provider attempt goes through the
        // breaker.
        // Java functional interfaces: Supplier defers execution; decorators wrap the operation, and
        // the final get() actually invokes it.
        Supplier<RentalData> call =
                CircuitBreaker.decorateSupplier(
                        breaker, () -> delegate.fetch(propertyId, endpoint));
        call = Retry.decorateSupplier(retry, call);
        return Bulkhead.decorateSupplier(bulkhead, call).get();
    }
}
