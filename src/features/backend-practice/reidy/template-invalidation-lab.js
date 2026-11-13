const readme = `# Task 14: invalidate edited notification templates across instances

Story 15: more than 164 templates live in the database. A local cache loaded once at startup keeps serving old copy after an edit, and evicting only the instance that handled the edit leaves the other instances stale.

Use the database as the source of truth. Each instance caches by template type and channel with a bounded lifetime. A successful authorized edit writes a new version, evicts that one local key, and publishes a signed invalidation carrying the key and version. Every instance verifies the signature and evicts only that key. Keep unrelated templates warm. A publish failure is counted and the TTL bounds how long remote instances can remain stale; it is not silently treated as instant propagation.

The Java check runs two instance objects against one store and bus. It proves edit propagation, targeted eviction, rejection of a forged event, and TTL recovery after a bus outage. The Spring/Redis and SQL tabs show an adapter for a focused versioned template table; Reidy's current notification_template table has only event_type and body, so it needs a schema migration before this sample can be integrated. Use an authenticated edit endpoint and a secret provider for the HMAC key in production. Pub/sub is not durable; if immediate guaranteed propagation is required, add a durable event or version check.

Interview explanation: "Template copy lived in the database, but each instance kept its own old cache. I made edits evict the exact template key and publish a signed invalidation over Redis pub/sub. Every instance cleared that key, while a TTL bounded staleness if pub/sub failed. I tested two instances and checked unrelated templates stayed cached."`;

const domain = `record TemplateKey(String type, String channel) {
    TemplateKey {
        if (type == null || !type.matches("[A-Z_]{2,64}")
                || channel == null || !channel.matches("[A-Z]{2,16}"))
            throw new IllegalArgumentException("Invalid template key");
    }
}
record Template(TemplateKey key, long version, String body) {}
record InvalidationEvent(TemplateKey key, long version, String signature) {}

interface TemplateStore {
    Template find(TemplateKey key);
    Template update(TemplateKey key, String body);
}
interface InvalidationBus {
    void subscribe(java.util.function.Consumer<InvalidationEvent> listener);
    void publish(InvalidationEvent event);
}`;

const signer = `import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

class InvalidationSigner {
    private final byte[] secret;
    InvalidationSigner(byte[] secret) {
        if (secret == null || secret.length < 32) throw new IllegalArgumentException("HMAC key too short");
        this.secret = secret.clone();
    }
    InvalidationEvent sign(TemplateKey key, long version) {
        if (version <= 0) throw new IllegalArgumentException("version required");
        return new InvalidationEvent(key, version, java.util.HexFormat.of().formatHex(mac(key, version)));
    }
    boolean valid(InvalidationEvent event) {
        if (event == null || event.key() == null || event.version() <= 0 || event.signature() == null)
            return false;
        try {
            return MessageDigest.isEqual(mac(event.key(), event.version()),
                java.util.HexFormat.of().parseHex(event.signature()));
        } catch (IllegalArgumentException badSignature) { return false; }
    }
    private byte[] mac(TemplateKey key, long version) {
        try {
            Mac hmac = Mac.getInstance("HmacSHA256");
            hmac.init(new SecretKeySpec(secret, "HmacSHA256"));
            String message = key.type() + "|" + key.channel() + "|" + version;
            return hmac.doFinal(message.getBytes(StandardCharsets.UTF_8));
        } catch (java.security.GeneralSecurityException error) {
            throw new IllegalStateException("HMAC unavailable", error);
        }
    }
}`;

const starter = `import java.time.Clock;
import java.time.Duration;

class NotificationTemplateService {
    NotificationTemplateService(TemplateStore store, InvalidationBus bus,
                                InvalidationSigner signer, Clock clock, Duration ttl) {
        // TODO: register a verified, targeted invalidation listener.
    }
    Template get(TemplateKey key) { throw new UnsupportedOperationException("Implement read"); }
    Template edit(TemplateKey key, String body, boolean authorized) {
        // TODO: authorize; update DB; evict key locally; publish signed event.
        throw new UnsupportedOperationException("Implement edit");
    }
}`;

const solution = `import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

class NotificationTemplateService {
    private record Cached(Template template, Instant expiresAt) {}
    private final TemplateStore store;
    private final InvalidationBus bus;
    private final InvalidationSigner signer;
    private final Clock clock;
    private final Duration ttl;
    private final ConcurrentHashMap<TemplateKey, Cached> local = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<TemplateKey, Object> keyLocks = new ConcurrentHashMap<>();
    final AtomicLong invalidations = new AtomicLong();
    final AtomicLong rejectedEvents = new AtomicLong();
    final AtomicLong publishFailures = new AtomicLong();
    final AtomicLong databaseReads = new AtomicLong();

    NotificationTemplateService(TemplateStore store, InvalidationBus bus,
                                InvalidationSigner signer, Clock clock, Duration ttl) {
        this.store = Objects.requireNonNull(store);
        this.bus = Objects.requireNonNull(bus);
        this.signer = Objects.requireNonNull(signer);
        this.clock = Objects.requireNonNull(clock);
        if (ttl == null || ttl.isNegative() || ttl.isZero())
            throw new IllegalArgumentException("A positive cache TTL is required");
        this.ttl = ttl;
        bus.subscribe(this::onInvalidation);
    }

    Template get(TemplateKey key) {
        Objects.requireNonNull(key);
        synchronized (lockFor(key)) {
            Cached current = local.get(key);
            if (current != null && clock.instant().isBefore(current.expiresAt()))
                return current.template();
            Template latest = store.find(key);
            if (latest == null) throw new IllegalArgumentException("Template not found");
            databaseReads.incrementAndGet();
            local.put(key, new Cached(latest, clock.instant().plus(ttl)));
            return latest;
        }
    }

    Template edit(TemplateKey key, String body, boolean authorized) {
        if (!authorized) throw new SecurityException("Template edit denied");
        Objects.requireNonNull(key);
        if (body == null || body.isBlank()) throw new IllegalArgumentException("Template body required");
        Template changed;
        synchronized (lockFor(key)) {
            changed = store.update(key, body); // Commit DB edit before publishing.
            local.remove(key);
        }
        try {
            bus.publish(signer.sign(key, changed.version()));
        } catch (RuntimeException failure) {
            publishFailures.incrementAndGet(); // Other instances refresh no later than TTL.
        }
        return changed;
    }

    private void onInvalidation(InvalidationEvent event) {
        if (!signer.valid(event)) { rejectedEvents.incrementAndGet(); return; }
        synchronized (lockFor(event.key())) {
            local.computeIfPresent(event.key(), (key, cached) -> {
                if (cached.template().version() < event.version()) {
                    invalidations.incrementAndGet();
                    return null; // Evict exactly this key, never the entire template cache.
                }
                return cached; // Delayed event cannot evict a newer value.
            });
        }
    }
    private Object lockFor(TemplateKey key) { return keyLocks.computeIfAbsent(key, ignored -> new Object()); }
}`;

const fixtures = `import java.util.HashMap;
import java.util.concurrent.CopyOnWriteArrayList;

class InMemoryTemplateStore implements TemplateStore {
    final HashMap<TemplateKey, Template> rows = new HashMap<>();
    public synchronized Template find(TemplateKey key) { return rows.get(key); }
    public synchronized Template update(TemplateKey key, String body) {
        Template prior = rows.get(key);
        Template next = new Template(key, prior == null ? 1 : prior.version() + 1, body);
        rows.put(key, next);
        return next;
    }
}
class InMemoryInvalidationBus implements InvalidationBus {
    private final CopyOnWriteArrayList<java.util.function.Consumer<InvalidationEvent>> listeners = new CopyOnWriteArrayList<>();
    boolean failPublish;
    public void subscribe(java.util.function.Consumer<InvalidationEvent> listener) { listeners.add(listener); }
    public void publish(InvalidationEvent event) {
        if (failPublish) throw new IllegalStateException("pub/sub unavailable");
        listeners.forEach(listener -> listener.accept(event));
    }
}`;

const jdbcStore = `import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

// Adapt table/column names through a migration before integrating with Reidy.
class JdbcTemplateStore implements TemplateStore {
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    JdbcTemplateStore(JdbcTemplate jdbc, PlatformTransactionManager manager) {
        this.jdbc = jdbc;
        this.transaction = new TransactionTemplate(manager);
    }
    public Template find(TemplateKey key) {
        return jdbc.query("""
            SELECT version, body FROM dbo.notification_template_lab
            WHERE template_type = ? AND channel = ?
            """, (row, index) -> new Template(key, row.getLong(1), row.getString(2)),
            key.type(), key.channel()).stream().findFirst().orElse(null);
    }
    public Template update(TemplateKey key, String body) {
        return transaction.execute(status -> {
            List<Template> current = jdbc.query("""
                SELECT version, body FROM dbo.notification_template_lab WITH (UPDLOCK, HOLDLOCK)
                WHERE template_type = ? AND channel = ?
                """, (row, index) -> new Template(key, row.getLong(1), row.getString(2)),
                key.type(), key.channel());
            if (current.isEmpty()) throw new IllegalArgumentException("Template not found");
            long nextVersion = current.get(0).version() + 1;
            jdbc.update("""
                UPDATE dbo.notification_template_lab SET body = ?, version = ?
                WHERE template_type = ? AND channel = ?
                """, body, nextVersion, key.type(), key.channel());
            return new Template(key, nextVersion, body);
        });
    }
}`;

const schema = `-- Focused SQL Server lab table. Migrate Reidy's existing notification_template
-- data and schema deliberately before integrating this code.
CREATE TABLE dbo.notification_template_lab (
    template_type varchar(64) NOT NULL,
    channel varchar(16) NOT NULL,
    version bigint NOT NULL,
    body varchar(1000) NOT NULL,
    CONSTRAINT PK_notification_template_lab PRIMARY KEY (template_type, channel)
);`;

const spring = `import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;

// One Redis channel carries signed type|channel|version|signature events.
// Supply the HMAC key from a secret provider, never commit it in application.yml.
@Configuration
class TemplateInvalidationRedisConfig {
    @Bean Clock templateClock() { return Clock.systemUTC(); }
    @Bean TemplateStore templateStore(JdbcTemplate jdbc, PlatformTransactionManager manager) {
        return new JdbcTemplateStore(jdbc, manager);
    }
    @Bean InvalidationSigner invalidationSigner(@Value("#{systemEnvironment['TEMPLATE_INVALIDATION_HMAC_KEY']}") String key) {
        return new InvalidationSigner(key.getBytes(StandardCharsets.UTF_8));
    }
    @Bean RedisInvalidationBus invalidationBus(StringRedisTemplate redis) {
        return new RedisInvalidationBus(redis);
    }
    @Bean NotificationTemplateService notificationTemplateService(
            TemplateStore store, RedisInvalidationBus bus, InvalidationSigner signer, Clock clock) {
        return new NotificationTemplateService(store, bus, signer, clock, Duration.ofMinutes(5));
    }
    @Bean RedisMessageListenerContainer templateListenerContainer(
            RedisConnectionFactory factory, RedisInvalidationBus bus) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(factory);
        container.addMessageListener(bus, new ChannelTopic(RedisInvalidationBus.CHANNEL));
        return container;
    }
}

class RedisInvalidationBus implements InvalidationBus, MessageListener {
    static final String CHANNEL = "notification-template-invalidations";
    private final StringRedisTemplate redis;
    private final CopyOnWriteArrayList<Consumer<InvalidationEvent>> listeners = new CopyOnWriteArrayList<>();
    RedisInvalidationBus(StringRedisTemplate redis) { this.redis = redis; }
    public void subscribe(Consumer<InvalidationEvent> listener) { listeners.add(listener); }
    public void publish(InvalidationEvent event) {
        redis.convertAndSend(CHANNEL, event.key().type() + "|" + event.key().channel()
            + "|" + event.version() + "|" + event.signature());
    }
    public void onMessage(Message message, byte[] pattern) {
        String value = new String(message.getBody(), StandardCharsets.UTF_8);
        String[] fields = value.split("[|]", -1);
        if (fields.length != 4) return;
        try {
            InvalidationEvent event = new InvalidationEvent(
                new TemplateKey(fields[0], fields[1]), Long.parseLong(fields[2]), fields[3]);
            listeners.forEach(listener -> listener.accept(event));
        } catch (IllegalArgumentException malformed) { /* record a malformed-event metric */ }
    }
}`;

const checks = `import java.time.*;
import java.nio.charset.StandardCharsets;

class TemplateInvalidationAcceptanceTest {
    static void run() {
        MutableClock clock = new MutableClock();
        InMemoryTemplateStore store = new InMemoryTemplateStore();
        InMemoryInvalidationBus bus = new InMemoryInvalidationBus();
        InvalidationSigner signer = new InvalidationSigner("a-long-test-secret-with-more-than-32-bytes".getBytes(StandardCharsets.UTF_8));
        TemplateKey edited = new TemplateKey("SIGNUP", "EMAIL");
        TemplateKey other = new TemplateKey("APPROVAL", "SMS");
        store.update(edited, "old text"); store.update(other, "unchanged");
        NotificationTemplateService a = new NotificationTemplateService(store, bus, signer, clock, Duration.ofMinutes(5));
        NotificationTemplateService b = new NotificationTemplateService(store, bus, signer, clock, Duration.ofMinutes(5));
        equal("old text", a.get(edited).body());
        equal("old text", b.get(edited).body());
        b.get(other);
        expect(SecurityException.class, () -> a.edit(edited, "bad", false));
        a.edit(edited, "new text", true);
        equal("new text", b.get(edited).body());
        equal(3L, b.databaseReads.get()); // edited key loaded twice, other once
        equal("unchanged", b.get(other).body());
        equal(3L, b.databaseReads.get());

        bus.publish(new InvalidationEvent(edited, 999, "forged"));
        equal("new text", b.get(edited).body());
        equal(1L, b.rejectedEvents.get());
        bus.failPublish = true;
        a.edit(edited, "after outage", true);
        equal("new text", b.get(edited).body()); // still cached while event was lost
        clock.advance(Duration.ofMinutes(6));
        equal("after outage", b.get(edited).body()); // TTL bounds staleness
        equal(1L, a.publishFailures.get());
        System.out.println("Task 14 multi-instance checks passed");
    }
    private static void equal(Object expected, Object actual) {
        if (!expected.equals(actual)) throw new AssertionError("Expected " + expected + ", got " + actual);
    }
    private static void expect(Class<? extends Throwable> type, Runnable action) {
        try { action.run(); throw new AssertionError("Expected failure"); }
        catch (Throwable failure) { if (!type.isInstance(failure)) throw new AssertionError(failure); }
    }
    private static class MutableClock extends Clock {
        Instant now = Instant.parse("2026-01-01T00:00:00Z");
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return now; }
        void advance(Duration duration) { now = now.plus(duration); }
    }
}`;

export function templateInvalidationLab() {
  const files = [
    { path: 'README.md', language: 'markdown', readOnly: true, starter: readme },
    { path: 'src/TemplateDomain.java', language: 'java', readOnly: true, starter: domain },
    { path: 'src/InvalidationSigner.java', language: 'java', readOnly: true, starter: signer },
    { path: 'src/NotificationTemplateService.java', language: 'java', starter },
    { path: 'src/InMemoryTemplateAdapters.java', language: 'java', readOnly: true, starter: fixtures },
    { path: 'src/JdbcTemplateStore.java', language: 'java', readOnly: true, starter: jdbcStore },
    { path: 'src/TemplateInvalidationRedisConfig.java', language: 'java', readOnly: true, starter: spring },
    { path: 'db/template-invalidation-schema.sql', language: 'sql', readOnly: true, starter: schema },
    { path: 'test/TemplateInvalidationAcceptanceTest.java', language: 'java', readOnly: true, starter: checks }
  ];
  return {
    runtime: 'project',
    expected: 'An authorized edit commits a new template version and invalidates that key on every listening instance. Unrelated templates remain cached, forged or old events are ignored, and TTL bounds staleness if pub/sub fails.',
    files,
    fileSolutions: Object.fromEntries(files.map(file => [file.path,
      file.path === 'src/NotificationTemplateService.java' ? solution : file.starter])),
    explanation: [
      'The database owns template content and versions. Each instance keeps a bounded local cache keyed by type and channel.',
      'An authorized edit commits first, then publishes a signed versioned invalidation. Listeners verify the signature and remove only the matching key; older events cannot evict newer data.',
      'Redis pub/sub is not durable. On publish failure the edit remains saved, the failure is counted, and TTL bounds remote staleness. A durable channel is needed if every edit must propagate immediately.'
    ],
    executionNote: 'Task 14 includes runnable two-instance Java checks and Redis pub/sub wiring. Verify actual propagation and failure handling against Redis in the Reidy project.'
  };
}
