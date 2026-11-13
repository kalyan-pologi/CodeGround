const readme = `# Task 11: paid appraisal history and idempotent billing

Stories 1 and 4: free report caching must never reach the credit ledger. Every paid appraisal type, including land and plex, must write billable history. A retry with the same request key returns the original report without another debit. A history failure cannot return success after charging the account.

Keep two write ports: FreeReportCache and PaidHistoryWriter. Route every paid endpoint through one PaidAppraisalService. In the Spring adapter, acquire the account row lock, recheck the request key under that lock, verify the request fingerprint, then save the immutable history row and debit in one transaction. The database unique key on request identity is a second line of defense. Do remote property lookup and valuation before entering this transaction.

The runnable check covers free isolation, land and plex history, replay, conflicting replay, insufficient balance, and rollback when history persistence fails. The Spring tab shows the transaction shape; integrate it with the real Reidy entities and run a database test for two concurrent identical request keys.

Interview explanation: "I routed all paid appraisal types through one history writer so land and plex could not silently skip billing records. The writer locked the credit account, checked an idempotency key, and saved the debit and immutable report in one transaction. Replays returned the existing report; a persistence failure rolled back the charge."`;

const domain = `enum AppraisalType { RESIDENTIAL, LAND, PLEX }

record PaidRequest(long accountId, String requestKey, AppraisalType type,
                   long propertyId, String result, int credits) {
    PaidRequest {
        if (accountId <= 0 || propertyId <= 0 || requestKey == null || requestKey.isBlank()
                || type == null || result == null || result.isBlank() || credits <= 0)
            throw new IllegalArgumentException("Invalid paid appraisal request");
    }
    String fingerprint() { return type + ":" + propertyId + ":" + credits + ":" + result; }
}

record PaidReport(long id, long accountId, String requestKey,
                  String fingerprint, AppraisalType type, String result) {}`;

const ports = `interface FreeReportCache { void save(long propertyId, String result); }
interface PaidHistoryWriter { PaidReport savePaid(PaidRequest request); }`;

const starter = `class AppraisalWorkflow {
    AppraisalWorkflow(FreeReportCache freeCache, PaidHistoryWriter paidHistory) {
        // TODO: keep free and paid write ports separate.
    }
    void saveFree(long propertyId, String result) {
        throw new UnsupportedOperationException("Implement free path");
    }
    PaidReport savePaid(PaidRequest request) {
        // TODO: all paid property types must use the same history writer.
        throw new UnsupportedOperationException("Implement paid path");
    }
}`;

const solution = `import java.util.Objects;

class AppraisalWorkflow {
    private final FreeReportCache freeCache;
    private final PaidHistoryWriter paidHistory;

    AppraisalWorkflow(FreeReportCache freeCache, PaidHistoryWriter paidHistory) {
        this.freeCache = Objects.requireNonNull(freeCache);
        this.paidHistory = Objects.requireNonNull(paidHistory);
    }

    void saveFree(long propertyId, String result) {
        if (propertyId <= 0 || result == null || result.isBlank())
            throw new IllegalArgumentException("Invalid free report");
        freeCache.save(propertyId, result); // No reference to the credit ledger.
    }

    PaidReport savePaid(PaidRequest request) {
        Objects.requireNonNull(request);
        // Residential, land, and plex all enter this one billable history boundary.
        return paidHistory.savePaid(request);
    }
}`;

const model = `import java.util.HashMap;
import java.util.Map;

// Deterministic teaching adapter. Use a DB row lock and @Transactional in Spring.
class InMemoryPaidHistoryWriter implements PaidHistoryWriter {
    final Map<Long, Integer> balances = new HashMap<>();
    final Map<String, PaidReport> history = new HashMap<>();
    boolean failHistoryWrite;
    private long nextId = 1;

    @Override public synchronized PaidReport savePaid(PaidRequest request) {
        String identity = request.requestKey(); // Reidy keys are unique across accounts.
        PaidReport prior = history.get(identity);
        if (prior != null) {
            if (prior.accountId() != request.accountId()
                    || !prior.fingerprint().equals(request.fingerprint()))
                throw new IllegalStateException("Conflicting idempotency-key replay");
            return prior;
        }
        int balance = balances.getOrDefault(request.accountId(), 0);
        if (balance < request.credits()) throw new IllegalStateException("Insufficient credits");
        PaidReport report = new PaidReport(nextId, request.accountId(), request.requestKey(),
            request.fingerprint(), request.type(), request.result());
        if (failHistoryWrite) throw new IllegalStateException("History storage failed");
        // In the DB these changes commit together. Here synchronized protects the model.
        history.put(identity, report);
        balances.put(request.accountId(), balance - request.credits());
        nextId++;
        return report;
    }
}`;

const spring = `import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Project adapter sketch: bind these calls to the existing Reidy repositories.
// Keep this in a separate bean so Spring's transaction proxy is applied.
@Service
class SpringPaidHistoryWriter implements PaidHistoryWriter {
    private final AccountPort accounts;
    private final HistoryPort history;
    private final DebitPort debits;

    SpringPaidHistoryWriter(AccountPort accounts, HistoryPort history, DebitPort debits) {
        this.accounts = accounts; this.history = history; this.debits = debits;
    }

    @Transactional
    public PaidReport savePaid(PaidRequest request) {
        Account account = accounts.lockById(request.accountId()); // SELECT ... FOR UPDATE / SQL Server lock
        PaidReport prior = history.findByKey(request.requestKey());
        if (prior != null) {
            if (prior.accountId() != request.accountId()
                    || !prior.fingerprint().equals(request.fingerprint()))
                throw new IllegalStateException("Conflicting idempotency-key replay");
            return prior;
        }
        if (account.balance() < request.credits())
            throw new IllegalStateException("Insufficient credits");
        // Reidy's unique request key also protects against other writers.
        PaidReport report = history.insertImmutable(request);
        debits.insert(report.id(), request.accountId(), -request.credits());
        accounts.setBalance(request.accountId(), account.balance() - request.credits());
        return report; // Any unchecked failure rolls back all three writes.
    }
}

interface AccountPort { Account lockById(long id); void setBalance(long id, int balance); }
record Account(long id, int balance) {}
interface HistoryPort {
    PaidReport findByKey(String key);
    PaidReport insertImmutable(PaidRequest request);
}
interface DebitPort { void insert(long reportId, long accountId, int amount); }`;

const schema = `-- Reidy's SQL Server V2 schema already defines these constraints.
-- Check they are present; do not add duplicate constraints to an existing schema.
SELECT name FROM sys.key_constraints
WHERE name IN ('uq_appraisal_history_idempotency_key',
               'uq_credit_transaction_report_id');
-- The unique idempotency key protects history across accounts.
-- The unique report ID protects the one-debit-per-report ledger invariant.`;

const checks = `class BillingIdempotencyAcceptanceTest {
    static void run() {
        InMemoryPaidHistoryWriter writer = new InMemoryPaidHistoryWriter();
        writer.balances.put(1L, 5);
        int[] freeWrites = {0};
        AppraisalWorkflow workflow = new AppraisalWorkflow((id, value) -> freeWrites[0]++, writer);
        workflow.saveFree(10, "preview");
        equal(1, freeWrites[0]);
        equal(5, writer.balances.get(1L));
        equal(0, writer.history.size());

        PaidRequest land = new PaidRequest(1, "land-1", AppraisalType.LAND, 10, "land result", 1);
        PaidRequest plex = new PaidRequest(1, "plex-1", AppraisalType.PLEX, 11, "plex result", 1);
        PaidReport first = workflow.savePaid(land);
        workflow.savePaid(plex);
        equal(first, workflow.savePaid(land));
        equal(2, writer.history.size());
        equal(3, writer.balances.get(1L)); // replay did not debit again

        expectFailure(() -> workflow.savePaid(new PaidRequest(1, "land-1", AppraisalType.LAND, 99, "changed", 1)));
        equal(3, writer.balances.get(1L));
        writer.balances.put(2L, 5);
        expectFailure(() -> workflow.savePaid(new PaidRequest(2, "land-1", AppraisalType.LAND, 10, "land result", 1)));
        equal(5, writer.balances.get(2L));
        writer.failHistoryWrite = true;
        expectFailure(() -> workflow.savePaid(new PaidRequest(1, "new", AppraisalType.RESIDENTIAL, 12, "r", 1)));
        equal(3, writer.balances.get(1L));
        equal(2, writer.history.size());
        System.out.println("Task 11 billing checks passed");
    }
    private static void equal(Object expected, Object actual) {
        if (!expected.equals(actual)) throw new AssertionError("Expected " + expected + ", got " + actual);
    }
    private static void expectFailure(Runnable action) {
        try { action.run(); throw new AssertionError("Expected failure"); }
        catch (IllegalStateException expected) { }
    }
}`;

export function billingIdempotencyLab() {
  const files = [
    { path: 'README.md', language: 'markdown', readOnly: true, starter: readme },
    { path: 'src/AppraisalDomain.java', language: 'java', readOnly: true, starter: domain },
    { path: 'src/AppraisalPorts.java', language: 'java', readOnly: true, starter: ports },
    { path: 'src/AppraisalWorkflow.java', language: 'java', starter },
    { path: 'src/InMemoryPaidHistoryWriter.java', language: 'java', readOnly: true, starter: model },
    { path: 'src/SpringPaidHistoryWriter.java', language: 'java', readOnly: true, starter: spring },
    { path: 'db/unique-request-identity.sql', language: 'sql', readOnly: true, starter: schema },
    { path: 'test/BillingIdempotencyAcceptanceTest.java', language: 'java', readOnly: true, starter: checks }
  ];
  return {
    runtime: 'project',
    expected: 'Free appraisals never debit credits. A paid land or plex appraisal writes one history entry and one debit atomically. A retry with the same request key returns the original result, a conflicting replay fails, and a failed write rolls back the balance.',
    files,
    fileSolutions: Object.fromEntries(files.map(file => [file.path, file.path === 'src/AppraisalWorkflow.java' ? solution : file.starter])),
    explanation: [
      'Separate free and paid ports prevent a free cache write from reaching the credit ledger. Every billable type passes through one history writer.',
      'The writer locks the account and rechecks the request key before changing balance. History, debit, and balance commit together; a failure rolls all of them back.',
      'A replay returns the immutable original report. The same key with a different fingerprint is a conflict, and the database unique key protects the invariant under concurrent writers.'
    ],
    executionNote: 'Task 11 includes runnable Java billing checks and a Spring transaction reference. Verify the unique constraint and rollback with the Reidy database.'
  };
}
