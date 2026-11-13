package com.reidy.platform;

import static org.junit.jupiter.api.Assertions.*;

import com.reidy.platform.exception.*;
import com.reidy.platform.provider.HttpPropertyClient;
import com.sun.net.httpserver.HttpServer;
import io.github.resilience4j.bulkhead.BulkheadRegistry;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.retry.*;
import java.net.InetSocketAddress;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;

// A local HTTP server verifies observable client behavior without requiring the independently
// deployed property application.
//
// Exercises real local HTTP retries and preserves remote not-found responses without any cloud
// dependency.
class PropertyHttpClientTest {
    @Test
    void retriesTransientGetButDoesNotRetryNotFound() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        var calls = new AtomicInteger();
        server.createContext(
                "/api/properties/42",
                exchange -> {
                    if (calls.incrementAndGet() == 1) {
                        exchange.sendResponseHeaders(503, -1);
                        exchange.close();
                        return;
                    }
                    byte[] body =
                            "{\"id\":42,\"address\":\"Synthetic\",\"propertyType\":\"RESIDENTIAL\",\"squareFootage\":1200}"
                                    .getBytes(java.nio.charset.StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().add("Content-Type", "application/json");
                    exchange.sendResponseHeaders(200, body.length);
                    exchange.getResponseBody().write(body);
                    exchange.close();
                });
        server.createContext(
                "/api/properties/99",
                exchange -> {
                    exchange.sendResponseHeaders(404, -1);
                    exchange.close();
                });
        server.start();
        try {
            var retries =
                    RetryRegistry.of(
                            RetryConfig.custom()
                                    .maxAttempts(2)
                                    .waitDuration(Duration.ofMillis(1))
                                    .retryOnException(
                                            error ->
                                                    error instanceof RemoteServiceException remote
                                                            && remote.retryable())
                                    .build());
            var client =
                    new HttpPropertyClient(
                            WebClient.builder()
                                    .baseUrl("http://127.0.0.1:" + server.getAddress().getPort())
                                    .build(),
                            Duration.ofSeconds(2),
                            CircuitBreakerRegistry.ofDefaults(),
                            retries,
                            BulkheadRegistry.ofDefaults());
            assertEquals(42, client.get(42).id());
            assertEquals(2, calls.get());
            assertThrows(ApiException.class, () -> client.get(99));
        } finally {
            server.stop(0);
        }
    }
}
