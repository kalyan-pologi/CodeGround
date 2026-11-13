package com.reidy.platform.config;

import io.github.resilience4j.ratelimiter.RateLimiter;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.concurrent.Semaphore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

// Rate limits control arrivals over time; the semaphore separately bounds how many requests execute
// simultaneously in this process.
//
// Rejects excess request rate or concurrency before overloaded work consumes downstream resources.
@Component
@Order(-190)
public class ApiAdmissionFilter extends OncePerRequestFilter {
    private final RateLimiter limiter;
    private final Semaphore concurrency;
    private final MeterRegistry metrics;

    public ApiAdmissionFilter(
            RateLimiter limiter,
            MeterRegistry metrics,
            @Value("${resilience.api.max-concurrent:32}") int maximum) {
        this.limiter = limiter;
        this.metrics = metrics;
        // Java concurrency: a semaphore counts permits; this limit coordinates threads in one JVM,
        // not requests across all replicas.
        concurrency = new Semaphore(maximum);
    }

    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!limiter.acquirePermission()) {
            reject(response, 429, "rate");
            return;
        }
        if (!concurrency.tryAcquire()) {
            reject(response, 503, "concurrency");
            return;
        }
        try {
            chain.doFilter(request, response);
        } finally {
            // Java: finally releases the acquired permit even if downstream handling throws,
            // preventing gradual permit exhaustion.
            concurrency.release();
        }
    }

    private void reject(HttpServletResponse response, int status, String reason)
            throws IOException {
        metrics.counter("api.rejected", "reason", reason).increment();
        response.setStatus(status);
        response.setHeader("Retry-After", "1");
        response.setContentType("application/problem+json");
        response.getWriter()
                .write(
                        "{\"title\":\"Server busy\",\"status\":"
                                + status
                                + ",\"detail\":\"Retry later\"}");
    }
}
