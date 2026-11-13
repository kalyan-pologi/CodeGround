package com.reidy.platform.config;

import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

// This configuration is limited to local profiles; UAT and production use the separate bearer-token
// security configuration.
//
// Permits local educational requests; this configuration is excluded from UAT and production.
// Spring: configuration classes declare bean definitions; container-managed beans receive
// dependency injection and lifecycle callbacks.
@Configuration
// Spring: the profile expression controls bean registration at startup; changing an environment
// variable does not rebuild a running context.
@Profile("!prod & !uat")
public class LocalSecurityConfig {
    @Bean
    SecurityFilterChain localSecurity(HttpSecurity http) throws Exception {
        return http.csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .build();
    }
}
