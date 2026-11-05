import { projectFeature } from './project-feature-builder.js';

export const mediumDeliveryTasks = [
  projectFeature({
    topic: 17, title: 'Build a resilient Redis cache-aside rental estimate service',
    statement: 'Build a rental estimate reader that caches provider results by property and estimate type, verifies logical freshness, tolerates cache outages, and keeps provider errors visible. Include JSON envelope validation and explicit invalidation.',
    requirements: [
      'Use a versioned key containing positive property ID and an enum estimate type. Configure a positive TTL no greater than 15 minutes.',
      'Store a JSON envelope with the estimate, creation instant, and exclusive expiry instant. Use the injected Clock for deterministic decisions.',
      'Return only well-formed, nonnegative, fresh estimates. Invalid JSON, missing fields, future-created data, and expired envelopes must not be returned as hits.',
      'Use Redis TTL as well as the logical envelope deadline. Do not cache null provider results.',
      'Treat Redis access errors as cache misses, while preserving provider exceptions. Cache-write failure must not discard a successful provider result.',
      'Support explicit invalidation and report whether deletion succeeded. Explain the bounded-staleness and cache-stampede limits of this simple cache-aside workflow.'
    ],
    imports: 'import java.math.BigDecimal;\nimport java.time.*;\nimport java.util.*;\nimport com.fasterxml.jackson.core.JsonProcessingException;\nimport com.fasterxml.jackson.databind.ObjectMapper;\nimport org.springframework.beans.factory.annotation.Value;\nimport org.springframework.dao.DataAccessException;\nimport org.springframework.data.redis.core.StringRedisTemplate;\nimport org.springframework.stereotype.Service;',
    model: `enum RentalKind { RENTAL_ESTIMATE, MARKET_RENT }
record RentalEstimate(BigDecimal amount, Instant asOf) {}
record RentalEnvelope(RentalEstimate estimate, Instant createdAt, Instant expiresAt) {}
interface RentalProvider { RentalEstimate load(long propertyId, RentalKind kind); }`,
    units: [{ owner: '@Service\nclass RentalEstimateService', members: `    private final StringRedisTemplate redis; private final ObjectMapper mapper; private final Clock clock;
    private final RentalProvider provider; private final Duration ttl;
    RentalEstimateService(StringRedisTemplate redis, ObjectMapper mapper, Clock clock, RentalProvider provider,
            @Value("\u0024{rental.cache-ttl:PT60S}") Duration ttl) {
        if (ttl == null || ttl.isNegative() || ttl.isZero() || ttl.compareTo(Duration.ofMinutes(15)) > 0)
            throw new IllegalArgumentException("Invalid cache TTL");
        this.redis = redis; this.mapper = mapper; this.clock = clock; this.provider = provider; this.ttl = ttl;
    }`, methods: [
      { signature: 'private String key(long propertyId, RentalKind kind)', body: `        if (propertyId <= 0 || kind == null) throw new IllegalArgumentException("Invalid estimate key");
        return "reidy:rental:v1:" + propertyId + ":" + kind.name();` },
      { signature: 'private boolean valid(RentalEstimate estimate)', body: '        return estimate != null && estimate.amount() != null && estimate.amount().signum() >= 0 && estimate.asOf() != null;' },
      { signature: 'private boolean evict(String key)', body: `        try { return Boolean.TRUE.equals(redis.delete(key)); }
        catch (DataAccessException unavailable) { return false; }` },
      { signature: 'Optional<RentalEstimate> cached(long propertyId, RentalKind kind)', body: `        String key = key(propertyId, kind); String raw;
        try { raw = redis.opsForValue().get(key); }
        catch (DataAccessException unavailable) { return Optional.empty(); }
        if (raw == null) return Optional.empty();
        RentalEnvelope envelope;
        try { envelope = mapper.readValue(raw, RentalEnvelope.class); }
        catch (JsonProcessingException malformed) { evict(key); return Optional.empty(); }
        Instant now = clock.instant();
        if (envelope == null || !valid(envelope.estimate()) || envelope.createdAt() == null || envelope.expiresAt() == null
            || now.isBefore(envelope.createdAt()) || !now.isBefore(envelope.expiresAt())
            || !envelope.expiresAt().isAfter(envelope.createdAt())) {
            evict(key); return Optional.empty();
        }
        return Optional.of(envelope.estimate());` },
      { signature: 'void cache(long propertyId, RentalKind kind, RentalEstimate estimate)', body: `        String key = key(propertyId, kind);
        if (!valid(estimate)) throw new IllegalArgumentException("Invalid provider estimate");
        Instant now = clock.instant(); String json;
        try { json = mapper.writeValueAsString(new RentalEnvelope(estimate, now, now.plus(ttl))); }
        catch (JsonProcessingException failure) { throw new IllegalStateException("Estimate serialization failed", failure); }
        try { redis.opsForValue().set(key, json, ttl); }
        catch (DataAccessException unavailable) { /* A valid provider result is still usable. */ }` },
      { signature: 'public Optional<RentalEstimate> getOrLoad(long propertyId, RentalKind kind)', body: `        key(propertyId, kind); Optional<RentalEstimate> hit = cached(propertyId, kind);
        if (hit.isPresent()) return hit;
        RentalEstimate loaded = provider.load(propertyId, kind);
        if (loaded == null) return Optional.empty();
        cache(propertyId, kind, loaded); return Optional.of(loaded);` },
      { signature: 'public boolean invalidate(long propertyId, RentalKind kind)', body: '        return evict(key(propertyId, kind));' }
    ] }],
    expected: 'Fresh hits avoid provider calls. Misses load and cache valid results. Redis outages do not hide provider results, while provider failures still propagate. Expired or malformed cache data is never returned.',
    hints: ['Separate cache transport failures from provider/business failures.', 'Validate envelopes after deserialization; JSON parsing alone is not validation.', 'Capture one now and use an exclusive expiry boundary.', 'Keep the key version and estimate type explicit so representations do not collide.'],
    explanation: ['Redis TTL controls storage expiry, while the envelope deadline prevents incorrectly configured or migrated entries from being treated as fresh.', 'Fail-open cache reads improve availability but can increase provider traffic during an outage.', 'Invalidation can fail and concurrent misses can duplicate work. TTL bounds staleness, but stronger consistency or distributed single-flight requires another design.'],
    notes: 'Setup: starter-data-redis, Jackson with JavaTimeModule, a Clock bean, a RentalProvider bean, and Redis. Test miss/hit, two estimate types, exact expiry, null results, malformed JSON, bad envelope fields, provider failure, read/write outage, and invalidation failure. A serialization bug is intentionally not swallowed as a Redis outage. Use a controlled clock and isolated key namespace.'
  }),
  projectFeature({
    topic: 18, title: 'Build validated property-event delivery with deduplication and dead letters',
    statement: 'Property notifications arrive at least once and may contain malformed or conflicting events. Build an event boundary that validates the schema, atomically claims event identity with the notification write, and classifies poison events separately from retryable infrastructure failures.',
    requirements: [
      'Parse JSON into a version-1 event with non-null UUID, positive property ID, and type PropertyCreated or PropertyUpdated. Reject malformed and unsupported input as InvalidPropertyEvent.',
      'Build a deterministic payload fingerprint from the validated business fields. A matching duplicate is skipped; the same ID with different content is a poison event.',
      'Claim the processed ID and save the notification in one local database transaction. Let storage failures roll back both and reach Kafka.',
      'Configure two retries with one-second backoff for retryable failures. InvalidPropertyEvent goes directly to a dead-letter topic.',
      'A failed dead-letter publication must not be silently treated as recovered. Do not manually acknowledge before database work succeeds.',
      'Verify duplicate delivery, changed-content replay, malformed JSON, a notification failure after claiming, successful redelivery, and dead-letter routing.'
    ],
    imports: 'import java.util.*;\nimport com.fasterxml.jackson.core.JsonProcessingException;\nimport com.fasterxml.jackson.databind.ObjectMapper;\nimport org.springframework.context.annotation.*;\nimport org.springframework.kafka.annotation.KafkaListener;\nimport org.springframework.kafka.core.KafkaTemplate;\nimport org.springframework.kafka.listener.*;\nimport org.springframework.util.backoff.FixedBackOff;\nimport org.springframework.stereotype.Service;\nimport org.springframework.transaction.annotation.Transactional;',
    model: `record PropertyEvent(UUID eventId, long propertyId, String type, int version) {}
enum Claim { NEW, DUPLICATE, CONFLICT }
class InvalidPropertyEvent extends RuntimeException {
    InvalidPropertyEvent(String message) { super(message); }
    InvalidPropertyEvent(String message, Throwable cause) { super(message, cause); }
}
interface ProcessedPropertyEvents { Claim claim(UUID eventId, String fingerprint); }
interface PropertyNotifications { void save(UUID eventId, long propertyId, String type); }`,
    units: [
      { owner: '@Service\nclass PropertyEventConsumer', members: `    private final ObjectMapper mapper; private final ProcessedPropertyEvents processed; private final PropertyNotifications notifications;
    PropertyEventConsumer(ObjectMapper mapper, ProcessedPropertyEvents processed, PropertyNotifications notifications) {
        this.mapper = mapper; this.processed = processed; this.notifications = notifications;
    }`, methods: [
        { signature: 'PropertyEvent parse(String json)', body: `        if (json == null || json.isBlank()) throw new InvalidPropertyEvent("Missing event");
        try { PropertyEvent event = mapper.readValue(json, PropertyEvent.class); validate(event); return event; }
        catch (JsonProcessingException failure) { throw new InvalidPropertyEvent("Malformed event", failure); }` },
        { signature: 'void validate(PropertyEvent event)', body: `        if (event == null || event.eventId() == null || event.propertyId() <= 0 || event.version() != 1
            || event.type() == null || !Set.of("PropertyCreated", "PropertyUpdated").contains(event.type()))
            throw new InvalidPropertyEvent("Unsupported event");` },
        { signature: 'String fingerprint(PropertyEvent event)', body: '        validate(event); return event.version() + ":" + event.type() + ":" + event.propertyId();' },
        { signature: '@KafkaListener(topics = "property-events", groupId = "reidy-practice")\n    @Transactional\n    public void receive(String json)', body: `        PropertyEvent event = parse(json);
        Claim claim = processed.claim(event.eventId(), fingerprint(event));
        if (claim == Claim.CONFLICT) throw new InvalidPropertyEvent("Conflicting event ID");
        if (claim == Claim.NEW) notifications.save(event.eventId(), event.propertyId(), event.type());` }
      ] },
      { owner: '@Configuration\nclass PropertyEventRecovery', methods: [
        { signature: '@Bean\n    DefaultErrorHandler propertyErrorHandler(KafkaTemplate<Object, Object> template)', body: `        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(template);
        recoverer.setFailIfSendResultIsError(true);
        DefaultErrorHandler handler = new DefaultErrorHandler(recoverer, new FixedBackOff(1000L, 2L));
        handler.addNotRetryableExceptions(InvalidPropertyEvent.class);
        return handler;` }
      ] }
    ],
    expected: 'A duplicate creates no second notification. A failed database transaction can be redelivered. Invalid/conflicting events reach the DLT without repeated business attempts; DLT publication failures remain visible.',
    hints: ['Validate before claiming event identity.', 'Treat event ID and payload fingerprint as separate pieces of the deduplication record.', 'Keep the marker and notification on the same transaction manager.', 'Classify nonretryable domain/schema failures explicitly in the listener error handler.'],
    explanation: ['The database transaction does not atomically commit Kafka offsets. Durable deduplication makes the resulting redelivery window safe.', 'Retrying malformed input cannot make its schema valid; a dead-letter route makes the failure inspectable.', 'The fingerprint here is an unambiguous representation of this small validated schema, not a cryptographic signature or authenticity check.'],
    notes: 'Setup: spring-kafka, Jackson, a database transaction manager, Kafka StringDeserializer, and both stores in the same database transaction. claim must be atomic under a database uniqueness constraint and must not poison the transaction when a duplicate is observed. The DLT is property-events.DLT and needs compatible partitions. Verify actual DB state and broker delivery with integration tests; do not assume mock interaction counts prove transaction rollback.'
  })
];
