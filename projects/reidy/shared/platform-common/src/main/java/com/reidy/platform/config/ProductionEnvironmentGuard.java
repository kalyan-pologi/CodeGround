package com.reidy.platform.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.*;

// Startup validation catches unsafe environment combinations before the service begins accepting
// application traffic.
//
// Rejects conflicting environments and insecure deployed settings before application resources
// initialize.
public class ProductionEnvironmentGuard implements EnvironmentPostProcessor, Ordered {
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }

    public void postProcessEnvironment(
            ConfigurableEnvironment environment, SpringApplication application) {
        long environmentCount =
                java.util.Arrays.stream(environment.getActiveProfiles())
                        .filter(profile -> java.util.Set.of("dev", "uat", "prod").contains(profile))
                        .count();
        if (environmentCount > 1)
            throw new IllegalStateException("Choose only one environment: dev, uat, or prod");
        if (!environment.acceptsProfiles(Profiles.of("prod", "uat"))) return;
        String url =
                environment
                        .getRequiredProperty("spring.datasource.url")
                        .toLowerCase(java.util.Locale.ROOT);
        if (!url.startsWith("jdbc:sqlserver:")
                || url.contains("trustservercertificate=true")
                || url.contains("encrypt=false"))
            throw new IllegalStateException(
                    "UAT and production require SQL Server with certificate-verified TLS");
        for (String key : java.util.List.of("security.jwt.issuer", "security.jwt.jwk-set-uri"))
            if (!environment.getRequiredProperty(key).startsWith("https://"))
                throw new IllegalStateException(
                        "UAT and production identity endpoints must use HTTPS");
        String kafkaProtocol =
                environment.getProperty("spring.kafka.security.protocol", "SASL_SSL");
        if (!java.util.Set.of("SASL_SSL", "SSL").contains(kafkaProtocol))
            throw new IllegalStateException("UAT and production Kafka connections must use TLS");
        if (environment.getProperty("app.property-client.enabled", Boolean.class, false)
                && !environment
                        .getRequiredProperty("app.property-client.base-url")
                        .startsWith("https://"))
            throw new IllegalStateException(
                    "Deployed property HTTP calls must use HTTPS when relaying user tokens");
    }
}
