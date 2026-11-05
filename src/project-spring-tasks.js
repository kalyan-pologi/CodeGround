import { springChallenge } from '../practice/src/data/challenge-helpers.js';

function task({ topic, title, statement, expected, imports, types = '', owner, members = '', method, body, hint, setup }) {
  const source = implementation => `${imports}\n\n${types}\n\n${owner} {\n${members}\n    ${method} {\n${implementation}\n    }\n}\n`;
  return { ...springChallenge(topic, 'Medium', title, statement, expected,
    source('        // TODO implement the task in the project context below.\n        throw new UnsupportedOperationException("Not implemented");'),
    source(body), hint, setup, 'Java 17 | Spring Boot 3.5 exercise project required'), runtime: 'project' };
}

export const springTasks = [
  task({
    topic: 12, title: 'Inject and register ReidyAI notification channels',
    statement: 'Complete the NotificationRouter constructor. Inject all NotificationChannel beans, index them by their unique nonblank names, and fail construction for duplicate or blank names. The supplied send method must delegate to the chosen bean. Do not manually construct channel implementations.',
    expected: 'email and sms route to their corresponding beans. Duplicate email registration fails startup; an unknown channel is rejected.',
    imports: 'import java.util.*;\nimport org.springframework.stereotype.Service;',
    types: 'interface NotificationChannel { String name(); void send(String message); }',
    owner: '@Service\nclass NotificationRouter',
    members: `    private final Map<String, NotificationChannel> channels;
    public void send(String name, String message) {
        NotificationChannel channel = channels.get(name);
        if (channel == null) throw new IllegalArgumentException("Unknown channel");
        channel.send(message);
    }`,
    method: 'NotificationRouter(List<NotificationChannel> candidates)',
    body: `        Map<String, NotificationChannel> index = new HashMap<>();
        for (NotificationChannel channel : candidates) {
            String name = Objects.requireNonNull(channel.name());
            if (name.isBlank() || index.putIfAbsent(name, channel) != null)
                throw new IllegalArgumentException("Invalid or duplicate channel");
        }
        this.channels = Map.copyOf(index);`,
    hint: 'Receive the strategy beans through constructor injection, validate each registration, and freeze the lookup map.',
    setup: 'Requires spring-boot-starter and supplied email/sms implementation beans. Names are case-sensitive and candidate objects are non-null. Verify bean injection, duplicate names, unknown channels, and delegation to exactly one bean. Explain why constructor injection makes this router easier to test.'
  }),
  task({
    topic: 13, title: 'Create a validated property REST endpoint',
    statement: 'Implement POST /api/properties. Validate a nonblank city and a positive non-null askingPrice, call PropertyCreator only for valid requests, and return 201 with Location /api/properties/{id} and a PropertyDto. Keep persistence entities out of the response.',
    expected: 'Valid JSON returns 201 and the new resource location. Blank city, missing price, zero price, or negative price returns 400 before the creator runs.',
    imports: 'import java.math.BigDecimal;\nimport java.net.URI;\nimport jakarta.validation.Valid;\nimport jakarta.validation.constraints.*;\nimport org.springframework.http.ResponseEntity;\nimport org.springframework.web.bind.annotation.*;',
    types: `record CreateProperty(@NotBlank String city, @NotNull @Positive BigDecimal askingPrice) {}
record PropertyDto(long id, String city, BigDecimal askingPrice) {}
interface PropertyCreator { PropertyDto create(String city, BigDecimal askingPrice); }`,
    owner: '@RestController\nclass PropertyController',
    members: '    private final PropertyCreator creator;\n    PropertyController(PropertyCreator creator) { this.creator = creator; }',
    method: '@PostMapping("/api/properties")\n    ResponseEntity<PropertyDto> create(@Valid @RequestBody CreateProperty request)',
    body: `        PropertyDto created = creator.create(request.city(), request.askingPrice());
        return ResponseEntity.created(URI.create("/api/properties/" + created.id())).body(created);`,
    hint: 'Apply constraints to the request DTO, activate request-body validation, delegate once, and build a created response.',
    setup: 'Requires spring-boot-starter-web, spring-boot-starter-validation, and a PropertyCreator bean. This is a focused exercise DTO, not a replacement for all existing ReidyAI property fields. Verify validation, Location, response fields, and no service invocation for invalid JSON.'
  }),
  task({
    topic: 14, title: 'Paginate property search in the database',
    statement: 'Implement search using the supplied Spring Data repository. Validate city, nonnegative maximum price, a nonnegative page number, and size from 1–100. Trim the requested city, use the repository query for case-insensitive city and inclusive price filtering, and sort by id. Do not load all properties and paginate them in memory.',
    expected: 'Only matching rows are retrieved for the requested page. Repeated requests have deterministic ID ordering, and invalid page parameters are rejected.',
    imports: 'import java.math.BigDecimal;\nimport jakarta.persistence.Entity;\nimport jakarta.persistence.Id;\nimport org.springframework.data.domain.*;\nimport org.springframework.data.jpa.repository.JpaRepository;\nimport org.springframework.data.jpa.repository.Query;\nimport org.springframework.data.repository.query.Param;\nimport org.springframework.stereotype.Service;\nimport org.springframework.transaction.annotation.Transactional;',
    types: `@Entity class PropertyEntity {
    @Id Long id;
    String city;
    BigDecimal askingPrice;
}
interface PropertySearchRepository extends JpaRepository<PropertyEntity, Long> {
    @Query("select p from PropertyEntity p where lower(p.city) = lower(:city) and p.askingPrice <= :price")
    Page<PropertyEntity> search(@Param("city") String city, @Param("price") BigDecimal price, Pageable pageable);
}`,
    owner: '@Service\nclass PropertySearch',
    members: '    private final PropertySearchRepository repository;\n    PropertySearch(PropertySearchRepository repository) { this.repository = repository; }',
    method: '@Transactional(readOnly = true)\n    public Page<PropertyEntity> search(String city, BigDecimal maximumPrice, int page, int size)',
    body: `        if (city == null || city.isBlank() || maximumPrice == null || maximumPrice.signum() < 0
            || page < 0 || size < 1 || size > 100) throw new IllegalArgumentException("Invalid search");
        return repository.search(city.strip(), maximumPrice, PageRequest.of(page, size, Sort.by("id")));`,
    hint: 'Validate at the service boundary, construct a bounded Pageable, and let SQL perform the filtering and page selection.',
    setup: 'Requires data-jpa and a database. The supplied entity and repository are exercise scaffolding. Test using @DataJpaTest with mixed-case cities, a price on the boundary, multiple pages, and no matches. The service returns entities internally; map them to DTOs at the API boundary. Page can issue a count query; consider Slice when counts are unnecessary.'
  }),
  task({
    topic: 15, title: 'Persist an appraisal and its outbox event atomically',
    statement: 'Implement record for a completed appraisal. Validate a positive property ID, assign separate UUIDs to the appraisal and event, and persist both in one database transaction. The event references the appraisal ID. Do not publish to Kafka in this method. A persistence failure must leave neither row committed.',
    expected: 'Success commits one appraisal and one AppraisalRecorded outbox row. Failure saving either rolls back both. No broker call occurs inside the transaction.',
    imports: 'import java.util.UUID;\nimport jakarta.persistence.*;\nimport org.springframework.stereotype.Service;\nimport org.springframework.transaction.annotation.Transactional;',
    types: `@Entity class AppraisalRecord {
    @Id UUID id;
    long propertyId;
    protected AppraisalRecord() {}
    AppraisalRecord(UUID id, long propertyId) { this.id = id; this.propertyId = propertyId; }
}
@Entity class OutboxRecord {
    @Id UUID id;
    UUID appraisalId;
    String eventType;
    protected OutboxRecord() {}
    OutboxRecord(UUID id, UUID appraisalId, String eventType) {
        this.id = id; this.appraisalId = appraisalId; this.eventType = eventType;
    }
}`,
    owner: '@Service\nclass AppraisalWriter', members: '    @PersistenceContext EntityManager entityManager;',
    method: '@Transactional\n    public UUID record(long propertyId)',
    body: `        if (propertyId <= 0) throw new IllegalArgumentException("Invalid property ID");
        UUID appraisalId = UUID.randomUUID();
        entityManager.persist(new AppraisalRecord(appraisalId, propertyId));
        entityManager.persist(new OutboxRecord(UUID.randomUUID(), appraisalId, "AppraisalRecorded"));
        return appraisalId;`,
    hint: 'Create identifiers, persist the business result and publication intent, and let one transaction commit them together.',
    setup: 'Requires data-jpa, one transactional database, and proxy-based invocation of this service. Test committed row counts from outside the transaction after an injected persistence failure. This models the write-side outbox boundary only; credits, idempotency, broker publishing, and retry belong to separate tasks.'
  }),
  task({
    topic: 16, title: 'Authorize appraisal access for the owner or an administrator',
    statement: 'Implement canRead for a Spring Security policy bean. Grant access only to an authenticated non-anonymous principal whose numeric name equals the stored owner ID, or one with ROLE_ADMIN. Deny null authentication, unauthenticated users, anonymous tokens, and invalid owner IDs. The ownerId must come from the stored resource, not a client-supplied ownership claim.',
    expected: 'Owner and authenticated administrator can read. Another user, anonymous authentication, and missing authentication cannot read.',
    imports: 'import org.springframework.security.core.Authentication;\nimport org.springframework.security.authentication.AnonymousAuthenticationToken;\nimport org.springframework.stereotype.Component;',
    owner: '@Component("propertyAccess")\nclass PropertyAccess',
    method: 'public boolean canRead(long ownerId, Authentication authentication)',
    body: `        if (ownerId <= 0 || authentication == null || !authentication.isAuthenticated()
            || authentication instanceof AnonymousAuthenticationToken) return false;
        boolean admin = authentication.getAuthorities().stream()
            .anyMatch(authority -> authority.getAuthority().equals("ROLE_ADMIN"));
        return admin || Long.toString(ownerId).equals(authentication.getName());`,
    hint: 'Deny invalid or anonymous principals first, then check the administrator authority or exact owner identity.',
    setup: 'Requires spring-boot-starter-security. Assumes authenticated principal names are decimal user IDs and authorities come from trusted authentication. Test with authenticated, unauthenticated, and AnonymousAuthenticationToken instances. Integrate the policy at the service boundary after resolving the persisted owner, or enable method security and call the bean from an ownership-aware authorization expression.'
  }),
  task({
    topic: 17, title: 'Configure a bounded lifetime for cached rental estimates',
    statement: 'Implement a RedisCacheManager bean for the rental-estimates cache. Use a 60-second TTL and disable caching null values. The supplied reader caches by property ID and rental type, so distinct request types must not share a key. Do not implement a permanent in-memory cache or treat entry existence as proof of freshness.',
    expected: 'Same property/type can reuse a non-null estimate for up to 60 seconds. A different type uses a different key; null results are not cached.',
    imports: 'import java.math.BigDecimal;\nimport java.time.Duration;\nimport org.springframework.cache.annotation.*;\nimport org.springframework.context.annotation.*;\nimport org.springframework.data.redis.cache.*;\nimport org.springframework.data.redis.connection.RedisConnectionFactory;\nimport org.springframework.stereotype.Service;',
    types: `record RentalEstimate(BigDecimal monthlyRent) implements java.io.Serializable {}
interface EstimateSource { RentalEstimate fetch(long propertyId, String type); }
@Service class RentalReader {
    private final EstimateSource source;
    RentalReader(EstimateSource source) { this.source = source; }
    @Cacheable(cacheNames = "rental-estimates", key = "#p0 + ':' + #p1", unless = "#result == null")
    public RentalEstimate read(long propertyId, String type) { return source.fetch(propertyId, type); }
}`,
    owner: '@Configuration\n@EnableCaching\nclass RentalCaching',
    method: '@Bean\n    RedisCacheManager rentalCacheManager(RedisConnectionFactory factory)',
    body: `        RedisCacheConfiguration configuration = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofSeconds(60)).disableCachingNullValues();
        return RedisCacheManager.builder(factory)
            .cacheDefaults(configuration)
            .withCacheConfiguration("rental-estimates", configuration)
            .build();`,
    hint: 'Create a cache configuration with an explicit TTL and null policy, then register it with the Redis-backed manager.',
    setup: 'Requires starter-cache, starter-data-redis, Redis, and an EstimateSource bean. IDs and rental types are validated/canonicalized upstream. The exercise uses the default trusted Java serialization with a Serializable result; choose an explicit interoperable serializer for a shared production cache. Invoke the reader through its Spring proxy. Verify expiry, type-isolated keys, and null behavior against Redis; annotation presence alone does not prove caching.'
  }),
  task({
    topic: 18, title: 'Deduplicate property notifications inside a consumer transaction',
    statement: 'Implement receive for an at-least-once property event consumer. Atomically mark a new event ID and save one notification in the same database transaction. Skip duplicate IDs. Propagate failures so the transaction rolls back and Kafka can redeliver. Do not use an in-memory Set as a durable processed-event store.',
    expected: 'Two deliveries of the same event create one notification. If notification persistence fails, the processed marker rolls back and a later delivery can retry.',
    imports: 'import java.util.UUID;\nimport org.springframework.kafka.annotation.KafkaListener;\nimport org.springframework.stereotype.Service;\nimport org.springframework.transaction.annotation.Transactional;',
    types: `record PropertyEvent(UUID eventId, long propertyId) {}
interface ProcessedEvents { boolean insertIfAbsent(UUID eventId); }
interface NotificationStore { void save(UUID eventId, long propertyId); }`,
    owner: '@Service\nclass PropertyNotificationConsumer',
    members: `    private final ProcessedEvents processed;
    private final NotificationStore notifications;
    PropertyNotificationConsumer(ProcessedEvents processed, NotificationStore notifications) {
        this.processed = processed; this.notifications = notifications;
    }`,
    method: '@KafkaListener(topics = "property-events", groupId = "reidy-practice")\n    @Transactional\n    public void receive(PropertyEvent event)',
    body: `        if (processed.insertIfAbsent(event.eventId()))
            notifications.save(event.eventId(), event.propertyId());`,
    hint: 'Use a durable, atomic new-event claim and save the notification in the same local transaction. Let failures escape.',
    setup: 'Requires spring-kafka, a database transaction manager, listener deserialization, and both stores participating in that database transaction. insertIfAbsent must use a database uniqueness constraint and a safe atomic insert-if-absent operation that does not poison the transaction on duplicates. Kafka offsets must not be acknowledged before successful processing. Verify duplicate delivery and failure/redelivery with a real database. Database and Kafka commits are not one atomic transaction here; deduplication makes redelivery safe.'
  }),
  task({
    topic: 19, title: 'Bound the appraisal service property lookup time',
    statement: 'Build a RestClient bean for appraisal-to-property HTTP reads. Set a one-second connect timeout and a two-second read timeout using SimpleClientHttpRequestFactory, and use the configured base URL. Do not introduce automatic retries for paid appraisal writes. Use this client for property lookup before opening the billing transaction.',
    expected: 'Connection establishment and response reads are bounded. A failed property lookup reaches the caller before credit deduction begins.',
    imports: 'import org.springframework.beans.factory.annotation.Value;\nimport org.springframework.context.annotation.*;\nimport org.springframework.http.client.SimpleClientHttpRequestFactory;\nimport org.springframework.web.client.RestClient;',
    owner: '@Configuration\nclass PropertyClientConfiguration',
    method: '@Bean\n    RestClient propertyClient(@Value("${property.base-url}") String baseUrl)',
    body: `        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(1000);
        factory.setReadTimeout(2000);
        return RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();`,
    hint: 'Configure the request factory, attach it to the client builder, and separate the remote lookup from the database transaction.',
    setup: 'Requires starter-web and property.base-url configuration. Verify a normal response, a slow read, connection failures, and no billing side effect after a lookup failure. These are per-connect and per-read limits, not a guaranteed end-to-end deadline; retries and a total request budget require additional design. This configuration is an isolated exercise rather than a replacement for the existing ReidyAI resilience setup.'
  }),
  task({
    topic: 20, title: 'Test property validation and creation with MockMvc',
    statement: 'Complete the MVC slice test for the supplied POST endpoint. First send a blank city and assert 400 with no creator interaction. Then stub a valid creation, send valid JSON, and assert 201, Location, and the DTO ID. Keep authentication outside this validation-focused slice.',
    expected: 'Blank city never calls PropertyCreator. Valid Chicago JSON creates property 42 and returns Location /api/properties/42.',
    imports: 'import java.math.BigDecimal;\nimport java.net.URI;\nimport jakarta.validation.Valid;\nimport jakarta.validation.constraints.*;\nimport org.junit.jupiter.api.Test;\nimport org.springframework.beans.factory.annotation.Autowired;\nimport org.springframework.boot.test.autoconfigure.web.servlet.*;\nimport org.springframework.test.context.bean.override.mockito.MockitoBean;\nimport org.springframework.http.*;\nimport org.springframework.web.bind.annotation.*;\nimport org.springframework.test.web.servlet.MockMvc;\nimport static org.mockito.Mockito.*;\nimport static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;\nimport static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;',
    types: `record CreateProperty(@NotBlank String city, @NotNull @Positive BigDecimal askingPrice) {}
record PropertyDto(long id, String city, BigDecimal askingPrice) {}
interface PropertyCreator { PropertyDto create(String city, BigDecimal askingPrice); }
@RestController class PropertyController {
    private final PropertyCreator creator;
    PropertyController(PropertyCreator creator) { this.creator = creator; }
    @PostMapping("/api/properties") ResponseEntity<PropertyDto> create(@Valid @RequestBody CreateProperty request) {
        PropertyDto result = creator.create(request.city(), request.askingPrice());
        return ResponseEntity.created(URI.create("/api/properties/" + result.id())).body(result);
    }
}`,
    owner: '@WebMvcTest(PropertyController.class)\n@AutoConfigureMockMvc(addFilters = false)\nclass PropertyControllerTest',
    members: '    @Autowired MockMvc mvc;\n    @MockitoBean PropertyCreator creator;',
    method: '@Test\n    void validatesBeforeCreating() throws Exception',
    body: `        mvc.perform(post("/api/properties").contentType(MediaType.APPLICATION_JSON)
            .content("{\\"city\\":\\" \\",\\"askingPrice\\":250000}"))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(creator);
        when(creator.create("Chicago", new BigDecimal("250000")))
            .thenReturn(new PropertyDto(42, "Chicago", new BigDecimal("250000")));
        mvc.perform(post("/api/properties").contentType(MediaType.APPLICATION_JSON)
            .content("{\\"city\\":\\"Chicago\\",\\"askingPrice\\":250000}"))
            .andExpect(status().isCreated())
            .andExpect(header().string("Location", "/api/properties/42"))
            .andExpect(jsonPath("$.id").value(42));
        verify(creator).create("Chicago", new BigDecimal("250000"));`,
    hint: 'Exercise the invalid path before stubbing, verify no delegation, then test the valid response contract and verify exactly one call.',
    setup: 'Requires Boot 3.5 starter-web, starter-validation, starter-test, and a discoverable @SpringBootConfiguration. Use this in an isolated exercise package/project: the scaffold repeats DTO names from the REST task. Filters are disabled only to isolate validation; add separate security tests for authentication and CSRF. MockitoBean is available in the ReidyAI Spring version.'
  }),
  task({
    topic: 21, title: 'Measure appraisal latency on success and failure',
    statement: 'Implement record to time a supplied appraisal operation using Micrometer. Always stop the timer, return the original result, and propagate failures unchanged. Use the metric reidy.appraisal.duration with only the bounded outcome values success and error. Do not tag metrics with property IDs, user IDs, or request keys.',
    expected: 'Each invocation records one duration tagged by outcome, including failing invocations. Results and exceptions keep their original behavior.',
    imports: 'import java.util.function.Supplier;\nimport io.micrometer.core.instrument.*;\nimport org.springframework.stereotype.Component;',
    owner: '@Component\nclass AppraisalMetrics',
    members: '    private final MeterRegistry registry;\n    AppraisalMetrics(MeterRegistry registry) { this.registry = registry; }',
    method: 'public <T> T record(Supplier<T> operation)',
    body: `        Timer.Sample sample = Timer.start(registry);
        String outcome = "error";
        try {
            T result = operation.get();
            outcome = "success";
            return result;
        } finally {
            sample.stop(Timer.builder("reidy.appraisal.duration").tag("outcome", outcome).register(registry));
        }`,
    hint: 'Start timing before the operation, mark success only after it returns, and stop the sample in finally.',
    setup: 'Requires Micrometer from starter-actuator. Test with SimpleMeterRegistry and a controllable registry clock: success count 1, error count 1, unchanged return value, and the same exception instance rethrown. Assume the registry is healthy and the supplied operation is non-null. Bounded tags avoid a new time series per property or request.'
  })
];
