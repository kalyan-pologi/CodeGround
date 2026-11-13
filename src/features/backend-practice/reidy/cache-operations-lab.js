const readme = `# Task 7: cache kill switch that survives a cache outage

Story 9 failure: caching is switched off, but Spring still creates the cache DataSource at startup. A bad cache URL therefore prevents the service from starting before the disabled branch can run.

Implement two separate bean graphs. In enabled mode, construct the cache DataSource and wrap the shared RentalDataClient with a cache decorator. In disabled mode, inject the direct provider and never construct or call the cache. Report the active mode in diagnostics without exposing a connection string. A flag that only skips cache reads is not a true kill switch.

The pure Java check verifies lazy construction, zero cache calls in disabled mode, and a cache hit in enabled mode. The Spring configuration tab shows @ConditionalOnProperty on the infrastructure itself. In the real project, add an ApplicationContextRunner test with an unreachable cache URL: disabled context starts, enabled context fails or reports the dependency error. Check both startup and request behavior.

Interview explanation: "A teammate noticed the cache DataSource was created even when our cache flag was off. I moved the condition onto bean creation, supplied a direct-provider bean for disabled mode, and tested startup with an unreachable cache endpoint. That made the switch useful during an actual cache outage."`;

const contract = `interface RentalDataClient { String fetch(String key); }
interface RentalCache {
    String get(String key);
    void put(String key, String value);
}`;

const starter = `import java.util.function.Supplier;

class CacheModeSelector {
    record Selection(RentalDataClient client, String mode) {}

    Selection select(boolean enabled, RentalDataClient direct, Supplier<RentalCache> cacheFactory) {
        // TODO: disabled mode must not invoke cacheFactory at all.
        // TODO: enabled mode should decorate direct with a cache client.
        throw new UnsupportedOperationException("Implement Task 7");
    }
}`;

const solution = `import java.util.Objects;
import java.util.function.Supplier;

class CacheModeSelector {
    record Selection(RentalDataClient client, String mode) {}

    Selection select(boolean enabled, RentalDataClient direct, Supplier<RentalCache> cacheFactory) {
        Objects.requireNonNull(direct);
        Objects.requireNonNull(cacheFactory);
        if (!enabled) return new Selection(direct, "cache-off");
        RentalCache cache = Objects.requireNonNull(cacheFactory.get());
        return new Selection(new CachedClient(direct, cache), "cache-on");
    }

    private record CachedClient(RentalDataClient provider, RentalCache cache)
            implements RentalDataClient {
        public String fetch(String key) {
            if (key == null || key.isBlank()) throw new IllegalArgumentException("key required");
            String hit = cache.get(key);
            if (hit != null) return hit;
            String value = provider.fetch(key);
            if (value == null || value.isBlank())
                throw new IllegalStateException("Provider returned no value");
            cache.put(key, value);
            return value;
        }
    }
}`;

const spring = `import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;

// The raw provider bean is named directRentalDataClient by the provider adapter.
@Configuration
class RentalTransportConfig {
    @Bean @Primary
    @ConditionalOnProperty(prefix = "rental.cache", name = "enabled", havingValue = "false", matchIfMissing = true)
    RentalDataClient directMode(@Qualifier("directRentalDataClient") RentalDataClient provider) {
        return provider;
    }

    @Bean @Primary
    @ConditionalOnProperty(prefix = "rental.cache", name = "enabled", havingValue = "true")
    RentalDataClient cachedMode(@Qualifier("directRentalDataClient") RentalDataClient provider,
                                RentalCache cache) {
        return new CacheModeSelector().select(true, provider, () -> cache).client();
    }
}

// Crucial: the condition guards DataSource creation, not just the read method.
@Configuration
@ConditionalOnProperty(prefix = "rental.cache", name = "enabled", havingValue = "true")
class RentalCacheInfrastructure {
    @Bean("rentalCacheDataSource")
    @ConfigurationProperties("rental.cache.datasource")
    DataSource rentalCacheDataSource() { return DataSourceBuilder.create().build(); }

    @Bean RentalCache rentalCache(@Qualifier("rentalCacheDataSource") DataSource source) {
        JdbcTemplate jdbc = new JdbcTemplate(source);
        return new RentalCache() {
            public String get(String key) {
                return jdbc.query("SELECT payload FROM dbo.rental_cache_value WHERE cache_key = ?",
                    (row, index) -> row.getString(1), key).stream().findFirst().orElse(null);
            }
            public void put(String key, String value) {
                jdbc.update("""
                    MERGE dbo.rental_cache_value WITH (HOLDLOCK) AS target
                    USING (VALUES (?, ?)) AS source(cache_key, payload)
                    ON target.cache_key = source.cache_key
                    WHEN MATCHED THEN UPDATE SET payload = source.payload
                    WHEN NOT MATCHED THEN INSERT (cache_key, payload)
                        VALUES (source.cache_key, source.payload);
                    """, key, value);
            }
        };
    }
}`;

const schema = `-- Focused cache-store fixture for the kill-switch lab.
CREATE TABLE dbo.rental_cache_value (
    cache_key nvarchar(200) NOT NULL PRIMARY KEY,
    payload nvarchar(max) NOT NULL
);`;

const checks = `import java.util.HashMap;
import java.util.concurrent.atomic.AtomicInteger;

class CacheOperationsAcceptanceTest {
    static void run() {
        AtomicInteger providerCalls = new AtomicInteger();
        AtomicInteger cacheCreates = new AtomicInteger();
        AtomicInteger cacheCalls = new AtomicInteger();
        RentalDataClient provider = key -> { providerCalls.incrementAndGet(); return "rent:" + key; };
        java.util.function.Supplier<RentalCache> brokenCache = () -> {
            cacheCreates.incrementAndGet();
            throw new IllegalStateException("cache database down");
        };
        CacheModeSelector selector = new CacheModeSelector();
        var disabled = selector.select(false, provider, brokenCache);
        equal("cache-off", disabled.mode());
        equal("rent:P1", disabled.client().fetch("P1"));
        equal(0, cacheCreates.get()); // startup never touched broken infrastructure

        HashMap<String, String> values = new HashMap<>();
        RentalCache cache = new RentalCache() {
            public String get(String key) { cacheCalls.incrementAndGet(); return values.get(key); }
            public void put(String key, String value) { cacheCalls.incrementAndGet(); values.put(key, value); }
        };
        var enabled = selector.select(true, provider, () -> { cacheCreates.incrementAndGet(); return cache; });
        equal("cache-on", enabled.mode());
        equal("rent:P2", enabled.client().fetch("P2"));
        equal("rent:P2", enabled.client().fetch("P2"));
        equal(2, providerCalls.get()); // P1 direct, P2 only on first miss
        equal(3, cacheCalls.get());
        equal(1, cacheCreates.get());
        System.out.println("Task 7 cache mode checks passed");
    }
    private static void equal(Object expected, Object actual) {
        if (!expected.equals(actual)) throw new AssertionError("Expected " + expected + ", got " + actual);
    }
}`;

export function cacheOperationsLab() {
  const files = [
    { path: 'README.md', language: 'markdown', readOnly: true, starter: readme },
    { path: 'src/RentalPorts.java', language: 'java', readOnly: true, starter: contract },
    { path: 'src/CacheModeSelector.java', language: 'java', starter },
    { path: 'src/RentalTransportConfig.java', language: 'java', readOnly: true, starter: spring },
    { path: 'db/cache-mode-schema.sql', language: 'sql', readOnly: true, starter: schema },
    { path: 'test/CacheOperationsAcceptanceTest.java', language: 'java', readOnly: true, starter: checks }
  ];
  return {
    runtime: 'project',
    expected: 'With cache disabled, requests use the direct provider even if cache creation or its database is unavailable. With cache enabled, the cache adapter is selected and diagnostics report the active mode.',
    files,
    fileSolutions: Object.fromEntries(files.map(file => [file.path, file.path === 'src/CacheModeSelector.java' ? solution : file.starter])),
    explanation: [
      'The disabled branch returns the direct provider without invoking the cache factory. This proves the cache is not needed at request time.',
      'The Spring condition must also wrap DataSource and adapter creation. Otherwise a broken cache connection can prevent startup before the switch is checked.',
      'Test startup with a broken cache URL in both modes, and report cache-on/cache-off in diagnostics without including credentials.'
    ],
    executionNote: 'Task 7 includes runnable Java mode checks and Spring conditional bean wiring. Verify application startup with an unreachable cache database in the Reidy project.'
  };
}
