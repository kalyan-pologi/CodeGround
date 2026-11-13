package com.reidy.appraisal.service;

import com.reidy.appraisal.config.RentalCacheProperties;
import com.reidy.appraisal.dto.RentalEndpoint;
import com.reidy.appraisal.entity.RentalCacheEntry;
import com.reidy.appraisal.repository.RentalCacheLockRepository;
import com.reidy.appraisal.repository.RentalCacheRepository;
import com.reidy.platform.exception.ApiException;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Database locks protect short lease updates; refresh tokens prevent an older provider response
// from replacing a newer refresh.
//
// Uses short transactions to coordinate refresh ownership without holding database connections
// during provider calls.
// Spring: a service is a component-scanned bean; singleton scope shares this instance across
// request threads, so request state must remain local.
@Service
public class RentalCacheStore {
    public record Lookup(String payload, String token, String result, boolean busy) {}

    private final RentalCacheLockRepository locks;
    private final RentalCacheRepository cache;
    private final RentalCacheProperties settings;
    private final Duration lease;

    public RentalCacheStore(
            RentalCacheLockRepository locks,
            RentalCacheRepository cache,
            RentalCacheProperties settings,
            @Value("${rental.cache.refresh-lease:15s}") Duration lease) {
        this.locks = locks;
        this.cache = cache;
        this.settings = settings;
        this.lease = lease;
    }

    @Transactional(timeout = 5)
    // Claims refresh ownership briefly, allowing the provider call to run after the database
    // transaction ends.
    public Lookup acquire(long propertyId, RentalEndpoint endpoint) {
        // Bucket locking also coordinates first writes when the property has no cache row yet.
        locks.lockBucket(Math.floorMod(propertyId, 16));
        var previous = cache.findByPropertyIdAndEndpoint(propertyId, endpoint);
        var now = Instant.now();
        if (previous.isPresent() && previous.get().expiresAt.isAfter(now))
            return new Lookup(previous.get().payload, null, "hit", false);
        if (previous.isPresent()
                && previous.get().refreshUntil != null
                && previous.get().refreshUntil.isAfter(now))
            return new Lookup(null, null, null, true);
        var row = previous.orElseGet(RentalCacheEntry::new);
        if (previous.isEmpty()) {
            row.propertyId = propertyId;
            row.endpoint = endpoint;
            row.payload = "{}";
            // The placeholder is immediately expired, preventing incomplete data from appearing as
            // a valid cache hit.
            row.expiresAt = Instant.EPOCH;
        }
        row.refreshToken = UUID.randomUUID().toString();
        row.refreshUntil = now.plus(lease);
        cache.save(row);
        return new Lookup(
                null,
                row.refreshToken,
                previous.isEmpty() || Instant.EPOCH.equals(row.expiresAt) ? "miss" : "expired",
                false);
    }

    @Transactional(timeout = 5)
    // Stores refreshed data only when the caller still owns the current refresh token.
    public void complete(long propertyId, RentalEndpoint endpoint, String token, String payload) {
        // Bucket locking also coordinates first writes when the property has no cache row yet.
        locks.lockBucket(Math.floorMod(propertyId, 16));
        var row = cache.findByPropertyIdAndEndpoint(propertyId, endpoint).orElseThrow();
        if (!Objects.equals(row.refreshToken, token))
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Rental refresh lease was replaced; retry later");
        row.payload = payload;
        // Freshness starts when refreshed data is stored, using the endpoint-specific reuse
        // duration.
        row.expiresAt = Instant.now().plus(settings.ttlFor(endpoint));
        row.refreshToken = null;
        row.refreshUntil = null;
    }

    @Transactional(timeout = 5)
    // Clears only the caller?s lease so a failed request cannot cancel a newer refresh.
    public void release(long propertyId, RentalEndpoint endpoint, String token) {
        // Bucket locking also coordinates first writes when the property has no cache row yet.
        locks.lockBucket(Math.floorMod(propertyId, 16));
        var row = cache.findByPropertyIdAndEndpoint(propertyId, endpoint).orElseThrow();
        if (Objects.equals(row.refreshToken, token)) {
            row.refreshToken = null;
            row.refreshUntil = null;
        }
    }
}
