const domain = `import java.time.Instant;

enum RentalMetric { RENT_ESTIMATE, COMPARABLES }

record MetricKey(String propertyId, RentalMetric metric) {
    MetricKey {
        if (propertyId == null || propertyId.isBlank() || metric == null)
            throw new IllegalArgumentException("Property ID and metric are required");
    }
}

record CacheEntry(String value, Instant fetchedAt) {
    CacheEntry {
        if (value == null || value.isBlank() || fetchedAt == null)
            throw new IllegalArgumentException("Only successful provider values may be cached");
    }
}`;

const client = `// The existing 20 callers depend on this port. Keep its signature unchanged.
interface RentalMetricClient {
    String fetch(String propertyId, RentalMetric metric);
}`;

const cache = `import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

interface RentalMetricCache {
    Optional<CacheEntry> find(MetricKey key);
    void save(MetricKey key, CacheEntry entry);
    void evict(MetricKey key);
}

// Test adapter. Replace with a database or Redis adapter in the real service.
class InMemoryRentalMetricCache implements RentalMetricCache {
    private final ConcurrentHashMap<MetricKey, CacheEntry> entries = new ConcurrentHashMap<>();
    public Optional<CacheEntry> find(MetricKey key) { return Optional.ofNullable(entries.get(key)); }
    public void save(MetricKey key, CacheEntry entry) { entries.put(key, entry); }
    public void evict(MetricKey key) { entries.remove(key); }
}`;

const policy = `import java.time.Duration;

record CachePolicy(Duration freshFor, Duration maxStale) {
    CachePolicy {
        if (freshFor == null || maxStale == null || freshFor.isNegative()
                || freshFor.isZero() || maxStale.compareTo(freshFor) < 0)
            throw new IllegalArgumentException("Invalid cache freshness policy");
    }

    static CachePolicy forMetric(RentalMetric metric) {
        return switch (metric) {
            case RENT_ESTIMATE -> new CachePolicy(Duration.ofHours(24), Duration.ofHours(72));
            case COMPARABLES -> new CachePolicy(Duration.ofHours(1), Duration.ofHours(6));
        };
    }
}`;

const metrics = `import java.util.concurrent.atomic.AtomicLong;

// In Spring, expose these counters with Micrometer instead of this test adapter.
class RentalCacheMetrics {
    final AtomicLong hits = new AtomicLong();
    final AtomicLong misses = new AtomicLong();
    final AtomicLong refreshes = new AtomicLong();
    final AtomicLong staleServed = new AtomicLong();
    final AtomicLong providerFailures = new AtomicLong();
    final AtomicLong cacheFailures = new AtomicLong();
}`;

const starter = `import java.time.Clock;

class CachedRentalMetricClient implements RentalMetricClient {
    CachedRentalMetricClient(RentalMetricClient provider, RentalMetricCache cache,
                             Clock clock, RentalCacheMetrics metrics) {
        // TODO: keep the provider and cache behind this shared transport boundary.
    }

    @Override public String fetch(String propertyId, RentalMetric metric) {
        // TODO: use a property + metric key and a separate freshness policy per metric.
        // TODO: refresh only expired data; keep the previous good value on provider failure.
        throw new UnsupportedOperationException("Implement Task 6");
    }

    void invalidate(String propertyId, RentalMetric metric) {
        // TODO: evict only this property and metric after the source data changes.
    }
}`;

const solution = `import java.time.Clock;
import java.time.Instant;
import java.util.Objects;

// Decorates the same port used by all callers; no endpoint class changes are needed.
class CachedRentalMetricClient implements RentalMetricClient {
    private final RentalMetricClient provider;
    private final RentalMetricCache cache;
    private final Clock clock;
    private final RentalCacheMetrics metrics;

    CachedRentalMetricClient(RentalMetricClient provider, RentalMetricCache cache,
                             Clock clock, RentalCacheMetrics metrics) {
        this.provider = Objects.requireNonNull(provider);
        this.cache = Objects.requireNonNull(cache);
        this.clock = Objects.requireNonNull(clock);
        this.metrics = Objects.requireNonNull(metrics);
    }

    @Override public String fetch(String propertyId, RentalMetric metric) {
        MetricKey key = new MetricKey(propertyId, metric);
        CachePolicy policy = CachePolicy.forMetric(metric);
        Instant now = clock.instant();
        CacheEntry previous = null;
        try {
            previous = cache.find(key).orElse(null);
        } catch (RuntimeException cacheFailure) {
            metrics.cacheFailures.incrementAndGet();
            // A cache outage must not prevent a direct provider request.
        }

        if (previous != null && isWithin(previous, now, policy.freshFor())) {
            metrics.hits.incrementAndGet();
            return previous.value();
        }
        metrics.misses.incrementAndGet();

        try {
            String value = provider.fetch(propertyId, metric);
            if (value == null || value.isBlank())
                throw new IllegalStateException("Provider returned no usable value");
            // Persist only a successful response. A failed refresh cannot erase good data.
            try {
                cache.save(key, new CacheEntry(value, clock.instant()));
            } catch (RuntimeException cacheFailure) {
                metrics.cacheFailures.incrementAndGet();
                // Return the valid provider result even if the cache is unavailable.
            }
            metrics.refreshes.incrementAndGet();
            return value;
        } catch (RuntimeException providerFailure) {
            metrics.providerFailures.incrementAndGet();
            if (previous != null && isWithin(previous, now, policy.maxStale())) {
                metrics.staleServed.incrementAndGet();
                return previous.value();
            }
            throw providerFailure; // Preserve the original failure when no safe fallback exists.
        }
    }

    void invalidate(String propertyId, RentalMetric metric) {
        cache.evict(new MetricKey(propertyId, metric));
    }

    private static boolean isWithin(CacheEntry entry, Instant now, java.time.Duration ageLimit) {
        return !now.isBefore(entry.fetchedAt()) && now.isBefore(entry.fetchedAt().plus(ageLimit));
    }
}`;

const wiring = `import java.time.Clock;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

// The app supplies a raw client named mashvisorClient and a RentalMetricCache
// adapter backed by its database or Redis. Existing callers inject the port.
@Configuration
class RentalCacheWiring {
    @Bean Clock rentalClock() { return Clock.systemUTC(); }
    @Bean RentalCacheMetrics rentalCacheMetrics() { return new RentalCacheMetrics(); }

    @Bean @Primary
    RentalMetricClient cachedRentalMetricClient(
            @Qualifier("mashvisorClient") RentalMetricClient provider,
            RentalMetricCache cache, Clock clock, RentalCacheMetrics metrics) {
        return new CachedRentalMetricClient(provider, cache, clock, metrics);
    }
}`;

const checks = `import java.time.*;
import java.util.EnumMap;

class CacheAsideAcceptanceTest {
    static void run() {
        MutableClock clock = new MutableClock();
        FakeProvider provider = new FakeProvider();
        InMemoryRentalMetricCache cache = new InMemoryRentalMetricCache();
        RentalCacheMetrics metrics = new RentalCacheMetrics();
        CachedRentalMetricClient client = new CachedRentalMetricClient(provider, cache, clock, metrics);

        equal("rent-v1", client.fetch("P1", RentalMetric.RENT_ESTIMATE));
        equal("rent-v1", client.fetch("P1", RentalMetric.RENT_ESTIMATE));
        equal(1, provider.calls.get(RentalMetric.RENT_ESTIMATE)); // fresh repeat: no call
        equal("comps-v1", client.fetch("P1", RentalMetric.COMPARABLES));
        clock.advance(Duration.ofHours(2));
        provider.comps = "comps-v2";
        equal("rent-v1", client.fetch("P1", RentalMetric.RENT_ESTIMATE));
        equal("comps-v2", client.fetch("P1", RentalMetric.COMPARABLES));
        equal(1, provider.calls.get(RentalMetric.RENT_ESTIMATE)); // estimate still fresh
        equal(2, provider.calls.get(RentalMetric.COMPARABLES));   // only comps refreshed

        clock.advance(Duration.ofHours(23));
        provider.fail = true;
        equal("rent-v1", client.fetch("P1", RentalMetric.RENT_ESTIMATE)); // stale fallback
        equal("rent-v1", cache.find(new MetricKey("P1", RentalMetric.RENT_ESTIMATE)).orElseThrow().value());
        equal(1L, metrics.staleServed.get());
        expectFailure(() -> client.fetch("P2", RentalMetric.RENT_ESTIMATE)); // no prior value
        provider.fail = false;

        client.invalidate("P1", RentalMetric.COMPARABLES);
        equal(true, cache.find(new MetricKey("P1", RentalMetric.COMPARABLES)).isEmpty());
        equal(true, cache.find(new MetricKey("P1", RentalMetric.RENT_ESTIMATE)).isPresent());
        clock.advance(Duration.ofHours(48));
        provider.fail = true;
        expectFailure(() -> client.fetch("P1", RentalMetric.RENT_ESTIMATE)); // beyond maxStale
        provider.fail = false;

        RentalMetricCache unavailable = new RentalMetricCache() {
            public java.util.Optional<CacheEntry> find(MetricKey key) { throw new IllegalStateException("cache down"); }
            public void save(MetricKey key, CacheEntry entry) { throw new IllegalStateException("cache down"); }
            public void evict(MetricKey key) { throw new IllegalStateException("cache down"); }
        };
        RentalCacheMetrics outageMetrics = new RentalCacheMetrics();
        equal("rent-v1", new CachedRentalMetricClient(provider, unavailable, clock, outageMetrics)
            .fetch("P3", RentalMetric.RENT_ESTIMATE)); // valid provider result survives cache outage
        equal(2L, outageMetrics.cacheFailures.get());
        System.out.println("Task 6 checks passed");
    }

    private static void equal(Object expected, Object actual) {
        if (!expected.equals(actual)) throw new AssertionError("Expected " + expected + ", got " + actual);
    }
    private static void expectFailure(Runnable call) {
        try { call.run(); throw new AssertionError("Expected provider failure"); }
        catch (IllegalStateException expected) { /* original provider failure propagated */ }
    }

    private static class MutableClock extends Clock {
        private Instant current = Instant.parse("2026-01-01T00:00:00Z");
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return current; }
        void advance(Duration duration) { current = current.plus(duration); }
    }
    private static class FakeProvider implements RentalMetricClient {
        final EnumMap<RentalMetric, Integer> calls = new EnumMap<>(RentalMetric.class);
        String comps = "comps-v1";
        boolean fail;
        public String fetch(String propertyId, RentalMetric metric) {
            calls.merge(metric, 1, Integer::sum);
            if (fail) throw new IllegalStateException("Mashvisor unavailable");
            return metric == RentalMetric.RENT_ESTIMATE ? "rent-v1" : comps;
        }
    }
}`;

const readme = `# Task 6: resilient cache-aside service

Problem: twenty endpoint classes share one rental-data client. Repeated views call Mashvisor again, and a failed refresh can overwrite a useful cached value.

1. Keep the existing RentalMetricClient interface. Put CachedRentalMetricClient around the raw provider client and inject the decorator as the primary implementation. No endpoint changes are required.
2. Cache by property ID AND metric. An estimate and comparable properties have different freshness windows. A cache hit is valid only while its own metric is fresh.
3. On a miss or expiry, call the provider once. Save a nonblank successful response with its fetch time. If the provider fails, return the last known good value only within maxStale; otherwise propagate the original error.
4. If cache storage fails, call the provider directly and return its valid result. Never let a failed provider response replace the previous cache entry with null.
5. Invalidate only the changed property + metric after a successful source-data change. Emit hit, miss, refresh, fallback, provider-failure, and cache-failure counters. Use Micrometer in Spring.

The solution tabs include the contract, cache adapter, freshness policy, decorator, metrics, Spring wiring, and executable acceptance checks. Run the core Java files with javac; the wiring file needs Spring Boot dependencies. The in-memory cache is a teaching adapter; a production cache needs persistent storage and integration tests. Concurrent refresh and invalidation races are covered by Task 5's versioned-key/lease exercise.

Interview explanation: "I added a cache decorator around the shared rental API client, so the twenty callers did not change. I keyed values by property and metric, applied separate freshness windows, and refreshed only expired data. On provider failure, I kept the last good value for a bounded period. I tested provider call counts, stale fallback, and targeted invalidation."`;

export function cacheAsideLab() {
  const files = [
    { path: 'README.md', language: 'markdown', readOnly: true, starter: readme },
    { path: 'src/CacheAsideDomain.java', language: 'java', readOnly: true, starter: domain },
    { path: 'src/RentalMetricClient.java', language: 'java', readOnly: true, starter: client },
    { path: 'src/RentalMetricCache.java', language: 'java', readOnly: true, starter: cache },
    { path: 'src/CachePolicy.java', language: 'java', readOnly: true, starter: policy },
    { path: 'src/RentalCacheMetrics.java', language: 'java', readOnly: true, starter: metrics },
    { path: 'src/CachedRentalMetricClient.java', language: 'java', starter },
    { path: 'src/RentalCacheWiring.java', language: 'java', readOnly: true, starter: wiring },
    { path: 'test/CacheAsideAcceptanceTest.java', language: 'java', readOnly: true, starter: checks }
  ];
  const fileSolutions = Object.fromEntries(files.map(file => [file.path, file.path === 'src/CachedRentalMetricClient.java' ? solution : file.starter]));
  return {
    runtime: 'project',
    expected: 'Repeated reads use a fresh cache entry; each metric has its own TTL; an expired entry refreshes from the provider; a provider failure serves only a bounded last-good value; invalidation refreshes only the selected property and metric.',
    files,
    fileSolutions,
    explanation: [
      'The shared client interface is the seam: one decorator changes all callers. Property and metric form the key, while the metric policy determines freshness and maximum fallback age.',
      'A successful provider response is saved before being returned. A failed response never clears the prior entry; bounded stale fallback is allowed only when a previous good value exists.',
      'The included checks verify zero repeat provider calls, independent metric refresh, stale fallback, propagation with no prior value, and targeted invalidation. The in-memory cache is a teaching adapter; connect a persistent cache and real provider in Spring.'
    ],
    executionNote: 'Task 6 has a complete Java reference and acceptance checks. Run the Java files together in the Reidy project; replace the teaching cache with the project database or Redis adapter.'
  };
}
