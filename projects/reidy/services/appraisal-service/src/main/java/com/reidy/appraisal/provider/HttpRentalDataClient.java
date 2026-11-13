package com.reidy.appraisal.provider;

import com.reidy.appraisal.dto.RentalData;
import com.reidy.appraisal.dto.RentalEndpoint;
import com.reidy.platform.exception.RentalProviderException;
import java.time.Duration;
import org.springframework.web.reactive.function.client.*;

// This adapter translates HTTP responses into rental DTOs; the surrounding decorators handle
// caching and resilience.
//
// Reads a configurable HTTP adapter using bounded response size and per-attempt time limits.
public class HttpRentalDataClient implements RentalDataClient {
    private final WebClient web;
    private final Duration totalTimeout;

    public HttpRentalDataClient(WebClient web, Duration totalTimeout) {
        this.web = web;
        this.totalTimeout = totalTimeout;
    }

    public RentalData fetch(long propertyId, RentalEndpoint endpoint) {
        try {
            RentalData result =
                    web.get()
                            .uri("/properties/{id}/rental/{endpoint}", propertyId, endpoint.name())
                            .retrieve()
                            .bodyToMono(RentalData.class)
                            .timeout(totalTimeout)
                            .block();
            if (result == null || result.endpoint() != endpoint)
                throw new RentalProviderException(false, null);
            return result;
        } catch (WebClientResponseException error) {
            int status = error.getStatusCode().value();
            throw new RentalProviderException(
                    status == 429 || status == 502 || status == 503 || status == 504, error);
        } catch (WebClientRequestException error) {
            throw new RentalProviderException(true, error);
        } catch (RentalProviderException error) {
            throw error;
        } catch (RuntimeException error) {
            // Decode errors are permanent; timeouts are transient. Never retry arbitrary
            // application errors.
            boolean timeout =
                    reactor.core.Exceptions.unwrap(error)
                            instanceof java.util.concurrent.TimeoutException;
            throw new RentalProviderException(timeout, error);
        }
    }
}
