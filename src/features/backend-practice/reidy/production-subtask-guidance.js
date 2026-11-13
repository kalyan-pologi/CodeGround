const guidance = {
  'n-plus-one': [
    ['Bound the page query', 'Collection joins multiply rows and lazy mapping triggers one query per property.', 'Latency and database load grow with page size.', 'Page IDs first, then fetch only that bounded detail graph.', 'Empty pages, missing rows, and oversized limits.', 'Compare SQL counts for page sizes 10 and 30.'],
    ['Preserve DTO order', 'IN queries do not guarantee the original page order.', 'Records can move between pages or appear incorrectly.', 'Map fetched entities by ID and rebuild the original order.', 'Duplicate IDs and concurrent deletes.', 'Assert deterministic IDs and explicit missing-row handling.'],
    ['Keep serialization safe', 'Lazy associations accessed outside the transaction create hidden queries.', 'Serialization can fail or cause latency spikes.', 'Map DTOs inside a read-only transaction.', 'Empty collections and accidental EAGER mappings.', 'Serialize after the transaction and assert bounded queries.']
  ],
  'missing-index': [
    ['Match the index', 'The predicate and ordering are not supported by the current index.', 'Reads and latency grow with table size.', 'Index city_normalized first and id second.', 'Low selectivity, nulls, stale statistics, and planner differences.', 'Capture EXPLAIN ANALYZE and logical reads.'],
    ['Keep results bounded', 'An optimized query can still return an unsafe amount of data.', 'Memory and network latency increase.', 'Validate the limit and preserve stable ordering.', 'Missing cities, invalid limits, and partial final pages.', 'Assert identical ordered rows and bounded results.'],
    ['Measure tradeoffs', 'Indexes improve reads but add storage and write maintenance.', 'Imports and updates may slow down.', 'Record read time, write time, index size, and plan choice.', 'Small tables and migration lock duration.', 'Include before/after measurements in the review.']
  ],
  'slow-pagination': [
    ['Use a compound cursor', 'Offsets scan skipped rows and shift when new rows arrive.', 'Deep pages become slow and unstable.', 'Use created_at plus id with a matching lexicographic predicate.', 'Equal timestamps, malformed cursors, and the first page.', 'Test the boundary and compare deep-page reads.'],
    ['Enforce authorization', 'A cursor must not identify the owner or tenant.', 'Forged cursors can expose another user’s rows.', 'Derive owner_id from the authenticated principal.', 'Revoked users, tenant changes, and expired cursors.', 'Try a cursor from another owner and expect no data.'],
    ['Define consistency', 'Keyset pagination is not a frozen snapshot.', 'New rows may be absent from an already traversed feed.', 'Keep order columns immutable and document visibility semantics.', 'Concurrent inserts, deletes, and timestamp updates.', 'Run concurrent-insert tests against the documented guarantee.']
  ],
  'deadlocks': [
    ['Make lock ordering universal', 'Opposite transfers lock the same rows in opposite order.', 'The database aborts one business operation.', 'Lock both accounts by ascending immutable ID.', 'Same-account transfers and inconsistent writers.', 'Use synchronized workers and assert the cycle disappears.'],
    ['Protect accounting invariants', 'Partial updates can create negative balances or overflow.', 'Total credits or balances become incorrect.', 'Validate under locks and update both rows atomically.', 'Overflow, insufficient funds, and injected failures.', 'Assert totals and rollback behavior.'],
    ['Retry safely', 'Retrying part of a transaction can duplicate a transfer.', 'A transient error becomes a financial bug.', 'Retry the complete operation with an idempotency key.', 'Ambiguous commits and exhausted retries.', 'Replay the same key and assert one application.']
  ],
  'lock-timeouts': [
    ['Separate remote work', 'A database lock is held while a remote service responds.', 'Unrelated requests queue behind network latency.', 'Perform bounded lookup before the short writer transaction.', 'Slow, failed, and ambiguous remote responses.', 'Delay the dependency and verify no lock is held.'],
    ['Recheck under lock', 'Preflight state can become stale before commit.', 'Requests can double-charge or overspend.', 'Re-read idempotency and balance after locking.', 'Concurrent duplicates and balance changes.', 'Run competing requests and assert one durable charge.'],
    ['Make timeout behavior honest', 'Application timeout settings may not be honored by the database.', 'Threads wait indefinitely and responses misreport success.', 'Use a supported lock wait limit and explicit retryable failure.', 'Interrupts, rollback, and provider-specific errors.', 'Force contention and assert bounded failure with no partial write.']
  ],
  'retry-storms': [
    ['Choose one retry owner', 'Retries at several layers multiply attempts.', 'An outage becomes a traffic storm.', 'Retry only eligible idempotent reads in one layer.', '4xx responses, writes, and hidden library retries.', 'Trace one request and assert the global attempt limit.'],
    ['Respect deadlines', 'Backoff can schedule work after the caller timed out.', 'Wasted work increases tail latency.', 'Track a monotonic deadline and cancel each network attempt.', 'Clock changes, interrupts, and timeout during response handling.', 'Use a fake clock and assert no late attempt starts.'],
    ['Contain the outage', 'Retries continue while the dependency is unhealthy.', 'Healthy callers and pools become starved.', 'Add circuit breaking, load shedding, metrics, and recovery rules.', 'Half-open probes and brief failure spikes.', 'Simulate an outage and measure bounded traffic.']
  ],
  'cache-stampede': [
    ['Coordinate instances', 'Local single-flight does not coordinate other instances.', 'A hot key overloads the provider at expiry.', 'Use a per-key distributed lease and double-check the cache.', 'Lease contention, empty values, and cache failure.', 'Run two instances and count provider calls.'],
    ['Protect lease ownership', 'An expired worker can delete a newer worker’s lease.', 'Multiple loaders run concurrently.', 'Release with an atomic compare-and-delete token.', 'Crash, expiry, and delayed cleanup.', 'Expire the first lease and verify late cleanup is harmless.'],
    ['Bound waiters', 'Waiters can poll forever when the loader fails.', 'Threads and memory remain occupied.', 'Use jitter, a deadline, and an explicit fallback.', 'Redis outage, provider timeout, and renewal.', 'Assert every waiter terminates within its deadline.']
  ],
  'stale-cache-race': [
    ['Prevent stale repopulation', 'An old loader can write after invalidation.', 'New requests receive stale data.', 'Use authoritative versions and immutable versioned keys.', 'Replica lag, eviction, and repeated writes.', 'Reproduce read-old, commit-new, invalidate, put-old.'],
    ['Validate snapshots', 'The payload can change between version selection and publication.', 'The key and value describe different versions.', 'Compare snapshot and selected versions; retry finitely.', 'Hot records, exhausted retries, and unavailable primary.', 'Assert mismatches never publish under the new key.'],
    ['Define consistency', 'Overlapping reads and writes cannot promise invisible stronger semantics.', 'Consumers make incorrect freshness assumptions.', 'Document the guarantee and cleanup/TTL policy.', 'Concurrent updates and stale pointers.', 'Add a concurrency test for the documented guarantee.']
  ],
  'out-of-order-events': [
    ['Buffer and deduplicate', 'Events can arrive out of order or more than once.', 'Projections move backwards and notifications duplicate.', 'Persist a unique inbox with aggregate/version constraints.', 'Identical duplicates and conflicting payloads.', 'Replay 3, 1, 2 with duplicates.'],
    ['Advance contiguously', 'Applying version 3 before 1 and 2 loses delta history.', 'Projection state no longer represents the aggregate.', 'Lock the projection, apply version + 1, and drain successors.', 'Missing versions, crashes, and initial creation.', 'Crash between receipt and apply, then recover.'],
    ['Operate on gaps', 'Blocking a partition on one missing event hides recovery work.', 'Backlog grows without visibility.', 'Track gap age, quarantine conflicts, and provide reconciliation.', 'Permanent loss, poison payloads, and reassignment.', 'Assert old gaps alert and remain recoverable.']
  ],
  'outbox-backlog': [
    ['Claim safely', 'Relays can select the same rows or hold DB locks during broker calls.', 'Events duplicate and business writes block.', 'Claim bounded batches with a lease, then publish outside the transaction.', 'Expired leases, competing relays, and batch limits.', 'Run two relays and assert exclusive ownership.'],
    ['Handle ambiguous publication', 'The broker may accept before SENT is stored.', 'At-least-once delivery is mistaken for exactly-once.', 'Conditionally mark SENT and deduplicate consumers by event ID.', 'Timeout after acceptance and process crash.', 'Inject the crash and replay safely.'],
    ['Control recovery', 'Immediate retries overwhelm the broker after recovery.', 'Backlog draining causes another outage.', 'Use bounded batches, jitter, attempt caps, DEAD state, and replay.', 'Poison events and oldest-event starvation.', 'Measure age, drain rate, attempts, and DEAD rows.']
  ],
  'thread-pool-exhaustion': [
    ['Bound concurrency and memory', 'An unbounded queue retains work while workers block.', 'Heap and tail latency rise before CPU saturation.', 'Bound workers, queue, downstream timeout, and rejection.', 'Bursts, blocked providers, and caller-runs behavior.', 'Block the provider and assert queue bounds.'],
    ['Preserve accepted work', 'Fire-and-forget work can disappear on rejection or shutdown.', 'Accepted notifications are silently lost.', 'Persist durable work before submission and expose rejection.', 'Duplicate submission and replay.', 'Saturate the pool and prove rejected work is recoverable.'],
    ['Shut down predictably', 'Deploys can discard queued work while requests are acknowledged.', 'Routine operations lose notifications.', 'Define drain timeout, interruption, and in-flight behavior.', 'Hung tasks and forced termination.', 'Shutdown with queued and active tasks and inspect states.']
  ],
  'failed-deployment': [
    ['Separate probe responsibilities', 'Wrong ports or dependency-sensitive liveness probes cause restart loops.', 'The original startup error is hidden.', 'Use startup for initialization, readiness for traffic, and liveness for process health.', 'Slow startup, management-port mismatch, and dependency outage.', 'Break each probe and verify intended behavior.'],
    ['Protect rollout capacity', 'Replacing old replicas before readiness creates an outage.', 'A bad image or secret removes healthy capacity.', 'Use bounded surge, zero unavailable capacity, deadlines, and graceful termination.', 'Insufficient capacity and stuck termination.', 'Deploy an unready version and verify old traffic remains.'],
    ['Recover with schema compatibility', 'Code rollback cannot always reverse a database migration.', 'Reverting the image may not restore service.', 'Use expand/contract migrations and document rollback diagnostics.', 'Mixed-version traffic and partial migrations.', 'Test old and new versions against the transitional schema.']
  ]
};

export const productionSubtaskGuidance = Object.fromEntries(Object.entries(guidance).map(([id, items]) => [id, items.map(([title, issue, impact, implementation, edgeCases, verify]) => ({ title, issue, impact, implementation, edgeCases, verify }))]));
