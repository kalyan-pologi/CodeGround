package com.reidy.platform.config;

import com.reidy.platform.provider.*;
import io.github.resilience4j.bulkhead.BulkheadRegistry;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.retry.RetryRegistry;
import io.netty.channel.ChannelOption;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.*;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;
import reactor.netty.resources.ConnectionProvider;

// The HTTP connection pool is independent of HikariCP; both need limits because they protect
// different downstream resources.
//
// Builds a bounded HTTP pool only in services that need remote property lookups.
// Spring: configuration classes declare bean definitions; container-managed beans receive
// dependency injection and lifecycle callbacks.
@Configuration
// Spring Boot: register this configuration or component only when the configured property condition
// matches during startup.
@ConditionalOnProperty(name = "app.property-client.enabled", havingValue = "true")
public class PropertyClientConfig {
    // Spring lifecycle: destroyMethod disposes the Reactor connection pool when the context closes,
    // releasing network resources.
    @Bean(destroyMethod = "dispose")
    ConnectionProvider propertyConnectionPool() {
        return ConnectionProvider.builder("property-http")
                .maxConnections(8)
                .pendingAcquireMaxCount(8)
                .pendingAcquireTimeout(Duration.ofMillis(250))
                .maxIdleTime(Duration.ofSeconds(30))
                .maxLifeTime(Duration.ofMinutes(5))
                .metrics(true)
                .build();
    }

    @Bean
    PropertyClient propertyClient(
            ConnectionProvider propertyConnectionPool,
            CircuitBreakerRegistry breakers,
            RetryRegistry retries,
            BulkheadRegistry bulkheads,
            @Value("${app.property-client.base-url:http://localhost:8081}") String url,
            @Value("${app.property-client.connect-timeout:1s}") Duration connect,
            @Value("${app.property-client.response-timeout:2s}") Duration response,
            @Value("${app.property-client.total-timeout:3s}") Duration total) {
        var uri = java.net.URI.create(url);
        if (uri.getHost() == null
                || uri.getUserInfo() != null
                || uri.getQuery() != null
                || !("http".equals(uri.getScheme()) || "https".equals(uri.getScheme())))
            throw new IllegalArgumentException("Invalid property service URL");
        var netty =
                HttpClient.create(propertyConnectionPool)
                        .option(
                                ChannelOption.CONNECT_TIMEOUT_MILLIS,
                                // Java: checked numeric conversion throws on overflow instead of
                                // silently truncating a long duration into an invalid integer.
                                Math.toIntExact(connect.toMillis()))
                        .responseTimeout(response)
                        .followRedirect(false)
                        .disableRetry(true);
        var web =
                WebClient.builder()
                        .baseUrl(url)
                        .clientConnector(new ReactorClientHttpConnector(netty))
                        // WebClient: bound response buffering independently of connection limits to
                        // reduce memory exposure from oversized remote responses.
                        .codecs(config -> config.defaultCodecs().maxInMemorySize(256 * 1024))
                        .build();
        return new HttpPropertyClient(web, total, breakers, retries, bulkheads);
    }
}
