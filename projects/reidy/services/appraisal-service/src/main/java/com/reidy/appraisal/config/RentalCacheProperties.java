package com.reidy.appraisal.config;

import com.reidy.appraisal.dto.RentalEndpoint;
import java.time.Duration;
import java.util.EnumMap;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

// Different endpoints can have different freshness needs; a time-to-live controls reuse rather than
// deleting expired rows immediately.
//
// Binds independent cache lifetimes and rejects nonpositive endpoint expiration settings.
@Component
// Spring Boot: relaxed binding converts external configuration into typed properties, including
// enum keys and Duration values.
@ConfigurationProperties(prefix = "rental.cache")
public class RentalCacheProperties {
    // Java: EnumMap specializes keys to one enum type; it is not thread-safe, so this configuration
    // map should not be mutated during requests.
    private Map<RentalEndpoint, Duration> ttl = new EnumMap<>(RentalEndpoint.class);

    public RentalCacheProperties() {
        ttl.put(RentalEndpoint.RENTAL_ESTIMATE, Duration.ofMinutes(30));
        ttl.put(RentalEndpoint.NEIGHBORHOOD_STATISTICS, Duration.ofHours(6));
        ttl.put(RentalEndpoint.RENTAL_COMPARABLES, Duration.ofHours(1));
    }

    public Map<RentalEndpoint, Duration> getTtl() {
        return ttl;
    }

    public void setTtl(Map<RentalEndpoint, Duration> ttl) {
        this.ttl = ttl;
    }

    public Duration ttlFor(RentalEndpoint endpoint) {
        Duration value = ttl.get(endpoint);
        if (value == null || value.isNegative() || value.isZero())
            throw new IllegalStateException("Rental TTL must be positive for " + endpoint);
        return value;
    }
}
