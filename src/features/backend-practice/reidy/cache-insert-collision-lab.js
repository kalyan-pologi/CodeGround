const readme = `# Task 5: two parallel cache misses collide on insert

Production failure: two rentability requests ask for the same neighborhood key within milliseconds. Both SELECTs see no row. Both call Mashvisor. The first INSERT commits; the second violates the unique cache key and the whole rentability response fails with DataIntegrityViolationException.

Your job:
1. Reproduce the failure with two requests that both pass the initial cache lookup before either insert runs.
2. Keep the database unique constraint on cache_key. This is the final data-integrity boundary.
3. Call the provider outside a database transaction. After a miss, use a short SQL Server MERGE ... WITH (HOLDLOCK) that inserts only when the key does not exist. Do not update the winner with the loser's provider response.
4. Read the committed row after the insert attempt and return that row to either requester. The loser must not leak a duplicate-key exception to the tab response.
5. Verify one stored row, two successful responses containing the same winning payload, and zero duplicate-key failures under parallel load. Measure query count and blocking in SQL Server, not H2.

The service and repository solution tabs contain the Java path. This lab uses a small neighborhood-key table to model Story 7; Reidy's existing rental_cache_entry table uses a different property/endpoint key and lease policy. The in-memory concurrency check proves the service contract; the SQL Server MERGE requires an integration test with two real database connections. Run the MERGE against the same SQL Server version and isolation configuration used by the application.

Interview explanation: "Two requests read the same missing cache key, both fetched the provider, and the second insert failed on our unique constraint. I kept the constraint and changed the write to a short insert-if-absent MERGE with HOLDLOCK. Afterward both requests read the winning row. In concurrent tests, the tab no longer failed and only one row existed."`;

const domain = `record CacheEntry(String key, String payload) {
    CacheEntry {
        if (key == null || key.isBlank() || payload == null || payload.isBlank())
            throw new IllegalArgumentException("A cache entry needs a key and valid provider payload");
    }
}

interface RentalDataProvider {
    String load(String cacheKey);
}`;

const port = `import java.util.Optional;

interface RentalCacheRepository {
    Optional<CacheEntry> findCommitted(String cacheKey);
    void insertIfAbsent(CacheEntry entry);
}`;

const serviceStarter = `class RentalCacheService {
    private final RentalCacheRepository cache;
    private final RentalDataProvider provider;

    RentalCacheService(RentalCacheRepository cache, RentalDataProvider provider) {
        this.cache = cache;
        this.provider = provider;
    }

    CacheEntry load(String cacheKey) {
        // TODO: reproduce two misses for the same key.
        // TODO: fetch outside a DB transaction, insert only if absent,
        // then return the row committed by the winner.
        throw new UnsupportedOperationException("Implement Task 5");
    }
}`;

const serviceSolution = `import java.util.Objects;

class RentalCacheService {
    private final RentalCacheRepository cache;
    private final RentalDataProvider provider;

    RentalCacheService(RentalCacheRepository cache, RentalDataProvider provider) {
        this.cache = Objects.requireNonNull(cache);
        this.provider = Objects.requireNonNull(provider);
    }

    CacheEntry load(String cacheKey) {
        if (cacheKey == null || cacheKey.isBlank())
            throw new IllegalArgumentException("Cache key is required");

        // This first read is an optimization, not a lock. Another request can insert next.
        var existing = cache.findCommitted(cacheKey);
        if (existing.isPresent()) return existing.get();

        // Never hold a database transaction open across a network request.
        String payload = provider.load(cacheKey);
        CacheEntry candidate = new CacheEntry(cacheKey, payload);
        cache.insertIfAbsent(candidate);

        // If this request lost the race, return the committed winner, not candidate.
        return cache.findCommitted(cacheKey).orElseThrow(
            () -> new IllegalStateException("Cache row absent after insert-if-absent"));
    }
}`;

const repositoryStarter = `// SQL Server implementation required. Do not use a SELECT followed by a plain INSERT.
// A transaction around that two-statement pattern still permits two transactions
// to observe an absent row before either inserts it.
class SqlServerRentalCacheRepository {
    // TODO: implement RentalCacheRepository with JdbcTemplate.
    // TODO: run MERGE WITH (HOLDLOCK) in a short, independent transaction.
    // TODO: read the committed winning row in a separate boundary.
}`;

const repositorySolution = `import java.sql.Timestamp;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

// Use this adapter only with SQL Server. H2 does not verify SQL Server locking.
class SqlServerRentalCacheRepository implements RentalCacheRepository {
    private static final String FIND = """
        SELECT cache_key, payload FROM dbo.rental_cache WHERE cache_key = ?
        """;
    private static final String INSERT_IF_ABSENT = """
        MERGE dbo.rental_cache WITH (HOLDLOCK) AS target
        USING (VALUES (?, ?, ?)) AS source(cache_key, payload, fetched_at)
        ON target.cache_key = source.cache_key
        WHEN NOT MATCHED BY TARGET THEN
            INSERT (cache_key, payload, fetched_at)
            VALUES (source.cache_key, source.payload, source.fetched_at);
        """;

    private final JdbcTemplate jdbc;
    private final TransactionTemplate shortTransaction;

    SqlServerRentalCacheRepository(JdbcTemplate jdbc, PlatformTransactionManager manager) {
        this.jdbc = jdbc;
        this.shortTransaction = new TransactionTemplate(manager);
        this.shortTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Override public Optional<CacheEntry> findCommitted(String key) {
        return shortTransaction.execute(status -> jdbc.query(FIND,
            (row, index) -> new CacheEntry(row.getString("cache_key"), row.getString("payload")),
            key).stream().findFirst());
    }

    @Override public void insertIfAbsent(CacheEntry entry) {
        // HOLDLOCK protects the missing-key range while MERGE decides whether
        // to insert. This transaction ends before the service reads the winner.
        shortTransaction.executeWithoutResult(status -> jdbc.update(INSERT_IF_ABSENT,
            entry.key(), entry.payload(), Timestamp.from(java.time.Instant.now())));
    }
}`;

const schema = `-- Focused SQL Server exercise schema, not a migration for the existing rental_cache_entry table.
-- The unique key remains mandatory even with MERGE.
CREATE TABLE dbo.rental_cache (
    cache_key nvarchar(200) NOT NULL,
    payload nvarchar(max) NOT NULL,
    fetched_at datetime2(3) NOT NULL,
    CONSTRAINT PK_rental_cache PRIMARY KEY (cache_key)
);`;

const checks = `import java.util.Optional;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

class CacheInsertCollisionAcceptanceTest {
    static void run() throws Exception {
        // Both calls must reach the provider after observing an empty cache.
        CountDownLatch bothMissed = new CountDownLatch(2);
        AtomicInteger providerCalls = new AtomicInteger();
        RentalDataProvider provider = key -> {
            int call = providerCalls.incrementAndGet();
            bothMissed.countDown();
            try {
                if (!bothMissed.await(5, TimeUnit.SECONDS))
                    throw new IllegalStateException("Requests did not overlap");
            } catch (InterruptedException error) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException(error);
            }
            return "provider-response-" + call;
        };
        InMemoryInsertIfAbsent cache = new InMemoryInsertIfAbsent();
        RentalCacheService service = new RentalCacheService(cache, provider);
        ExecutorService workers = Executors.newFixedThreadPool(2);
        try {
            Future<CacheEntry> first = workers.submit(() -> service.load("neighborhood:42"));
            Future<CacheEntry> second = workers.submit(() -> service.load("neighborhood:42"));
            CacheEntry a = first.get(10, TimeUnit.SECONDS);
            CacheEntry b = second.get(10, TimeUnit.SECONDS);
            if (!a.equals(b) || cache.rows.size() != 1 || providerCalls.get() != 2)
                throw new AssertionError("Both requests must return one committed winner");
            service.load("neighborhood:42");
            if (providerCalls.get() != 2) throw new AssertionError("A cache hit called the provider");
            System.out.println("Task 5 concurrent contract passed");
        } finally {
            workers.shutdownNow();
        }
    }

    private static class InMemoryInsertIfAbsent implements RentalCacheRepository {
        final ConcurrentHashMap<String, CacheEntry> rows = new ConcurrentHashMap<>();
        public Optional<CacheEntry> findCommitted(String key) {
            return Optional.ofNullable(rows.get(key));
        }
        public void insertIfAbsent(CacheEntry entry) {
            rows.putIfAbsent(entry.key(), entry); // Models MERGE's insert-if-absent contract.
        }
    }
}`;

export function buildCacheInsertCollisionTask(base, id) {
  const files = [
    { path: 'README.md', language: 'markdown', readOnly: true, starter: readme },
    { path: 'src/CacheEntry.java', language: 'java', readOnly: true, starter: domain },
    { path: 'src/RentalCacheRepository.java', language: 'java', readOnly: true, starter: port },
    { path: 'src/RentalCacheService.java', language: 'java', starter: serviceStarter },
    { path: 'src/SqlServerRentalCacheRepository.java', language: 'java', starter: repositoryStarter },
    { path: 'db/cache-insert-race-schema.sql', language: 'sql', readOnly: true, starter: schema },
    { path: 'test/CacheInsertCollisionAcceptanceTest.java', language: 'java', readOnly: true, starter: checks }
  ];
  const fileSolutions = Object.fromEntries(files.map(file => [file.path,
    file.path === 'src/RentalCacheService.java' ? serviceSolution
      : file.path === 'src/SqlServerRentalCacheRepository.java' ? repositorySolution : file.starter]));
  return {
    ...base,
    id,
    story: 7,
    scenarioId: 'story-7-cache-insert-collision',
    sourceIds: ['story-7-cache-insert-collision'],
    mergedSources: ['Story 7: Two parallel cache misses racing to insert the same row'],
    title: 'Fix concurrent rental cache insert failures',
    runtime: 'project',
    language: 'java',
    environment: 'Production scenario | SQL Server cache insert race | Reidy appraisal service',
    statement: 'Two requests select the same missing neighborhood cache key and both fetch Mashvisor. The first insert commits; the second violates the unique key and fails the rentability response. Implement a short SQL Server insert-if-absent boundary and return the winning row to both callers.',
    incident: {
      symptoms: ['About 1–2% of rentability requests fail with DataIntegrityViolationException under parallel load.', 'The failed key already exists when inspected after the request.'],
      investigate: ['Force two requests to pass the initial cache SELECT before either INSERT.', 'Confirm the failing constraint is the unique cache key.', 'Trace transaction boundaries around the Mashvisor call, MERGE, and final read.']
    },
    requirements: [
      'Keep a unique constraint on cache_key and reproduce the SELECT-then-INSERT race.',
      'Run the provider call outside a database transaction.',
      'Use SQL Server MERGE with HOLDLOCK to insert only when the key is absent; do not overwrite the winner.',
      'After the write boundary commits, read and return the winning row to both requests.',
      'Verify two successful parallel responses, one stored row, and no duplicate-key exception on SQL Server.'
    ],
    subtasks: [
      { title: 'Reproduce the collision', issue: 'Two separate requests both observe a miss.', impact: 'The losing insert fails the whole rentability tab.', implementation: 'Use a barrier so both requests pass SELECT before either INSERT.', edgeCases: 'Same neighborhood key from different properties.', verify: 'Baseline: one INSERT raises a unique-key error.' },
      { title: 'Protect the insert', issue: 'A plain INSERT is not safe after an unlocked SELECT.', impact: 'The race remains under production concurrency.', implementation: 'Add the unique key and SQL Server MERGE WITH (HOLDLOCK) in a short transaction.', edgeCases: 'The loser must never update the winning payload.', verify: 'One row remains and both requests complete.' },
      { title: 'Return the winner', issue: 'The losing request still holds its own provider result.', impact: 'Callers can disagree about what was actually cached.', implementation: 'Read the committed cache row after MERGE and return it.', edgeCases: 'Provider failure and absent row after the write.', verify: 'Both responses equal the persisted value; failures preserve their cause.' },
      { title: 'Verify in SQL Server', issue: 'An in-memory fake cannot prove database locking.', impact: 'A passing unit test may still race in the deployed database.', implementation: 'Run parallel calls with two SQL Server connections and inspect blocking and row count.', edgeCases: 'Existing key, different keys, repeated load, and provider timeout.', verify: 'No duplicate-key error; one row per key; normal-path latency measured.' }
    ],
    hintSteps: ['The first SELECT is an optimization, not a lock.', 'Keep the provider request outside the database transaction.', 'The unique constraint and HOLDLOCK protect the insert decision.', 'After MERGE, return the committed row, not the losing request’s payload.'],
    expected: 'Two concurrent misses for one cache key return the same committed entry; exactly one row is stored; no DataIntegrityViolationException escapes.',
    explanation: [
      'The race exists between the initial SELECT and INSERT. Keeping the unique key protects data, but a plain INSERT makes the losing request fail.',
      'The SQL Server MERGE with HOLDLOCK serializes the missing-key insert decision. It does not remove the possibility of two provider calls; that is a separate stampede optimization.',
      'The database work is short and separate from the network call. A fresh read after MERGE gives both requests the persisted winner. The Java concurrency check models this contract; verify lock behavior against real SQL Server.'
    ],
    notes: 'Deliver the SQL Server exercise schema, repository implementation, barrier-based concurrent test, provider call count, and measured failure rate before/after.',
    pseudocode: 'SELECT miss → provider call outside transaction → MERGE WITH (HOLDLOCK) → fresh SELECT winner',
    starter: serviceStarter + '\n\n' + repositoryStarter,
    files,
    fileSolutions,
    solution: serviceSolution + '\n\n' + repositorySolution,
    executionNote: 'Task 5 includes a Java concurrency check and a SQL Server MERGE reference. Verify the database race with two real SQL Server connections; the browser runner cannot execute it.'
  };
}
