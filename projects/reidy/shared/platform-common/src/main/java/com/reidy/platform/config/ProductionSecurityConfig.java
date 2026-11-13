package com.reidy.platform.config;

import java.time.Duration;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.client.RestTemplate;

// JWT signature validation proves the signer; issuer and audience checks additionally restrict who
// issued the token and its intended API.
//
// Validates bearer tokens and restricts operational endpoints to the operations scope.
// Spring: configuration classes declare bean definitions; container-managed beans receive
// dependency injection and lifecycle callbacks.
@Configuration
// Spring: the profile expression controls bean registration at startup; changing an environment
// variable does not rebuild a running context.
@Profile("prod | uat")
public class ProductionSecurityConfig {
    @Bean
    SecurityFilterChain productionSecurity(HttpSecurity http) throws Exception {
        return http.csrf(csrf -> csrf.disable())
                // Spring Security: STATELESS avoids persisting authentication in an HTTP session;
                // bearer credentials must authenticate subsequent requests.
                .sessionManagement(
                        session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(
                        auth ->
                                auth.requestMatchers(
                                                "/actuator/health/liveness",
                                                "/actuator/health/readiness")
                                        .permitAll()
                                        .requestMatchers("/api/ops/**", "/actuator/**")
                                        .hasAuthority("SCOPE_operations")
                                        .anyRequest()
                                        .authenticated())
                .oauth2ResourceServer(oauth -> oauth.jwt(jwt -> {}))
                .build();
    }

    @Bean
    JwtDecoder jwtDecoder(
            @Value("${security.jwt.issuer}") String issuer,
            @Value("${security.jwt.jwk-set-uri}") String keys,
            @Value("${security.jwt.audience}") String audience) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(2));
        factory.setReadTimeout(Duration.ofSeconds(2));
        var decoder =
                NimbusJwtDecoder.withJwkSetUri(keys)
                        .restOperations(new RestTemplate(factory))
                        .build();
        // A valid signature alone is insufficient; a token issued for another API must also be
        // rejected.
        // Java generics: List<String> expresses the expected audience claim type; validation still
        // checks its actual value at runtime.
        var audienceValidator =
                new JwtClaimValidator<List<String>>(
                        "aud", claim -> claim != null && claim.contains(audience));
        // Combine standard timestamp and issuer validation with the application-specific audience
        // requirement.
        decoder.setJwtValidator(
                new DelegatingOAuth2TokenValidator<>(
                        JwtValidators.createDefaultWithIssuer(issuer), audienceValidator));
        return decoder;
    }
}
