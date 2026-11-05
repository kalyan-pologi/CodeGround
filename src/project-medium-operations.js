import { projectFeature } from './project-feature-builder.js';

export const mediumOperationTasks = [
  projectFeature({
    topic: 19, title: 'Build a bounded and retry-aware property lookup gateway',
    statement: 'Appraisal creation reads a property from another service before billing. Build a typed HTTP gateway with bounded connect/read waits, a small retry policy for safe GET requests, explicit missing-resource behavior, and interrupt-aware backoff.',
    requirements: [
      'Configure a RestClient with a one-second connect timeout and two-second read timeout. Require an attempt limit from 1–3.',
      'Reject nonpositive property IDs before network work. Return Optional.empty for 404 and validate the ID in a successful response.',
      'Retry only network/resource-access failures and HTTP 502, 503, or 504. Do not retry validation/authentication errors, 429, or arbitrary runtime bugs.',
      'Use 100 ms then 200 ms backoff between attempts. Inject the sleeping operation so tests can record delays without waiting.',
      'On interruption, restore the thread interrupt flag and abort. Do not start another attempt on an already-interrupted thread.',
      'Propagate the final eligible failure after exhaustion. Keep this gateway outside the billing transaction and never reuse this retry wrapper for a paid write.'
    ],
    imports: 'import java.util.*;\nimport org.springframework.beans.factory.annotation.Value;\nimport org.springframework.context.annotation.*;\nimport org.springframework.http.client.SimpleClientHttpRequestFactory;\nimport org.springframework.web.client.*;\nimport org.springframework.stereotype.Service;',
    model: 'record RemoteProperty(long id, String city) {}\ninterface Sleeper { void pause(long milliseconds) throws InterruptedException; }',
    units: [
      { owner: '@Configuration\nclass PropertyHttpConfiguration', methods: [
        { signature: '@Bean\n    RestClient propertyRestClient(@Value("\u0024{property.base-url}") String baseUrl)', body: `        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(1000); factory.setReadTimeout(2000);
        return RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();` },
        { signature: '@Bean\n    Sleeper propertyLookupSleeper()', body: '        return Thread::sleep;' }
      ] },
      { owner: '@Service\nclass PropertyGateway', members: `    private final RestClient client; private final Sleeper sleeper; private final int attempts;
    PropertyGateway(RestClient client, Sleeper sleeper, @Value("\u0024{property.lookup-attempts:3}") int attempts) {
        if (attempts < 1 || attempts > 3) throw new IllegalArgumentException("Invalid attempt limit");
        this.client = client; this.sleeper = sleeper; this.attempts = attempts;
    }`, methods: [
        { signature: 'boolean retryable(RuntimeException failure)', body: `        if (failure instanceof ResourceAccessException) return true;
        if (failure instanceof RestClientResponseException response) {
            int status = response.getStatusCode().value();
            return status == 502 || status == 503 || status == 504;
        }
        return false;` },
        { signature: 'private RemoteProperty validate(RemoteProperty property, long requestedId)', body: `        if (property == null || property.id() != requestedId || property.city() == null || property.city().isBlank())
            throw new IllegalStateException("Invalid property response");
        return property;` },
        { signature: 'private void pause(int failedAttempt)', body: `        try { sleeper.pause(100L << (failedAttempt - 1)); }
        catch (InterruptedException failure) {
            Thread.currentThread().interrupt(); throw new IllegalStateException("Property lookup interrupted", failure);
        }` },
        { signature: 'public Optional<RemoteProperty> find(long propertyId)', body: `        if (propertyId <= 0) throw new IllegalArgumentException("Invalid property ID");
        for (int attempt = 1; attempt <= attempts; attempt++) {
            if (Thread.currentThread().isInterrupted()) throw new IllegalStateException("Property lookup interrupted");
            try {
                RemoteProperty property = client.get().uri("/api/properties/{id}", propertyId).retrieve().body(RemoteProperty.class);
                return Optional.of(validate(property, propertyId));
            } catch (RuntimeException failure) {
                if (failure instanceof RestClientResponseException response && response.getStatusCode().value() == 404)
                    return Optional.empty();
                if (attempt == attempts || !retryable(failure)) throw failure;
                pause(attempt);
            }
        }
        throw new IllegalStateException("No lookup attempt performed");` }
      ] }
    ],
    expected: '503 then success uses two GETs and one 100 ms delay. 404 returns empty without retry; 400 fails once. Three transient failures stop after two delays. Interrupted backoff aborts and preserves interruption.',
    hints: ['Define retry classification independently from the loop.', 'Count attempts and delays separately: the final failed attempt has no following delay.', 'Keep DTO validation outside the set of retryable transport failures.', 'Use a fake Sleeper and a local mock HTTP server for deterministic tests.'],
    explanation: ['A timeout does not generally prove a remote write failed, so this wrapper is deliberately limited to a safe property GET.', 'Connect and read limits bound individual phases, not an exact end-to-end deadline across DNS, connection, reads, and retries. A hard caller deadline needs additional cancellation/budget design.', 'A malformed successful response is a contract error, not a reason to repeat network work blindly.'],
    notes: 'Setup: starter-web, configured property.base-url, and an isolated exercise client bean. Test success, empty body, mismatched response ID, 404, 400, 429, 503→success, exhausted retries, and interrupted backoff. Assert no billing call after lookup failure. Use a controllable HTTP fixture; compilation alone does not verify timing behavior.'
  }),
  projectFeature({
    topic: 21, title: 'Build bounded-cardinality appraisal and import instrumentation',
    statement: 'Instrument appraisal operations, rental cache outcomes, and partner-import batches. Record success and failure durations without changing the operation’s result, expose current in-flight work, and keep identifiers out of metric tags.',
    requirements: [
      'Use an enum for PAID, FREE, and RENTAL operations. Only success, not_found, and error are permitted duration outcomes.',
      'Increment in-flight work before an operation and decrement it in finally, including failures. Register a gauge backed by the shared counter.',
      'Record one duration for each operation. Return its exact result or rethrow the same exception instance; classify NoSuchElementException as not_found.',
      'Record rental cache hit/miss counters with bounded labels. Do not tag by property, account, request key, or raw exception message.',
      'Record attempted/rejected import counts and a batch-size distribution. Reject negative values or rejected > attempted before incrementing metrics.',
      'Test with SimpleMeterRegistry and a controlled registry clock. Include concurrent in-flight work, success, missing result, error, and invalid batch accounting.'
    ],
    imports: 'import java.util.Locale;\nimport java.util.NoSuchElementException;\nimport java.util.Objects;\nimport java.util.concurrent.atomic.AtomicInteger;\nimport java.util.function.Supplier;\nimport io.micrometer.core.instrument.*;\nimport org.springframework.stereotype.Component;',
    model: 'enum AppraisalOperation { PAID, FREE, RENTAL }',
    units: [{ owner: '@Component\nclass AppraisalInstrumentation', members: `    private final MeterRegistry registry;
    private final AtomicInteger inFlight = new AtomicInteger();
    AppraisalInstrumentation(MeterRegistry registry) {
        this.registry = Objects.requireNonNull(registry);
        Gauge.builder("reidy.appraisal.inflight", inFlight, AtomicInteger::get).register(registry);
    }`, methods: [
      { signature: 'public <T> T timed(AppraisalOperation operation, Supplier<T> work)', body: `        Objects.requireNonNull(operation); Objects.requireNonNull(work);
        inFlight.incrementAndGet(); Timer.Sample sample = Timer.start(registry); String outcome = "error";
        try {
            T result = work.get(); outcome = "success"; return result;
        } catch (NoSuchElementException missing) { outcome = "not_found"; throw missing; }
        finally {
            inFlight.decrementAndGet();
            sample.stop(Timer.builder("reidy.appraisal.duration")
                .tag("operation", operation.name().toLowerCase(Locale.ROOT)).tag("outcome", outcome).register(registry));
        }` },
      { signature: 'public void cacheResult(boolean hit)', body: `        Counter.builder("reidy.rental.cache.requests").tag("outcome", hit ? "hit" : "miss").register(registry).increment();` },
      { signature: 'public void importBatch(int attempted, int rejected)', body: `        if (attempted < 0 || rejected < 0 || rejected > attempted) throw new IllegalArgumentException("Invalid batch counts");
        Counter.builder("reidy.import.accepted").register(registry).increment(attempted - rejected);
        Counter.builder("reidy.import.rejected").register(registry).increment(rejected);
        DistributionSummary.builder("reidy.import.batch.size").register(registry).record(attempted);` },
      { signature: 'public int currentInFlight()', body: '        return inFlight.get();' }
    ] }],
    expected: 'Each call adds exactly one outcome duration, in-flight returns to zero, results/exceptions are unchanged, and import counters reflect accepted/rejected totals without high-cardinality tags.',
    hints: ['Choose a fixed vocabulary of metric labels before instrumenting code.', 'Use finally for both lifecycle accounting and duration recording.', 'Assert timer counts and exact exception identity in tests.', 'Treat batch totals as metric values, not new tag values.'],
    explanation: ['A timer already records count and duration, so an extra request counter can be redundant.', 'IDs in metric labels create one series per identifier and can overwhelm the monitoring backend.', 'The AtomicInteger supports visibility and concurrent accounting, but a gauge is an observation of current state rather than a complete history of every transition.'],
    notes: 'Setup: starter-actuator/Micrometer and one instrumentation bean. Assume a healthy registry. Use SimpleMeterRegistry with a controllable Micrometer clock to test durations; a Java Clock does not control Timer.start. Add a latch-based concurrency test, zero-sized batch, invalid counts, immutable tag vocabulary inspection, and the same-exception rethrow assertion. Real backend export configuration is a separate integration concern.'
  })
];
