package com.reidy.appraisal.config;

import java.time.Duration;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.*;
import org.springframework.stereotype.Component;

// Failing startup gives configuration errors a clear cause instead of allowing invalid settings to
// fail during user requests.
//
// Checks timeout and lease relationships so configuration cannot silently break recovery
// assumptions.
@Component
public class RuntimeSettingsValidator implements ApplicationRunner {
    private final Environment environment;
    private final RentalCacheProperties ttl;

    public RuntimeSettingsValidator(Environment environment, RentalCacheProperties ttl) {
        this.environment = environment;
        this.ttl = ttl;
    }

    public void run(ApplicationArguments args) {
        for (var endpoint : com.reidy.appraisal.dto.RentalEndpoint.values()) ttl.ttlFor(endpoint);
        int attempts = environment.getProperty("resilience.rental.max-attempts", Integer.class, 2);
        Duration total =
                environment.getProperty(
                        "rental.http.total-timeout", Duration.class, Duration.ofSeconds(3));
        Duration lease =
                environment.getProperty(
                        "rental.cache.refresh-lease", Duration.class, Duration.ofSeconds(15));
        if (attempts < 1
                || attempts > 3
                || total.isNegative()
                || total.isZero()
                || lease.compareTo(total.multipliedBy(attempts).plusSeconds(5)) <= 0)
            throw new IllegalStateException(
                    "Rental refresh lease must exceed the bounded retry budget plus five seconds; attempts must be 1-3");
        Duration outboxLease =
                environment.getProperty("app.outbox.lease", Duration.class, Duration.ofSeconds(30));
        int outboxAttempts = environment.getProperty("app.outbox.max-attempts", Integer.class, 5);
        int batch = environment.getProperty("app.outbox.batch-size", Integer.class, 25);
        if (outboxLease.compareTo(Duration.ofSeconds(15)) <= 0
                || outboxAttempts < 1
                || outboxAttempts > 10
                || batch < 1
                || batch > 100)
            throw new IllegalStateException(
                    "Outbox lease must exceed 15 seconds; attempts must be 1-10 and batch size 1-100");
    }
}
