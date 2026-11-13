package com.reidy.appraisal.config;

import com.reidy.appraisal.provider.HttpRentalDataClient;
import com.reidy.appraisal.provider.MockRentalDataClient;
import com.reidy.appraisal.provider.RentalDataClient;
import io.netty.channel.ChannelOption;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;
import reactor.netty.resources.ConnectionProvider;

// Bean selection chooses mock or HTTP transport; callers continue using the same decorated
// RentalDataClient interface.
//
// Selects mock or HTTP transport and bounds outbound connection and response resources.
// Spring: configuration classes declare bean definitions; container-managed beans receive
// dependency injection and lifecycle callbacks.
@Configuration
public class RentalTransportConfig {
    @Bean(destroyMethod = "dispose")
    public ConnectionProvider rentalConnectionPool(
            @Value("${rental.http.max-connections:16}") int maximum,
            @Value("${rental.http.acquire-timeout:250ms}") Duration acquireTimeout) {
        return ConnectionProvider.builder("rental-http")
                .maxConnections(maximum)
                .pendingAcquireMaxCount(16)
                .pendingAcquireTimeout(acquireTimeout)
                .maxIdleTime(Duration.ofSeconds(30))
                .maxLifeTime(Duration.ofMinutes(5))
                .evictInBackground(Duration.ofSeconds(30))
                .metrics(true)
                .build();
    }

    @Bean("rentalTransport")
    public RentalDataClient rentalTransport(
            MockRentalDataClient mock,
            ConnectionProvider rentalConnectionPool,
            @Value("${rental.provider-mode:mock}") String mode,
            @Value("${rental.http.base-url:}") String baseUrl,
            @Value("${rental.http.connect-timeout:1s}") Duration connectTimeout,
            @Value("${rental.http.response-timeout:2s}") Duration responseTimeout,
            @Value("${rental.http.total-timeout:3s}") Duration totalTimeout) {
        if ("mock".equals(mode)) return mock;
        if (!"http".equals(mode))
            throw new IllegalArgumentException("Unknown rental provider mode");
        if (baseUrl.isBlank())
            throw new IllegalArgumentException("HTTP rental provider requires a base URL");
        var uri = java.net.URI.create(baseUrl);
        if (uri.getHost() == null
                || !("http".equals(uri.getScheme()) || "https".equals(uri.getScheme())))
            throw new IllegalArgumentException("Invalid rental provider URL");
        var client =
                HttpClient.create(rentalConnectionPool)
                        .option(
                                ChannelOption.CONNECT_TIMEOUT_MILLIS,
                                Math.toIntExact(connectTimeout.toMillis()))
                        .responseTimeout(responseTimeout)
                        .followRedirect(false)
                        .disableRetry(true);
        var web =
                WebClient.builder()
                        .baseUrl(baseUrl)
                        .clientConnector(new ReactorClientHttpConnector(client))
                        .codecs(codecs -> codecs.defaultCodecs().maxInMemorySize(256 * 1024))
                        .build();
        return new HttpRentalDataClient(web, totalTimeout);
    }
}
