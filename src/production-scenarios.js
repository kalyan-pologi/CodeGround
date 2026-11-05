export const productionScenarios = [
  {
    id: 'n-plus-one', category: 'Database performance', title: 'Property browsing triggers N+1 database queries',
    context: 'A property-service exercise model owns Property and Photo entities. Browsing 30 properties now executes a separate photo query for each row. Keep this relationship within one service database.',
    symptoms: ['Query count grows with the page size even though the API makes one repository call.', 'Database latency dominates the response; repeated selects differ only by property ID.'],
    investigate: ['Create 100 properties with several photos each and capture SQL/query counts for page sizes 10 and 30.', 'Trace DTO mapping and lazy collection access inside the service transaction.', 'Check whether a proposed collection fetch join with Pageable triggers in-memory pagination.'],
    tasks: ['Fetch the bounded page of IDs first, then fetch those properties and photos in one bounded query.', 'Restore the page’s ID order when mapping DTOs; do not rely on IN-query result ordering.', 'Keep DTO mapping in a read-only transaction and avoid changing every association to EAGER.'],
    checks: ['Query count is bounded by the ID-page query, optional count query, and one detail-fetch query.', 'Changing from 10 to 30 rows does not add one query per property.', 'Page boundaries, photo counts, and stable ID ordering remain correct; no lazy serialization queries occur.'],
    hints: ['Count queries before changing mappings.', 'Collection fetching and pagination should be separated.', 'Use a map to restore the original page order.'],
    language: 'java',
    reference: `// Repository: page IDs without fetching the collection.
@Query("select p.id from Property p order by p.id")
Page<Long> pageIds(Pageable pageable);

@EntityGraph(attributePaths = "photos")
@Query("select p from Property p where p.id in :ids")
List<Property> withPhotos(@Param("ids") Collection<Long> ids);

// Service, inside @Transactional(readOnly = true):
Page<Long> ids = repository.pageIds(PageRequest.of(page, size));
if (ids.isEmpty()) return new PageImpl<>(List.of(), ids.getPageable(), ids.getTotalElements());
Map<Long, Property> byId = repository.withPhotos(ids.getContent()).stream()
    .collect(Collectors.toMap(Property::getId, Function.identity()));
return ids.map(id -> toDto(Objects.requireNonNull(byId.get(id))));`,
    explanation: 'Paging the root IDs avoids paginating a multiplied collection join. Fetching the detail graph for only those IDs keeps the query count bounded. A count query may still be required by Page; use Slice when totals are unnecessary.',
    deliverables: 'Provide the fixture, before/after SQL counts, repository/service changes, and a regression test asserting query growth stays bounded.'
  },
  {
    id: 'missing-index', category: 'Database performance', title: 'Property search scans the entire table',
    context: 'Use a disposable search table with id, city_normalized, and price. The fixture stores a canonical city value, so the query can compare it directly without applying a function to the indexed column.',
    symptoms: ['Latency increases with total table size, including queries that return only 50 rows.', 'The actual execution plan shows a broad scan and high logical reads.'],
    investigate: ['Seed enough varied cities to make selectivity visible; do not benchmark a five-row table.', 'Capture the actual plan and logical reads for a city-and-ID cursor query.', 'Check existing indexes, column order, statistics, and whether normalization changes the predicate.'],
    tasks: ['Add a composite index that supports equality on city_normalized and an ordered range on id.', 'Keep the result bounded and compare the same query/data before and after the index.', 'Measure import/write cost and index storage as well as read improvement.'],
    checks: ['The chosen plan and reads improve for the representative fixture; document the observed plan rather than assuming an index is used.', 'The query still returns the same ordered rows and handles a missing city.', 'The write benchmark and additional index size are recorded.'],
    hints: ['Leading index columns should match the actual predicate.', 'A function such as lower(city) can change which index is useful.', 'Small tables can legitimately be scanned by the optimizer.'],
    language: 'sql',
    reference: `-- H2 exercise schema. Adapt row-limiting syntax to the target database.
CREATE INDEX ix_property_city_id ON properties(city_normalized, id);

SELECT id, city_normalized, price
FROM properties
WHERE city_normalized = ? AND id > ?
ORDER BY id
FETCH FIRST 50 ROWS ONLY;

-- Inspect the plan with real bound values:
EXPLAIN ANALYZE
SELECT id, city_normalized, price
FROM properties
WHERE city_normalized = 'chicago' AND id > 1000
ORDER BY id
FETCH FIRST 50 ROWS ONLY;`,
    explanation: 'The index is chosen for this specific equality/range/order pattern. It does not prove every city/price query is optimized. Different predicates, selectivity, statistics, and engines can produce a different plan.',
    deliverables: 'Provide reproducible seed data, plans, timings/reads, index migration, and the read/write tradeoff.'
  },
  {
    id: 'slow-pagination', category: 'Database performance', title: 'Deep property pages become slow and unstable',
    context: 'A feed is ordered by immutable created_at and id, with owner_id applied server-side. Large offsets make later pages expensive while concurrent inserts shift offset boundaries.',
    symptoms: ['Page 1 is fast while page 10,000 is slow.', 'Users see repeats or gaps after new rows are inserted ahead of an offset page.'],
    investigate: ['Compare actual plans and reads for shallow and deep offsets.', 'Check whether ordering has a unique tie-breaker.', 'Reproduce pagination while inserting rows with equal timestamps.'],
    tasks: ['Replace the deep-offset path with a cursor containing both created_at and id.', 'Retain the authorized owner predicate and a bounded limit on every request.', 'Validate cursor values and test the compound boundary; keep ordering columns immutable.'],
    checks: ['A row with the cursor timestamp and a larger ID is included; a smaller/equal ID is excluded.', 'New rows do not cause offset-style movement of already traversed rows.', 'Explain which newly inserted rows may not appear and why keyset pagination is not a frozen snapshot.'],
    hints: ['Timestamp alone is not a unique cursor.', 'Use a lexicographic predicate with the same order as the query.', 'Do not trust a cursor to establish ownership.'],
    language: 'sql',
    reference: `CREATE INDEX ix_property_owner_created_id
ON properties(owner_id, created_at, id);

SELECT id, created_at, city
FROM properties
WHERE owner_id = ?
  AND (created_at > ? OR (created_at = ? AND id > ?))
ORDER BY created_at, id
FETCH FIRST 50 ROWS ONLY;`,
    explanation: 'A keyset cursor identifies the position after the last row rather than the number of rows to skip. The API should derive the owner from authentication. Snapshot consistency across a changing dataset requires an additional version or snapshot policy.',
    deliverables: 'Provide cursor DTO/validation, repository query, a concurrent-insert regression test, and shallow/deep read comparisons.'
  },
  {
    id: 'deadlocks', category: 'Concurrency', title: 'Opposite credit transfers deadlock',
    context: 'An exercise transfer moves integer credits between two accounts in one database. Two requests lock the same accounts in opposite order.',
    symptoms: ['One transaction is selected as a deadlock victim while the opposite transfer succeeds.', 'Database lock diagnostics show a cycle between the same account rows.'],
    investigate: ['Reproduce with two workers and barriers after each first lock.', 'Capture the database deadlock graph and identify the inconsistent lock order.', 'Check other account writers for compatible locking and external calls inside transactions.'],
    tasks: ['Acquire account locks in ascending immutable account-ID order regardless of transfer direction.', 'Validate distinct accounts, positive amounts, and sufficient credits before changing balances.', 'Keep both updates in one transaction; if retrying a deadlock victim, retry the complete rolled-back, idempotent operation outside that transaction.'],
    checks: ['The controlled opposite-direction test no longer creates that lock cycle.', 'An injected failure after debit commits neither balance change.', 'Total credits remain unchanged under concurrent transfers, and retries cannot repeat a completed transfer key.'],
    hints: ['Order locks by identity, not by source/destination role.', 'A caught exception does not make a failed transaction safe to reuse.', 'Stable ordering fixes this pattern, not every possible database deadlock.'],
    language: 'java',
    reference: `@Transactional
public void transfer(long from, long to, int credits) {
    if (from == to || credits <= 0) throw new IllegalArgumentException();
    Account first = accounts.lock(Math.min(from, to));
    Account second = accounts.lock(Math.max(from, to));
    Account source = from < to ? first : second;
    Account target = from < to ? second : first;
    if (source.credits() < credits) throw new IllegalStateException("Insufficient credits");
    int credited = Math.addExact(target.credits(), credits);
    source.setCredits(source.credits() - credits);
    target.setCredits(credited);
}`, 
    explanation: 'All competing writers must follow the same ordering. Deadlock retries also need a stable transfer key and a transaction that records completion; the shortened reference focuses on the locking/accounting boundary.',
    deliverables: 'Provide the deadlock reproduction, graph, lock-order fix, rollback test, and an explicit retry/idempotency policy.'
  },
  {
    id: 'lock-timeouts', category: 'Concurrency', title: 'Slow appraisal lookups hold credit locks',
    context: 'A billing method opens a transaction and locks an account before performing a remote property lookup. A slow dependency turns a short database update into a long lock holder.',
    symptoms: ['Requests for the same account queue or fail with lock timeouts.', 'Database lock duration closely follows remote HTTP latency.'],
    investigate: ['Trace transaction start, lock acquisition, network timing, and commit.', 'Hold the property response deliberately and observe competing requests.', 'Verify whether the configured lock timeout is actually honored by the database/provider.'],
    tasks: ['Move property lookup to a nontransactional facade and keep the locked writer in a separate Spring bean.', 'Recheck the request key and available credits after the writer acquires the account lock.', 'Configure and test an actual database-supported lock wait limit; return a retryable response without claiming that billing succeeded.'],
    checks: ['A delayed lookup does not hold the account lock.', 'A failed lookup deducts no credits and creates no paid report.', 'A forced lock wait terminates within the configured tolerance, with no partial write.'],
    hints: ['Separate beans make the proxy transaction boundary explicit.', 'A preflight read is an optimization, not a substitute for the locked recheck.', 'A JPA timeout hint is not proof that the database honors it.'],
    language: 'java',
    reference: `// Facade is not transactional and must not be called inside a surrounding transaction.
public PaidReport request(ChargeIntent intent) {
    Optional<PaidReport> replay = billing.replay(intent);
    if (replay.isPresent()) return replay.get();
    propertyClient.get(intent.propertyId()); // bounded network lookup
    return billing.create(intent);          // separate proxy-managed transaction
}

// Writer, in another Spring bean:
@Transactional
public PaidReport create(ChargeIntent intent) {
    Account account = accounts.lock(intent.accountId());
    // Recheck key + credits; save debit, report, and outbox together.
    return persistPaidAppraisal(account, intent);
}`, 
    explanation: 'Reducing lock duration is different from increasing the lock timeout. The latter can hide the bottleneck and grow the waiting queue. Keep remote work out of the database transaction and verify the actual wait policy.',
    deliverables: 'Provide a timeline, transaction-boundary change, timeout configuration, and concurrent-request tests.'
  },
  {
    id: 'retry-storms', category: 'Concurrency', title: 'Property lookup failures trigger a retry storm',
    context: 'Client, gateway, and service layers each retry a failing property GET three times. One user action can multiply downstream attempts while all callers retry on the same schedule.',
    symptoms: ['Dependency request volume rises sharply during an outage.', 'Traffic arrives in synchronized bursts and caller deadlines are exceeded.'],
    investigate: ['Count attempts across every layer, not just inside the service.', 'Compare retry timing and inspect whether 4xx responses or paid writes are retried.', 'Measure queued work and the remaining caller deadline before each new attempt.'],
    tasks: ['Choose one retry owner, cap attempts, retry only eligible idempotent reads, and add jitter.', 'Stop scheduling attempts when the caller budget is exhausted and bound each HTTP attempt with the client’s timeout/cancellation support.', 'Add a circuit-breaker/load-shedding policy and prove that a paid request cannot be duplicated through this generic retry path.'],
    checks: ['A failing request makes at most the configured attempts across the chosen boundary.', 'A deterministic seeded random source produces bounded, varied delays.', '400/401 and paid writes are not retried; exhausted budgets do not schedule another attempt.'],
    hints: ['Three retries at several layers multiply rather than add.', 'Use monotonic elapsed time for a request budget.', 'Jitter changes timing; it does not itself bound attempts.'],
    language: 'java',
    reference: `long jitterMillis(int failedAttempt, Random random) {
    if (failedAttempt < 1 || failedAttempt > 2) throw new IllegalArgumentException();
    long cap = Math.min(1000L, 100L << (failedAttempt - 1));
    return random.nextLong(cap + 1); // full jitter: 0..cap
}

// Retry owner: maxAttempts = 3.
// Before another attempt: check remaining monotonic budget.
// Retry only the safe GET's approved transient failures.
// Bound the actual HTTP call too; a pre-call budget check alone is not a hard deadline.`,
    explanation: 'The reference is a delay policy to integrate with the gateway task, not a complete retry engine. Do not add retries around side effects without server-side idempotency and reconciliation of ambiguous outcomes.',
    deliverables: 'Provide an attempt-count trace, retry ownership decision, deterministic delay tests, and the bounded failure-path behavior.'
  },
  {
    id: 'cache-stampede', category: 'Caching', title: 'A hot rental key expires and overwhelms the provider',
    context: 'Many requests for the same property/type miss the rental cache simultaneously across two service instances. Each miss calls the expensive estimate provider.',
    symptoms: ['Provider calls spike at the cache TTL boundary.', 'Local single-flight helps one instance but duplicate loads remain across instances.'],
    investigate: ['Drive concurrent requests against one hot key and count provider calls per instance.', 'Check the difference between local coordination and a Redis-backed lease.', 'Simulate a loader crash and an expired lease before designing cleanup.'],
    tasks: ['Acquire a per-key Redis lease with a unique token and TTL, then recheck the cache after acquiring it.', 'Release only if the stored token still belongs to this loader; never use an unconditional delete.', 'Make waiters poll with jitter and a bounded deadline. Keep the provider deadline below the lease, or design renewal/fencing.'],
    checks: ['With the provider finishing inside the lease, concurrent requests across two instances collapse to one load.', 'A crashed loader does not block the key permanently.', 'An old loader cannot delete a newer owner’s lease; waiters terminate instead of waiting forever.'],
    hints: ['Double-check the cache after winning the lease.', 'Lease ownership is a token, not just key existence.', 'A fixed lease cannot guarantee one loader if the load outlives it.'],
    language: 'java',
    reference: `String token = UUID.randomUUID().toString();
boolean owner = Boolean.TRUE.equals(redis.opsForValue()
    .setIfAbsent(lockKey, token, Duration.ofSeconds(5)));
if (owner) {
    try {
        // Recheck cache, then call the provider with a shorter bounded deadline.
        // Publish a valid result; do not cache null.
    } finally {
        redis.execute(new DefaultRedisScript<Long>(
            "if redis.call('get', KEYS[1]) == ARGV[1] then " +
            "return redis.call('del', KEYS[1]) else return 0 end", Long.class),
            List.of(lockKey), token);
    }
} else {
    // Bounded jittered wait, re-read the cache, then return an explicit timeout/fallback.
}`, 
    explanation: 'A Redis lease reduces duplicate work; it is not automatically an exactly-once guarantee. Test crashes and lease expiry. A provider timeout shorter than the lease is an explicit assumption of the basic lab.',
    deliverables: 'Provide a two-instance load fixture, token-safe release, waiter bounds, and provider-call counts before/after.'
  },
  {
    id: 'stale-cache-race', category: 'Caching', title: 'An old load repopulates the cache after a property update',
    context: 'A loader reads version 5, a writer commits version 6 and deletes the cache, then the loader puts version 5 back under the unversioned key.',
    symptoms: ['The database is correct while new requests receive stale cached data.', 'The issue appears only when reads overlap a write; ordinary sequential tests pass.'],
    investigate: ['Use barriers to reproduce read-old → commit-new → invalidate → put-old.', 'Record which version each loader read and which key it wrote.', 'Check whether a supposedly authoritative version pointer is itself stale or cached.'],
    tasks: ['Use immutable versioned cache keys, with the current version read from the authoritative database boundary.', 'A loader may publish only under the snapshot version it actually loaded. Bound retries if the snapshot and selected version disagree.', 'Define the consistency guarantee for a read overlapping a write, and document the extra authoritative version lookup.'],
    checks: ['A request starting after version 6 commits cannot select the version-5 cache entry.', 'The old loader can finish without overwriting the version-6 key.', 'A read concurrent with a write follows the documented snapshot policy; retries remain bounded.'],
    hints: ['An unversioned delete does not stop an already-running loader.', 'Do not move the race into an eventually consistent version pointer.', 'Versioned keys trade extra reads/storage for a clearer selection rule.'],
    language: 'java',
    reference: `for (int attempt = 0; attempt < 3; attempt++) {
    long current = repository.currentVersion(propertyId); // authoritative primary
    String key = "property:" + propertyId + ":v" + current;
    Optional<PropertySnapshot> hit = cache.get(key);
    if (hit.isPresent() && hit.get().version() == current) return hit.get();
    PropertySnapshot snapshot = repository.loadSnapshot(propertyId);
    if (snapshot.version() != current) continue;
    cache.put(key, snapshot, ttl);
    return snapshot;
}
throw new ConcurrentModificationException("Property changed repeatedly");`,
    explanation: 'A write that commits after the version read may overlap this request, so the response can be linearized at that earlier read. Future requests read the newer version and select a different key. This is not a solution if currentVersion uses a lagging replica or stale cache.',
    deliverables: 'Provide the barrier-based race test, versioned-key implementation, cleanup/TTL policy, and an explicit consistency statement.'
  },
  {
    id: 'out-of-order-events', category: 'Messaging', title: 'Property update events arrive out of order',
    context: 'The communication service consumes versioned property deltas. Version 3 can arrive before versions 1 and 2. Applying the newest delta blindly loses intermediate changes.',
    symptoms: ['Projection versions move backwards or skip required state changes.', 'Retrying a gap event blocks the partition and prevents later missing events from being processed.'],
    investigate: ['Replay versions 3, 1, 2 with duplicates for one property.', 'Distinguish full snapshots from deltas: skipping versions has different meaning.', 'Inspect consumer partitioning, durable inbox contents, and the aggregate’s applied version.'],
    tasks: ['Store events in a durable deduplicated inbox and serialize projection advancement per property.', 'Apply only the next contiguous version, then drain any pending successors in the same database transaction.', 'Detect conflicting payloads for the same event/version and quarantine them. Alert on old version gaps rather than dropping them silently.'],
    checks: ['Receiving 3, 1, 2 ultimately applies exactly 1, 2, 3.', 'A duplicate event changes neither the projection nor notification count.', 'A crash between inbox receipt and later draining is recoverable; conflicting versions do not overwrite state.'],
    hints: ['Buffering a gap differs from retrying it at the head of a blocked partition.', 'Use both event identity and aggregate version constraints.', 'A locked projection/aggregate row gives one advancement order.'],
    language: 'java',
    reference: `@Transactional
public void receive(VersionedPropertyEvent event) {
    inbox.insertOrVerifyIdentical(event); // unique event ID + property/version
    Projection projection = projections.lock(event.propertyId());
    while (true) {
        Optional<InboxEvent> next = inbox.pending(event.propertyId(), projection.version() + 1);
        if (next.isEmpty()) break;
        projection.apply(next.get());
        inbox.markApplied(next.get().eventId());
    }
}
// A scheduled reconciler uses the same lock/drain boundary for pending inbox rows.`,
    explanation: 'The lab assumes an initial version-0 projection exists. Creating that anchor concurrently also needs an atomic strategy. Kafka delivery order alone is not enough once several producers, retries, or recovery paths are involved.',
    deliverables: 'Provide inbox constraints, the ordered drain, a 3/1/2 test, crash recovery, and a gap-age alert/runbook.'
  },
  {
    id: 'outbox-backlog', category: 'Messaging', title: 'A broker outage leaves a growing outbox backlog',
    context: 'Business writes continue while Kafka is unavailable. The relay repeatedly selects the same rows and, after recovery, attempts to publish the entire backlog at once.',
    symptoms: ['Oldest pending age rises while business APIs remain successful.', 'Several relay instances compete for rows or recovery traffic overwhelms the broker.'],
    investigate: ['Measure oldest pending age, due row count, attempts, and DEAD rows separately.', 'Trace a send accepted by Kafka followed by a database mark-sent failure.', 'Check claim leases and whether a relay holds database locks during network publication.'],
    tasks: ['Claim a bounded due batch in a short database transaction with a unique lease token.', 'Publish outside the claim transaction; mark SENT only after broker acknowledgment and only for the current lease owner.', 'Back off failures with jitter, cap attempts, preserve DEAD rows for inspection, and replay with the original event ID.'],
    checks: ['Broker downtime does not lose committed business events.', 'Two relay instances do not concurrently own the same unexpired claim.', 'An acknowledgment/mark-sent crash can duplicate delivery safely; backlog drain rate is bounded and DEAD replay remains idempotent.'],
    hints: ['At-least-once publication needs a deduplicating consumer.', 'A lease token prevents an expired worker from acknowledging a newer claim.', 'Oldest event age is more informative than queue depth alone.'],
    language: 'java',
    reference: `UUID claimToken = UUID.randomUUID(); // unique for this claim batch
List<ClaimedEvent> batch = claims.claimDue(100, claimToken, leaseDuration);
for (ClaimedEvent event : batch) {
    try {
        kafka.send(event.topic(), event.aggregateKey(), event.payload()).get(sendTimeout, TimeUnit.MILLISECONDS);
        claims.markSentIfOwned(event.id(), event.leaseToken());
    } catch (InterruptedException interrupted) {
        Thread.currentThread().interrupt(); break; // lease allows later recovery
    } catch (Exception failure) {
        claims.retryOrDeadIfOwned(event.id(), event.leaseToken(), nextAttemptAt(event.attempt()));
    }
}
// claim/mark/retry each have short DB boundaries; no DB transaction wraps Kafka waiting.`,
    explanation: 'The lease claim implementation is database-specific. Ownership checks, send timeouts, and conditional state changes are part of the exercise. A successful send followed by a failed SENT update must not be mistaken for exactly-once publication.',
    deliverables: 'Provide claim SQL/transactions, retry policy, relay metrics, a controlled outage test, and the DEAD replay procedure.'
  },
  {
    id: 'thread-pool-exhaustion', category: 'Operations', title: 'Slow notification work exhausts the executor',
    context: 'An unbounded notification queue grows while a downstream provider is slow. Request latency and retained heap rise even though CPU usage is modest.',
    symptoms: ['Queue depth and oldest queued-task age grow continuously.', 'Memory pressure and long tail latency appear before CPU saturation.'],
    investigate: ['Capture active threads, queue size, rejected work, and downstream latency.', 'Check whether pooled threads block indefinitely on remote calls.', 'Trace fire-and-forget async failures and confirm where rejected work goes.'],
    tasks: ['Use bounded worker and queue limits with explicit rejection behavior.', 'Bound downstream work and make overload visible; durable accepted notifications should remain in an outbox instead of disappearing.', 'Configure graceful shutdown and prove queued/in-flight behavior during termination.'],
    checks: ['With a blocked provider, total queued work stays within the configured bound.', 'Rejection increments a visible metric and produces the chosen API/outbox behavior.', 'Normal traffic recovers after the provider resumes, and shutdown does not silently acknowledge lost work.'],
    hints: ['More threads do not fix an indefinitely slow dependency.', 'CallerRunsPolicy moves blocking to callers; that tradeoff must be deliberate.', 'Measure queue age as well as size.'],
    language: 'java',
    reference: `@Bean
ThreadPoolTaskExecutor notificationExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(4);
    executor.setMaxPoolSize(8);
    executor.setQueueCapacity(50);
    executor.setThreadNamePrefix("notification-");
    executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
    executor.setWaitForTasksToCompleteOnShutdown(true);
    executor.setAwaitTerminationSeconds(20);
    return executor;
}
// Handle TaskRejectedException explicitly at the submission boundary.
// Persist accepted work before submission if it must survive process termination.`,
    explanation: 'These numbers are exercise limits, not universal production sizing. A bounded queue makes overload observable; it does not create capacity. Durable retry and service-level admission control complete the workflow.',
    deliverables: 'Provide a saturation fixture, executor configuration, rejection policy, metrics, and a shutdown/recovery test.'
  },
  {
    id: 'failed-deployment', category: 'Operations', title: 'A new property-service rollout never becomes ready',
    context: 'A new image starts but fails readiness because of a wrong port, missing secret, incompatible migration, or unavailable dependency. Diagnose the rollout without replacing all healthy replicas at once.',
    symptoms: ['New pods remain unready while old replicas still serve traffic.', 'Rollout progress stalls or a restart loop hides the original startup error.'],
    investigate: ['Inspect rollout events, image identity, current/previous container logs, probe responses, and environment configuration.', 'Distinguish readiness failure, liveness restart, image-pull failure, and scheduling/resource failure.', 'Check schema compatibility before deciding whether an application rollback is safe.'],
    tasks: ['Configure startup/readiness/liveness probes against the correct management port and keep external dependencies out of liveness.', 'Use a rolling strategy with healthy old capacity, a progress deadline, and graceful termination.', 'Practice a broken image/config rollout, diagnose it, and document application rollback plus an expand/contract migration plan.'],
    checks: ['A deliberately unready new version receives no service traffic while old capacity stays available.', 'A slow startup gets the intended startup budget without an immediate liveness restart storm.', 'The documented recovery restores readiness; schema changes remain compatible with both application versions.'],
    hints: ['Readiness decides traffic eligibility; liveness decides restart behavior.', 'maxUnavailable: 0 still requires enough cluster capacity for maxSurge.', 'Rolling back code cannot safely undo every database migration.'],
    language: 'yaml',
    reference: `# Deployment spec excerpt for the exercise; replace the image/config separately.
replicas: 2
progressDeadlineSeconds: 180
strategy:
  type: RollingUpdate
  rollingUpdate: { maxUnavailable: 0, maxSurge: 1 }
template:
  spec:
    terminationGracePeriodSeconds: 30
    containers:
      - name: property-service
        ports:
          - { name: http, containerPort: 8081 }
          - { name: management, containerPort: 9081 }
        env:
          - { name: MANAGEMENT_ENDPOINT_HEALTH_PROBES_ENABLED, value: "true" }
          - { name: SERVER_SHUTDOWN, value: graceful }
          - { name: SPRING_LIFECYCLE_TIMEOUT_PER_SHUTDOWN_PHASE, value: 20s }
        startupProbe:
          httpGet: { path: /actuator/health/liveness, port: management }
          failureThreshold: 24
          periodSeconds: 5
        readinessProbe:
          httpGet: { path: /actuator/health/readiness, port: management }
          periodSeconds: 5
        livenessProbe:
          httpGet: { path: /actuator/health/liveness, port: management }
          periodSeconds: 10`,
    explanation: 'The excerpt is not a complete Deployment manifest. Supply selectors, labels, an immutable image reference, resources, configuration, and any authentication needed by probes. Test whether readiness includes the dependencies the service actually needs; keep liveness independent of remote dependency outages.',
    deliverables: 'Provide the broken-rollout fixture, corrected probes/config, observed traffic behavior, and a recovery runbook with schema compatibility checks.'
  }
];
