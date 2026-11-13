import { projectFeature } from './project-feature-builder.js';

export const mediumDataTasks = [
  projectFeature({
    topic: 10, title: 'Build a transactional JDBC property import and search adapter',
    statement: 'Implement a JDBC adapter for partner property uploads. Validate a batch before opening its transaction, insert all rows atomically, support bounded keyset search, and update a price only when its expected old value still matches.',
    requirements: [
      'Require positive IDs, nonblank trimmed cities, and nonnegative exact prices. Reject duplicate IDs within the input batch before any insert.',
      'insertAll owns a new connection and one transaction. Commit once after the batch succeeds; roll back on SQL or runtime failure and preserve rollback failures as suppressed exceptions.',
      'Use prepared statements for all values. Close every connection, statement, and result set on success and failure.',
      'Search by case-insensitive city and inclusive price bound, after a supplied ID cursor. Order by ID and bound the result to a limit of 1–100.',
      'updatePrice uses an expected old price in the SQL WHERE clause. Return false for no matching row; never overwrite a concurrent change unconditionally.',
      'Return immutable search results. Verify committed database state from a separate connection rather than relying on mocks to prove rollback.'
    ],
    imports: 'import java.math.BigDecimal;\nimport java.sql.*;\nimport java.util.*;\nimport javax.sql.DataSource;',
    model: 'record PropertyRow(long id, String city, BigDecimal price) {}',
    units: [{ owner: 'class PropertyJdbcAdapter', members: '    private final DataSource source;\n    PropertyJdbcAdapter(DataSource source) { this.source = Objects.requireNonNull(source); }', methods: [
      { signature: 'private void validate(PropertyRow property)', body: `        if (property == null || property.id() <= 0 || property.city() == null || property.city().isBlank()
            || property.price() == null || property.price().signum() < 0) throw new IllegalArgumentException("Invalid property");` },
      { signature: 'int insertAll(List<PropertyRow> input) throws SQLException', body: `        if (input == null) throw new IllegalArgumentException("Missing batch");
        Set<Long> ids = new HashSet<>();
        for (PropertyRow property : input) { validate(property); if (!ids.add(property.id())) throw new IllegalArgumentException("Duplicate ID"); }
        try (Connection connection = source.getConnection()) {
            connection.setAutoCommit(false);
            try {
                try (PreparedStatement statement = connection.prepareStatement("insert into properties(id, city, price) values (?, ?, ?)")) {
                    for (PropertyRow property : input) {
                        statement.setLong(1, property.id()); statement.setString(2, property.city().strip());
                        statement.setBigDecimal(3, property.price()); statement.addBatch();
                    }
                    statement.executeBatch();
                }
                connection.commit(); return input.size();
            } catch (SQLException | RuntimeException failure) {
                try { connection.rollback(); } catch (SQLException rollback) { failure.addSuppressed(rollback); }
                throw failure;
            }
        }` },
      { signature: 'List<PropertyRow> findAfter(String city, BigDecimal maximum, long afterId, int limit) throws SQLException', body: `        if (city == null || city.isBlank() || maximum == null || maximum.signum() < 0 || afterId < 0 || limit < 1 || limit > 100)
            throw new IllegalArgumentException("Invalid search");
        String sql = "select id, city, price from properties where lower(city) = lower(?) and price <= ? and id > ? order by id";
        try (Connection connection = source.getConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, city.strip()); statement.setBigDecimal(2, maximum); statement.setLong(3, afterId); statement.setMaxRows(limit);
            try (ResultSet rows = statement.executeQuery()) {
                List<PropertyRow> result = new ArrayList<>();
                while (rows.next()) result.add(new PropertyRow(rows.getLong("id"), rows.getString("city"), rows.getBigDecimal("price")));
                return List.copyOf(result);
            }
        }` },
      { signature: 'boolean updatePrice(long id, BigDecimal expected, BigDecimal replacement) throws SQLException', body: `        if (id <= 0 || expected == null || expected.signum() < 0 || replacement == null || replacement.signum() < 0)
            throw new IllegalArgumentException("Invalid price update");
        try (Connection connection = source.getConnection(); PreparedStatement statement = connection.prepareStatement(
                "update properties set price = ? where id = ? and price = ?")) {
            statement.setBigDecimal(1, replacement); statement.setLong(2, id); statement.setBigDecimal(3, expected);
            return statement.executeUpdate() == 1;
        }` }
    ] }],
    expected: 'An invalid/duplicate batch inserts nothing. A late SQL failure rolls back earlier inserts. Search respects cursor/limit. A stale expected price does not overwrite a newer price.',
    hints: ['Validate the entire batch before acquiring the database connection.', 'Nest statement resources inside the transaction so an execute or close failure is caught before commit.', 'Use id > cursor and a stable ID order instead of loading and skipping all rows.', 'Keep rollback exceptions attached to the original error rather than replacing it.'],
    explanation: ['The connection owns this transaction; do not reuse a caller-managed transaction for this adapter without changing the contract.', 'A prepared statement separates data from SQL syntax, including values containing quotes.', 'Expected-price comparison is a simplified optimistic update. A real version column is usually a clearer concurrency token.'],
    notes: 'Setup: Java 17, a DataSource, and properties(id BIGINT PRIMARY KEY, city VARCHAR(200), price DECIMAL(19,2)) on H2 or the service database. The DataSource must provide connections appropriate for adapter-owned transactions; pooled connections reset on close. Integration checks: duplicate existing DB ID in a later row, injection-shaped city, exact price bound, empty batch, stale price, and connection/resource failure. Run database tests in a dedicated exercise schema.'
  }),
  projectFeature({
    topic: 11, title: 'Build a JUnit regression suite for a stateful credit wallet',
    statement: 'The supplied wallet implements charge replay and refund behavior. Build tests that check return values, state preservation after failures, decimal-independent integer boundaries, and snapshot isolation. Tests should detect realistic regressions rather than only exercise the happy path.',
    requirements: [
      'Test a successful charge and exact-balance charge, checking both remaining balance and saved history.',
      'Test identical replay and conflicting costs. A conflict must leave balance and history unchanged.',
      'Test insufficient funds followed by a top-up and retry; a failed attempt must not reserve the key.',
      'Test refund idempotency and the rule that a refunded key never charges again.',
      'Use parameterized tests for zero and negative costs, plus blank/null keys and a negative starting balance.',
      'Test overflow state preservation and immutable history snapshots. Propose at least three implementation mutations the suite should catch.'
    ],
    imports: 'import java.util.*;\nimport org.junit.jupiter.api.Test;\nimport org.junit.jupiter.params.ParameterizedTest;\nimport org.junit.jupiter.params.provider.ValueSource;\nimport static org.junit.jupiter.api.Assertions.*;',
    model: `record Charge(String key, int cost, boolean refunded) {}
class CreditWallet {
    private int balance; private final Map<String, Charge> charges = new LinkedHashMap<>();
    CreditWallet(int balance) { if (balance < 0) throw new IllegalArgumentException(); this.balance = balance; }
    Charge charge(String raw, int cost) {
        if (raw == null || raw.isBlank() || cost <= 0) throw new IllegalArgumentException();
        String key = raw.strip(); Charge previous = charges.get(key);
        if (previous != null) { if (previous.cost() != cost) throw new IllegalArgumentException(); return previous; }
        if (balance < cost) throw new IllegalStateException();
        Charge charge = new Charge(key, cost, false); balance -= cost; charges.put(key, charge); return charge;
    }
    boolean refund(String key) {
        Charge charge = charges.get(key); if (charge == null) throw new IllegalArgumentException();
        if (charge.refunded()) return false;
        int restored = Math.addExact(balance, charge.cost());
        charges.put(key, new Charge(key, charge.cost(), true)); balance = restored; return true;
    }
    void add(int amount) { if (amount <= 0) throw new IllegalArgumentException(); balance = Math.addExact(balance, amount); }
    int balance() { return balance; }
    List<Charge> history() { return List.copyOf(charges.values()); }
}`,
    units: [{ owner: 'class CreditWalletTest', methods: [
      { signature: '@Test void chargesAndSupportsExactBalance()', body: `        CreditWallet wallet = new CreditWallet(3);
        assertEquals(new Charge("one", 1, false), wallet.charge("one", 1));
        assertEquals(2, wallet.balance()); wallet.charge("two", 2);
        assertEquals(0, wallet.balance()); assertEquals(2, wallet.history().size());` },
      { signature: '@Test void replaysAndRejectsConflictingCosts()', body: `        CreditWallet wallet = new CreditWallet(5); Charge first = wallet.charge(" request ", 2);
        assertEquals(first, wallet.charge("request", 2));
        List<Charge> before = wallet.history();
        assertThrows(IllegalArgumentException.class, () -> wallet.charge("request", 3));
        assertEquals(3, wallet.balance()); assertEquals(before, wallet.history());` },
      { signature: '@Test void failureDoesNotClaimTheKey()', body: `        CreditWallet wallet = new CreditWallet(1);
        assertThrows(IllegalStateException.class, () -> wallet.charge("retry", 2));
        assertTrue(wallet.history().isEmpty()); assertEquals(1, wallet.balance());
        wallet.add(1); wallet.charge("retry", 2); assertEquals(0, wallet.balance());` },
      { signature: '@Test void refundsOnceAndKeepsOldSnapshots()', body: `        CreditWallet wallet = new CreditWallet(5); wallet.charge("refund", 2);
        List<Charge> before = wallet.history();
        assertTrue(wallet.refund("refund")); assertFalse(wallet.refund("refund"));
        assertTrue(wallet.charge("refund", 2).refunded()); assertEquals(5, wallet.balance());
        assertFalse(before.get(0).refunded()); assertThrows(UnsupportedOperationException.class, before::clear);` },
      { signature: '@ParameterizedTest @ValueSource(ints = {0, -1, Integer.MIN_VALUE})\n    void rejectsInvalidCosts(int cost)', body: `        CreditWallet wallet = new CreditWallet(5);
        assertThrows(IllegalArgumentException.class, () -> wallet.charge("bad", cost));
        assertEquals(5, wallet.balance()); assertTrue(wallet.history().isEmpty());` },
      { signature: '@Test void rejectsKeysAndPreservesBalanceOnOverflow()', body: `        CreditWallet wallet = new CreditWallet(Integer.MAX_VALUE);
        assertThrows(IllegalArgumentException.class, () -> new CreditWallet(-1));
        assertThrows(IllegalArgumentException.class, () -> wallet.charge(null, 1));
        assertThrows(IllegalArgumentException.class, () -> wallet.charge(" ", 1));
        assertThrows(ArithmeticException.class, () -> wallet.add(1));
        assertEquals(Integer.MAX_VALUE, wallet.balance());
        assertThrows(IllegalArgumentException.class, () -> wallet.refund("unknown"));` }
    ] }],
    expected: 'Six test methods (including three parameterized invocations) pass. Removing replay detection, allowing zero cost, or making history a live view causes a test failure.',
    hints: ['Name each test after a business invariant.', 'Capture state before an expected failure and compare it afterwards.', 'Parameterize equivalent invalid-cost cases while keeping different behaviors in separate tests.', 'Run a deliberate local mutation to demonstrate that a test can fail for the intended reason.'],
    explanation: ['Stateful code needs assertions about what did not change after a failed operation.', 'A snapshot test must modify the wallet after taking the snapshot; unmodifiable access alone does not prove independence.', 'These unit tests cannot establish transactional durability or cross-thread correctness. Those need different test boundaries.'],
    notes: 'Setup: JUnit Jupiter and junit-jupiter-params, Maven Surefire, src/test/java. Keep the supplied wallet unchanged while writing the first suite. Add tests for refund overflow after top-up, positive top-ups, missing refunds, and conflicting retries after refund. Mutation checks are manual unless a mutation-testing tool is configured.'
  })
];
