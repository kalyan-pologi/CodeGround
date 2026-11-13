package com.reidy.platform;

import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.reidy.platform.config.ProductionSecurityConfig;
import com.reidy.platform.config.ResilienceConfig;
import com.reidy.platform.controller.OutboxOperationsController;
import com.reidy.platform.service.NotificationOutboxStore;
import io.micrometer.core.instrument.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

// Endpoint access checks verify the distinction between ordinary authenticated callers and callers
// with the operations scope.
//
// Checks important operations security behavior without contacting real customer or paid systems.
@WebMvcTest(
        controllers = OutboxOperationsController.class,
        properties = {
            "spring.datasource.url=jdbc:sqlserver://unused.invalid;encrypt=true;trustServerCertificate=false",
            "security.jwt.issuer=https://issuer.invalid",
            "security.jwt.jwk-set-uri=https://issuer.invalid/keys",
            "security.jwt.audience=reidy"
        })
@ActiveProfiles({"prod", "sqlserver"})
@org.springframework.test.context.ContextConfiguration(
        classes = OperationsSecurityTest.TestApplication.class)
@Import({
    OutboxOperationsController.class,
    ProductionSecurityConfig.class,
    ResilienceConfig.class,
    OperationsSecurityTest.Metrics.class
})
class OperationsSecurityTest {
    @org.springframework.boot.SpringBootConfiguration
    @org.springframework.boot.autoconfigure.EnableAutoConfiguration
    static class TestApplication {}

    @MockitoBean JwtDecoder jwtDecoder;
    @MockitoBean NotificationOutboxStore store;
    @Autowired MockMvc mvc;

    @TestConfiguration
    static class Metrics {
        @Bean
        MeterRegistry metrics() {
            return new io.micrometer.core.instrument.simple.SimpleMeterRegistry();
        }
    }

    @Test
    void operationsRequireAuthenticationAndOperationsScope() throws Exception {
        when(store.list(any(), anyInt(), anyInt()))
                .thenReturn(org.springframework.data.domain.Page.empty());
        mvc.perform(get("/api/ops/outbox")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/ops/outbox").with(jwt())).andExpect(status().isForbidden());
        mvc.perform(
                        get("/api/ops/outbox")
                                .with(
                                        jwt().authorities(
                                                        new SimpleGrantedAuthority(
                                                                "SCOPE_operations"))))
                .andExpect(status().isOk());
    }
}
