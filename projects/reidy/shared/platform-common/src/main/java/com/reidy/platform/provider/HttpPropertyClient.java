package com.reidy.platform.provider;

import com.reidy.contracts.dto.PropertySnapshot;
import com.reidy.platform.exception.*;
import io.github.resilience4j.bulkhead.*;
import io.github.resilience4j.circuitbreaker.*;
import io.github.resilience4j.retry.*;
import java.time.Duration;
import java.util.function.Supplier;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.reactive.function.client.*;

// Retry wraps individual circuit-breaker attempts, while the outer bulkhead limits callers across
// the complete retry sequence.
//
// Relays the caller token and limits remote reads without wrapping them in local database
// transactions.
public class HttpPropertyClient implements PropertyClient {
    private final WebClient web;
    private final Duration timeout;
    private final CircuitBreaker breaker;
    private final Retry retry;
    private final Bulkhead bulkhead;

    public HttpPropertyClient(
            WebClient web,
            Duration timeout,
            CircuitBreakerRegistry breakers,
            RetryRegistry retries,
            BulkheadRegistry bulkheads) {
        this.web = web;
        this.timeout = timeout;
        breaker =
                breakers.circuitBreaker(
                        "property-http",
                        CircuitBreakerConfig.from(breakers.getDefaultConfig())
                                .recordException(
                                        error ->
                                                error instanceof RemoteServiceException remote
                                                        && remote.retryable())
                                .ignoreExceptions(ApiException.class)
                                .build());
        retry = retries.retry("property-http");
        bulkhead = bulkheads.bulkhead("property-http");
    }

    public PropertySnapshot get(long id) {
        if (id <= 0) throw new ApiException(HttpStatus.BAD_REQUEST, "Property ID must be positive");
        Supplier<PropertySnapshot> call =
                CircuitBreaker.decorateSupplier(breaker, () -> request(id));
        // Each retry enters the circuit breaker again; the outer bulkhead retains one permit for
        // the full call.
        call = Retry.decorateSupplier(retry, call);
        return Bulkhead.decorateSupplier(bulkhead, call).get();
    }

    private PropertySnapshot request(long id) {
        try {
            var request = web.get().uri("/api/properties/{id}", id);
            // Relay the caller token so property-service performs its own authentication and access
            // checks.
            var actor = SecurityContextHolder.getContext().getAuthentication();
            if (actor instanceof JwtAuthenticationToken jwt)
                request.headers(headers -> headers.setBearerAuth(jwt.getToken().getTokenValue()));
            String requestId = MDC.get("requestId");
            if (requestId != null) request.header("X-Request-Id", requestId);
            // Reactor: bodyToMono describes asynchronous work, but block below makes this client
            // synchronous for its servlet caller.
            var property =
                    request.retrieve().bodyToMono(PropertySnapshot.class).timeout(timeout).block();
            // Treat an empty or mismatched response as a dependency contract failure.
            // Java: comparing boxed Long to primitive long unboxes the ID; the earlier null check
            // prevents a NullPointerException.
            if (property == null || property.id() == null || property.id() != id)
                throw new RemoteServiceException("Invalid property response", false, null);
            return property;
        } catch (WebClientResponseException error) {
            int status = error.getStatusCode().value();
            // Missing properties are business failures; retrying the same lookup will not repair
            // them.
            if (status == 404) throw new ApiException(HttpStatus.NOT_FOUND, "Property not found");
            if (status == 401 || status == 403)
                throw new ApiException(
                        HttpStatus.valueOf(status), "Property service rejected caller access");
            throw new RemoteServiceException(
                    "Property service unavailable", status == 429 || status >= 500, error);
        } catch (WebClientRequestException error) {
            throw new RemoteServiceException("Property service connection failed", true, error);
            // Java multi-catch: preserve already-classified failures rather than wrapping them
            // again
            // and losing retry or HTTP semantics.
        } catch (ApiException | RemoteServiceException error) {
            throw error;
        } catch (RuntimeException error) {
            throw new RemoteServiceException(
                    "Property response failed",
                    reactor.core.Exceptions.unwrap(error)
                            instanceof java.util.concurrent.TimeoutException,
                    error);
        }
    }
}
