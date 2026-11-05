import { javaChallenge as java, springChallenge as project } from '../practice/src/data/challenge-helpers.js';

export const coreTasks = [
  java(4, 'Medium', 'Parse property import prices with useful errors',
    'Implement parsePrice for a property CSV import. Trim the value, parse an exact BigDecimal, and reject null, blank, malformed, or negative input with IllegalArgumentException whose message is "Invalid asking price at row " followed by rowNumber. Preserve NumberFormatException as the cause for malformed numeric input. Reject row numbers below 1 separately. Zero is valid.',
    '250000.50\nInvalid asking price at row 7', '',
    'static BigDecimal parsePrice(String raw, int rowNumber)',
    `        if (rowNumber < 1) throw new IllegalArgumentException("Invalid row number");
        String message = "Invalid asking price at row " + rowNumber;
        if (raw == null || raw.isBlank()) throw new IllegalArgumentException(message);
        try {
            BigDecimal price = new BigDecimal(raw.strip());
            if (price.signum() < 0) throw new IllegalArgumentException(message);
            return price;
        } catch (NumberFormatException failure) {
            throw new IllegalArgumentException(message, failure);
        }`,
    `        System.out.println(parsePrice(" 250000.50 ", 1));
        for (String value : Arrays.asList(null, "", "-1", "invalid")) {
            try { parsePrice(value, 7); throw new AssertionError("Expected rejection"); }
            catch (IllegalArgumentException failure) {
                if (!failure.getMessage().equals("Invalid asking price at row 7")) throw new AssertionError(failure);
                if ("invalid".equals(value) && !(failure.getCause() instanceof NumberFormatException)) throw new AssertionError("Missing cause");
            }
        }
        if (parsePrice("0", 1).signum() != 0) throw new AssertionError("Zero must be valid");
        System.out.println("Invalid asking price at row 7");`,
    'Validate the row number, handle missing text, parse with BigDecimal, reject negatives, and wrap only parsing failures with the row context.',
    'Check whitespace, zero, fractional values, null, blank, malformed text, negative input, and invalid row numbers. In a file importer, open the reader with try-with-resources and pass the current line number. Do not log whole CSV rows containing private data.'),

  java(6, 'Hard', 'Reserve appraisal credits safely across threads',
    'Implement reserve using an AtomicInteger balance. Require positive cost and a nonnegative starting balance. Atomically subtract cost only when enough credits exist. Return false without changing the balance when funds are insufficient. This is a single-process concurrency exercise, not durable billing or cross-instance idempotency.',
    'Successful reservations: 10\nCredits left: 0', '',
    'static boolean reserve(AtomicInteger balance, int cost)',
    `        if (cost <= 0) throw new IllegalArgumentException("Invalid cost");
        while (true) {
            int current = balance.get();
            if (current < 0) throw new IllegalArgumentException("Invalid balance");
            if (current < cost) return false;
            if (balance.compareAndSet(current, current - cost)) return true;
        }`,
    `        AtomicInteger balance = new AtomicInteger(10);
        ExecutorService workers = Executors.newFixedThreadPool(4);
        int successes = 0;
        try {
            List<Callable<Boolean>> requests = new ArrayList<>();
            for (int i = 0; i < 50; i++) requests.add(() -> reserve(balance, 1));
            for (Future<Boolean> result : workers.invokeAll(requests)) if (result.get()) successes++;
        } finally { workers.shutdownNow(); }
        if (successes != 10 || balance.get() != 0) throw new AssertionError("Double spending");
        if (reserve(balance, 1)) throw new AssertionError("Overdraft");
        System.out.println("Successful reservations: " + successes);
        System.out.println("Credits left: " + balance.get());`,
    'Read the balance, reject insufficient funds, and compare-and-set the new balance. Retry if another thread changed it first.',
    'Check competing callers, exact balance, insufficient funds, zero/negative cost, and negative balance. Explain why volatile or separate get/set operations do not make the debit atomic. Production credit updates need database transactions.'),

  java(7, 'Medium', 'Release notification listeners when a session closes',
    'Implement subscribe for an in-memory notification listener registry. Register the supplied listener and return an AutoCloseable handle. Closing the handle must remove that registration and release its captured listener, even if the handle itself remains referenced. Repeated close is safe. Two registrations of the same listener must close independently. Inputs are non-null; this exercise is single-threaded.',
    'Received: 1\nRegistered: 0',
    `    static final List<java.util.function.Consumer<String>> LISTENERS = new ArrayList<>();`,
    'static AutoCloseable subscribe(java.util.function.Consumer<String> listener)',
    `        AtomicReference<java.util.function.Consumer<String>> reference = new AtomicReference<>(Objects.requireNonNull(listener));
        java.util.function.Consumer<String> registration = message -> {
            var target = reference.get();
            if (target != null) target.accept(message);
        };
        LISTENERS.add(registration);
        return () -> { reference.set(null); LISTENERS.remove(registration); };`,
    `        AtomicInteger received = new AtomicInteger();
        java.util.function.Consumer<String> listener = message -> received.incrementAndGet();
        AutoCloseable first = subscribe(listener);
        AutoCloseable second = subscribe(listener);
        first.close(); first.close();
        if (LISTENERS.size() != 1) throw new AssertionError("Independent registrations lost");
        LISTENERS.forEach(item -> item.accept("PropertyUpdated"));
        second.close();
        if (received.get() != 1 || !LISTENERS.isEmpty()) throw new AssertionError("Listener retained");
        System.out.println("Received: " + received.get());
        System.out.println("Registered: " + LISTENERS.size());`,
    'Wrap each registration independently, keep the captured listener in a clearable reference, and remove the wrapper and clear the reference when closed.',
    'Check duplicate registrations, double close, no delivery after close, and an empty registry. A static listener list can keep sessions reachable and prevent garbage collection; forcing System.gc() is not a lifecycle fix.'),

  java(8, 'Medium', 'Model free and paid appraisal requests with sealed types',
    'Implement describe for the supplied Java 17 sealed request hierarchy. A Free request needs no charge. A Paid request must contain a nonblank idempotency key, trimmed in the output. Reject a null request or invalid key with IllegalArgumentException. Use Java 17 records, sealed types, and instanceof pattern matching without preview features.',
    'FREE\nPAID: request-1',
    `    sealed interface AppraisalRequest permits Free, Paid {}
    record Free() implements AppraisalRequest {}
    record Paid(String key) implements AppraisalRequest {}`,
    'static String describe(AppraisalRequest request)',
    `        if (request instanceof Free) return "FREE";
        if (request instanceof Paid paid) {
            if (paid.key() == null || paid.key().isBlank()) throw new IllegalArgumentException("Missing key");
            return "PAID: " + paid.key().strip();
        }
        throw new IllegalArgumentException("Missing request");`,
    `        System.out.println(describe(new Free()));
        System.out.println(describe(new Paid(" request-1 ")));
        for (AppraisalRequest request : Arrays.asList(null, new Paid(" "), new Paid(null))) {
            try { describe(request); throw new AssertionError("Expected invalid request"); }
            catch (IllegalArgumentException expected) { }
        }`,
    'Dispatch by the permitted request types, bind the Paid record through pattern matching, and validate its key.',
    'Check free requests, trimmed keys, null requests, null keys, and blank keys. A Java 21 pattern switch is an alternative, but the ReidyAI project currently targets Java 17.'),

  java(9, 'Medium', 'Expose only annotated appraisal report fields',
    'Implement publicFields. Inspect declared methods annotated with @PublicField, require them to be public, nonstatic, zero-argument, and nonvoid, then invoke them and return a TreeMap keyed by method name. Reject invalid annotated methods with IllegalArgumentException. Ignore unannotated methods. Propagate reflective invocation failures. The target is non-null and annotated methods return non-null values.',
    '{city=Chicago}',
    `    @Retention(RetentionPolicy.RUNTIME)
    @Target(ElementType.METHOD)
    @interface PublicField {}
    public static class ReportView {
        @PublicField public String city() { return "Chicago"; }
        public String internalToken() { return "private"; }
    }
    public static class InvalidView {
        @PublicField public String city(String value) { return value; }
    }`,
    'static Map<String, Object> publicFields(Object target) throws ReflectiveOperationException',
    `        Map<String, Object> result = new TreeMap<>();
        for (Method method : target.getClass().getDeclaredMethods()) {
            if (!method.isAnnotationPresent(PublicField.class)) continue;
            if (!Modifier.isPublic(method.getModifiers()) || Modifier.isStatic(method.getModifiers())
                || method.getParameterCount() != 0 || method.getReturnType() == void.class)
                throw new IllegalArgumentException("Invalid public field method");
            result.put(method.getName(), Objects.requireNonNull(method.invoke(target)));
        }
        return result;`,
    `        Map<String, Object> fields = publicFields(new ReportView());
        if (!fields.equals(Map.of("city", "Chicago"))) throw new AssertionError("Unexpected exposure");
        try { publicFields(new InvalidView()); throw new AssertionError("Invalid signature accepted"); }
        catch (IllegalArgumentException expected) { }
        System.out.println(fields);`,
    'Find annotated methods, validate their signatures, invoke only the approved getters, and collect the results in sorted order.',
    'Check unannotated secrets, invalid signatures, empty annotated sets, and deterministic ordering. Do not bypass access controls with setAccessible. A real API should generally prefer explicit DTOs.'),

  { ...project(10, 'Medium', 'Read property search results using parameterized JDBC',
    'Implement findByCity using the supplied DataSource. Select id and city from properties where city equals the supplied city value, ordered by id. Bind the city with PreparedStatement rather than concatenating SQL. Close the connection, statement, and result set on success and failure. Return an immutable list; propagate SQLException.',
    'A city value containing SQL syntax remains a literal parameter. Matching rows return in ID order, and every JDBC resource closes.',
    `import java.sql.*;
import java.util.*;
import javax.sql.DataSource;
record PropertyRow(long id, String city) {}
class PropertyLookup {
    static List<PropertyRow> findByCity(DataSource source, String city) throws SQLException {
        // TODO bind the city and close every JDBC resource
        throw new UnsupportedOperationException();
    }
}`,
    `import java.sql.*;
import java.util.*;
import javax.sql.DataSource;
record PropertyRow(long id, String city) {}
class PropertyLookup {
    static List<PropertyRow> findByCity(DataSource source, String city) throws SQLException {
        try (Connection connection = source.getConnection();
             PreparedStatement statement = connection.prepareStatement(
                 "select id, city from properties where city = ? order by id")) {
            statement.setString(1, city);
            try (ResultSet rows = statement.executeQuery()) {
                List<PropertyRow> result = new ArrayList<>();
                while (rows.next()) result.add(new PropertyRow(rows.getLong("id"), rows.getString("city")));
                return List.copyOf(result);
            }
        }
    }
}`,
    'Acquire resources with try-with-resources, bind the search value, map the selected columns, and return an independent list.',
    'Project setup: a JDBC DataSource and a properties(id BIGINT, city VARCHAR) table, using H2 or the service database. Verify no matches, ID ordering, a quote in the city name, an injection-shaped value, and resource closure after an SQL error. This uses database equality semantics, not the case-insensitive in-memory Stream task.',
    'Java 17 | JDBC DataSource and database required'), runtime: 'project' },

  { ...project(11, 'Medium', 'Test appraisal credit validation with JUnit',
    'Write JUnit 5 tests for the supplied Credits.remaining method. Cover a successful debit, exact-balance debit, insufficient credits, negative balance, zero cost, and negative cost. Keep the supplied policy unchanged and assert the exception type. Run the test with Maven in an exercise project or service test source set.',
    'Six JUnit tests pass. A mutation that permits zero cost or an overdraft makes the relevant test fail.',
    `import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class Credits {
    static int remaining(int balance, int cost) {
        if (balance < 0 || cost <= 0 || balance < cost) throw new IllegalArgumentException();
        return balance - cost;
    }
}
class CreditsTest {
    // TODO six focused tests; run with mvn test
}`,
    `import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class Credits {
    static int remaining(int balance, int cost) {
        if (balance < 0 || cost <= 0 || balance < cost) throw new IllegalArgumentException();
        return balance - cost;
    }
}
class CreditsTest {
    @Test void debitsCredits() { assertEquals(4, Credits.remaining(5, 1)); }
    @Test void allowsExactBalance() { assertEquals(0, Credits.remaining(1, 1)); }
    @Test void rejectsInsufficientCredits() { assertThrows(IllegalArgumentException.class, () -> Credits.remaining(0, 1)); }
    @Test void rejectsNegativeBalance() { assertThrows(IllegalArgumentException.class, () -> Credits.remaining(-1, 1)); }
    @Test void rejectsZeroCost() { assertThrows(IllegalArgumentException.class, () -> Credits.remaining(5, 0)); }
    @Test void rejectsNegativeCost() { assertThrows(IllegalArgumentException.class, () -> Credits.remaining(5, -1)); }
}`,
    'Turn each contract boundary into a focused test. Assert return values for valid inputs and assertThrows for invalid inputs.',
    'Project setup: JUnit Jupiter from spring-boot-starter-test or junit-jupiter, and Maven Surefire with JUnit 5 support. Put the code in src/test/java for the exercise. These are policy unit tests; they do not prove database transaction or concurrent billing correctness.',
    'Java 17 | JUnit 5 and Maven required'), runtime: 'project' }
];
