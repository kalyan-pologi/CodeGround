import { javaFeature } from './project-feature-builder.js';

export const advancedJavaTasks = [
  javaFeature({
    topic: 6, title: 'Build concurrent appraisal credit reservations',
    statement: 'Concurrent appraisal requests must not spend the same credits twice. Build an in-process reservation ledger that atomically reserves credits, supports idempotent keys, and transitions a reservation to committed or cancelled exactly once.',
    requirements: [
      'Start with a nonnegative balance. Validate trimmed nonblank keys and positive costs before changing any state.',
      'Reserve available credits atomically. An identical key/cost returns its current reservation without another deduction; a different cost for that key is a conflict.',
      'Insufficient funds must not create a reservation. Concurrent callers must never produce a negative available balance.',
      'commit changes HELD to COMMITTED and is idempotent. Committing a cancelled reservation is rejected.',
      'cancel restores HELD credits once and is idempotent. A committed reservation cannot be cancelled. Terminal keys remain reserved.',
      'Return immutable snapshots. Exercise both contention on one key and contention among different keys using a bounded executor, then shut the executor down.'
    ],
    model: '    enum Status { HELD, COMMITTED, CANCELLED }\n    record Reservation(String key, int cost, Status status) {}',
    members: `        private int available;
        private final Map<String, Reservation> reservations = new HashMap<>();
        Feature(int credits) {
            if (credits < 0) throw new IllegalArgumentException("Negative balance");
            available = credits;
        }`,
    methods: [
      { signature: 'private String key(String raw)', body: '        if (raw == null || raw.isBlank()) throw new IllegalArgumentException("Missing key");\n        return raw.strip();' },
      { signature: 'synchronized Reservation reserve(String raw, int cost)', body: `        String key = key(raw);
        if (cost <= 0) throw new IllegalArgumentException("Invalid cost");
        Reservation previous = reservations.get(key);
        if (previous != null) {
            if (previous.cost() != cost) throw new IllegalArgumentException("Conflicting retry");
            return previous;
        }
        if (available < cost) throw new IllegalStateException("Insufficient credits");
        Reservation created = new Reservation(key, cost, Status.HELD);
        available -= cost; reservations.put(key, created); return created;` },
      { signature: 'synchronized Reservation commit(String raw)', body: `        String key = key(raw); Reservation current = reservations.get(key);
        if (current == null) throw new IllegalArgumentException("Unknown reservation");
        if (current.status() == Status.CANCELLED) throw new IllegalStateException("Already cancelled");
        Reservation result = new Reservation(key, current.cost(), Status.COMMITTED);
        reservations.put(key, result); return result;` },
      { signature: 'synchronized Reservation cancel(String raw)', body: `        String key = key(raw); Reservation current = reservations.get(key);
        if (current == null) throw new IllegalArgumentException("Unknown reservation");
        if (current.status() == Status.COMMITTED) throw new IllegalStateException("Already committed");
        if (current.status() == Status.CANCELLED) return current;
        available = Math.addExact(available, current.cost());
        Reservation result = new Reservation(key, current.cost(), Status.CANCELLED);
        reservations.put(key, result); return result;` },
      { signature: 'synchronized int available()', body: '        return available;' },
      { signature: 'synchronized Map<String, Reservation> snapshot()', body: '        return Map.copyOf(reservations);' }
    ],
    checks: `        Feature ledger = new Feature(20); ExecutorService pool = Executors.newFixedThreadPool(6);
        try {
            List<Callable<Reservation>> duplicates = new ArrayList<>();
            for (int i = 0; i < 40; i++) duplicates.add(() -> ledger.reserve("same", 5));
            for (Future<Reservation> result : pool.invokeAll(duplicates)) check(result.get().cost() == 5, "Bad replay");
            check(ledger.available() == 15 && ledger.snapshot().size() == 1, "Duplicate key spent twice");
            List<Callable<Boolean>> requests = new ArrayList<>();
            for (int i = 0; i < 40; i++) { final int id = i; requests.add(() -> {
                try { ledger.reserve("unique-" + id, 1); return true; }
                catch (IllegalStateException exhausted) { return false; }
            }); }
            int accepted = 0;
            for (Future<Boolean> result : pool.invokeAll(requests)) if (result.get()) accepted++;
            check(accepted == 15 && ledger.available() == 0, "Overdraft under contention");
        } finally { pool.shutdownNow(); }
        check(ledger.cancel("same").status() == Status.CANCELLED && ledger.available() == 5, "Cancel failed");
        ledger.cancel("same"); check(ledger.available() == 5, "Cancel refunded twice");
        check(ledger.reserve("same", 5).status() == Status.CANCELLED && ledger.available() == 5, "Terminal key reused");
        reject(IllegalStateException.class, () -> ledger.commit("same"));
        ledger.reserve("commit", 2); ledger.commit("commit"); ledger.commit("commit");
        reject(IllegalStateException.class, () -> ledger.cancel("commit"));
        reject(IllegalArgumentException.class, () -> ledger.reserve("commit", 3));
        reject(UnsupportedOperationException.class, () -> ledger.snapshot().clear());`,
    hints: ['Protect the balance and key map with the same lock.', 'Check replay identity before allocating credits.', 'Write an explicit state-transition table before implementing commit and cancel.', 'Use invokeAll/Future.get so the test observes every worker failure.'],
    explanation: ['Synchronizing the whole state transition makes the key claim and credit deduction one critical section.', 'AtomicInteger alone cannot coordinate a separate reservation map; both pieces of state share one invariant.', 'The executor test is an exercise of this implementation, not proof against every schedule. Persisted transactions are still needed across service instances.'],
    notes: 'Add simultaneous commit/cancel contention and assert exactly one terminal outcome. Explain lock contention, visibility, immutable results, cancellation, and why terminal idempotency keys must not disappear.'
  }),
  javaFeature({
    topic: 7, title: 'Build a byte-budgeted LRU appraisal document cache',
    statement: 'Appraisal previews vary in size. Build a cache that limits retained byte arrays by total bytes, evicts the least recently accessed documents, and never leaks mutable internal arrays through its API.',
    requirements: [
      'Require a positive byte budget and positive document IDs. Reject null/empty payloads and payloads larger than the budget without changing state.',
      'Copy arrays on both insertion and retrieval. Caller mutations must not change retained documents.',
      'A successful get and put refresh access order. A missing get must not alter accounting.',
      'Replacement subtracts the old payload weight before adding the new one. Evict eldest entries until the new value fits.',
      'Support removal and shrinking/growing the budget. Shrinking must immediately evict enough entries, including oversized existing documents.',
      'Expose byte usage and an immutable key snapshot in least-to-most-recent order. This cache is single-threaded and does not implement TTL.'
    ],
    members: `        private long capacity;
        private long used;
        private final LinkedHashMap<Long, byte[]> data = new LinkedHashMap<>(16, 0.75f, true);
        Feature(long capacity) {
            if (capacity < 1) throw new IllegalArgumentException("Invalid budget");
            this.capacity = capacity;
        }`,
    methods: [
      { signature: 'private void id(long id)', body: '        if (id <= 0) throw new IllegalArgumentException("Invalid document ID");' },
      { signature: 'private void evictUntil(long maximum)', body: `        Iterator<Map.Entry<Long, byte[]>> entries = data.entrySet().iterator();
        while (used > maximum && entries.hasNext()) {
            used -= entries.next().getValue().length; entries.remove();
        }` },
      { signature: 'void put(long id, byte[] payload)', body: `        id(id);
        if (payload == null || payload.length == 0 || payload.length > capacity)
            throw new IllegalArgumentException("Invalid payload");
        byte[] copy = payload.clone();
        byte[] previous = data.remove(id);
        if (previous != null) used -= previous.length;
        evictUntil(capacity - copy.length);
        data.put(id, copy); used += copy.length;` },
      { signature: 'Optional<byte[]> get(long id)', body: `        id(id); byte[] value = data.get(id);
        return value == null ? Optional.empty() : Optional.of(value.clone());` },
      { signature: 'boolean remove(long id)', body: `        id(id); byte[] previous = data.remove(id);
        if (previous == null) return false;
        used -= previous.length; return true;` },
      { signature: 'void resize(long newCapacity)', body: `        if (newCapacity < 1) throw new IllegalArgumentException("Invalid budget");
        capacity = newCapacity; evictUntil(capacity);` },
      { signature: 'long usedBytes()', body: '        return used;' },
      { signature: 'List<Long> keys()', body: '        return List.copyOf(data.keySet());' }
    ],
    checks: `        Feature cache = new Feature(8); byte[] original = {1, 2, 3};
        cache.put(1, original); original[0] = 9; cache.put(2, new byte[3]);
        check(cache.get(1).orElseThrow()[0] == 1, "Input array escaped");
        cache.put(3, new byte[4]); check(cache.keys().equals(List.of(1L, 3L)), "Wrong LRU victim");
        check(cache.usedBytes() == 7, "Wrong byte accounting");
        byte[] retrieved = cache.get(1).orElseThrow(); retrieved[0] = 8;
        check(cache.get(1).orElseThrow()[0] == 1, "Output array escaped");
        List<Long> before = cache.keys(); reject(IllegalArgumentException.class, () -> cache.put(4, new byte[9]));
        check(cache.keys().equals(before) && cache.usedBytes() == 7, "Oversized put changed cache");
        cache.put(3, new byte[1]); check(cache.usedBytes() == 4, "Replacement weight leaked");
        cache.resize(2); check(cache.keys().equals(List.of(3L)) && cache.usedBytes() == 1, "Shrink did not evict");
        check(cache.remove(3) && !cache.remove(3) && cache.usedBytes() == 0, "Removal accounting failed");
        reject(UnsupportedOperationException.class, () -> before.clear());
        reject(IllegalArgumentException.class, () -> cache.resize(0));`,
    hints: ['Use an access-order LinkedHashMap and track payload weights separately.', 'Copy and validate a new payload before removing the old entry.', 'Evict with the map iterator so removal is safe during traversal.', 'Treat defensive copies as part of the cache contract, not a formatting detail.'],
    explanation: ['An entry-count cap does not bound retained memory when document sizes differ.', 'Copying arrays prevents callers from modifying shared cached content after validation.', 'The budget counts payload bytes only, not JVM object/header/map overhead. A production memory budget needs additional headroom and an established cache implementation.'],
    notes: 'Add budget-one, exact-fit, missing-ID, multiple-victim, and growth tests. Discuss strong references, reachability, retained heap, allocation costs, and why increasing -Xmx does not fix an unbounded retention policy.'
  }),
  javaFeature({
    topic: 8, title: 'Build an immutable appraisal workflow with sealed states',
    statement: 'Model appraisal progress using Java 17 records and sealed types. Implement a workflow that accepts charge, completion, and failure commands, rejects invalid transitions, and supports exact replay of already-applied terminal commands.',
    requirements: [
      'Create a validated Request with a positive property ID and trimmed nonblank request key.',
      'Only a Draft can be charged. Cost must be positive; replaying the same charge against Charged is allowed only when its cost matches.',
      'Only a Charged request can complete. Require a nonblank report ID and retain the original request and cost.',
      'A Draft or Charged request can fail with a nonblank reason. Preserve whether a cost was charged; the caller uses that to decide refund work.',
      'Exact completion/failure replays return the existing state. Conflicting terminal commands and null commands are rejected.',
      'Apply a list of commands to a local immutable state and return the final state. A rejected command cannot mutate the caller’s original state. Use no Java 21 preview or pattern-switch features.'
    ],
    model: `    record Request(long propertyId, String key) {}
    sealed interface State permits Draft, Charged, Completed, Failed { Request request(); }
    record Draft(Request request) implements State {}
    record Charged(Request request, int cost) implements State {}
    record Completed(Request request, int cost, String reportId) implements State {}
    record Failed(Request request, int cost, String reason) implements State {}
    sealed interface Command permits Charge, Complete, Fail {}
    record Charge(int cost) implements Command {}
    record Complete(String reportId) implements Command {}
    record Fail(String reason) implements Command {}`,
    methods: [
      { signature: 'Request request(long propertyId, String key)', body: `        if (propertyId <= 0 || key == null || key.isBlank()) throw new IllegalArgumentException("Invalid request");
        return new Request(propertyId, key.strip());` },
      { signature: 'State charge(State state, int cost)', body: `        if (cost <= 0) throw new IllegalArgumentException("Invalid cost");
        if (state instanceof Draft draft) return new Charged(draft.request(), cost);
        if (state instanceof Charged charged && charged.cost() == cost) return charged;
        throw new IllegalStateException("Cannot charge this state");` },
      { signature: 'State complete(State state, String rawId)', body: `        if (rawId == null || rawId.isBlank()) throw new IllegalArgumentException("Missing report ID");
        String id = rawId.strip();
        if (state instanceof Charged charged) return new Completed(charged.request(), charged.cost(), id);
        if (state instanceof Completed completed && completed.reportId().equals(id)) return completed;
        throw new IllegalStateException("Cannot complete this state");` },
      { signature: 'State fail(State state, String rawReason)', body: `        if (rawReason == null || rawReason.isBlank()) throw new IllegalArgumentException("Missing reason");
        String reason = rawReason.strip();
        if (state instanceof Draft draft) return new Failed(draft.request(), 0, reason);
        if (state instanceof Charged charged) return new Failed(charged.request(), charged.cost(), reason);
        if (state instanceof Failed failed && failed.reason().equals(reason)) return failed;
        throw new IllegalStateException("Cannot fail this state");` },
      { signature: 'State apply(State state, Command command)', body: `        if (state == null || command == null) throw new IllegalArgumentException("Missing state or command");
        if (command instanceof Charge charge) return charge(state, charge.cost());
        if (command instanceof Complete complete) return complete(state, complete.reportId());
        if (command instanceof Fail fail) return fail(state, fail.reason());
        throw new IllegalArgumentException("Unsupported command");` },
      { signature: 'State replay(State initial, List<Command> commands)', body: `        if (initial == null || commands == null) throw new IllegalArgumentException("Missing replay input");
        State current = initial;
        for (Command command : commands) current = apply(current, command);
        return current;` }
    ],
    checks: `        Feature workflow = new Feature(); Draft draft = new Draft(workflow.request(1, " key-1 "));
        State done = workflow.replay(draft, List.of(new Charge(2), new Charge(2), new Complete(" report-1 "), new Complete("report-1")));
        check(done.equals(new Completed(new Request(1, "key-1"), 2, "report-1")), "Successful replay failed");
        check(draft.request().key().equals("key-1"), "Original request changed");
        reject(IllegalStateException.class, () -> workflow.apply(draft, new Complete("early")));
        reject(IllegalStateException.class, () -> workflow.apply(done, new Complete("different")));
        reject(IllegalStateException.class, () -> workflow.apply(done, new Fail("late")));
        State failed = workflow.replay(draft, List.of(new Charge(2), new Fail("timeout"), new Fail("timeout")));
        check(failed instanceof Failed f && f.cost() == 2, "Charged failure lost refund context");
        check(workflow.apply(draft, new Fail("invalid")) instanceof Failed f && f.cost() == 0, "Draft failure invented charge");
        reject(IllegalArgumentException.class, () -> workflow.apply(draft, new Charge(0)));
        reject(IllegalArgumentException.class, () -> workflow.apply(draft, null));
        reject(IllegalStateException.class, () -> workflow.replay(draft, List.of(new Charge(1), new Charge(2))));`,
    hints: ['Write a transition table before coding the dispatcher.', 'Put request identity in every state and carry it forward without mutation.', 'Define exact replay separately from a conflicting repeat.', 'Use instanceof binding for Java 17 and keep side effects outside this pure state machine.'],
    explanation: ['Sealed states describe the permitted shapes of progress, while transition methods enforce the business rules between them.', 'Records make the data immutable, but record constructors alone do not prove that every transition is valid. Build states through the workflow boundary.', 'A Failed record carrying cost is refund context, not evidence that a real refund happened. Persisted side effects require a separate coordinated workflow.'],
    notes: 'Add null report IDs, empty replay, pre-charge failure replay, and invalid request tests. Discuss how Java 21 exhaustive pattern switches could improve the dispatcher after a project runtime upgrade.'
  }),
  javaFeature({
    topic: 9, title: 'Build a validated annotation-based report exporter',
    statement: 'An internal report export must expose only approved scalar getters. Build and validate a reusable export schema once, support field aliases and required values, and reject ambiguous or unsafe annotated methods before processing a report batch.',
    requirements: [
      'Discover only declared @PublicField methods. Require public, nonstatic, zero-argument getters with supported scalar return types.',
      'Support String, BigDecimal, boolean/Boolean, long/Long, and int/Integer. Reject arbitrary object returns rather than exposing nested data.',
      'Require unique nonblank trimmed aliases. Sort the schema by alias for deterministic exports.',
      'Export only annotated fields. Omit optional null values, but reject null required values.',
      'Validate target type and translate reflective invocation failure to IllegalStateException while retaining the original getter exception as the cause. Do not bypass access control.',
      'Return immutable maps and batch lists. A failed batch returns no partial result. Expose field names without leaking mutable Method handles.'
    ],
    model: `    @Retention(RetentionPolicy.RUNTIME) @Target(ElementType.METHOD)
    @interface PublicField { String value(); boolean required() default true; }
    record Field(String alias, Method method, boolean required) {}
    public static class View {
        @PublicField("city") public String city() { return "Chicago"; }
        @PublicField(value = "note", required = false) public String note() { return null; }
        public String token() { return "secret"; }
    }
    public static class Duplicate {
        @PublicField("same") public String a() { return "a"; }
        @PublicField("same") public String b() { return "b"; }
    }
    public static class Unsafe { @PublicField("nested") public Object nested() { return new Object(); } }
    public static class Missing { @PublicField("city") public String city() { return null; } }
    public static class Broken { @PublicField("city") public String city() { throw new IllegalArgumentException("broken getter"); } }`,
    members: `        private final Class<?> type;
        private final List<Field> fields;
        Feature(Class<?> type) {
            if (type == null) throw new IllegalArgumentException("Missing type");
            this.type = type; fields = compile(type);
        }`,
    methods: [
      { signature: 'private static boolean supported(Class<?> type)', body: `        return Set.of(String.class, BigDecimal.class, boolean.class, Boolean.class,
            long.class, Long.class, int.class, Integer.class).contains(type);` },
      { signature: 'private static List<Field> compile(Class<?> type)', body: `        Map<String, Field> schema = new TreeMap<>();
        for (Method method : type.getDeclaredMethods()) {
            PublicField annotation = method.getAnnotation(PublicField.class);
            if (annotation == null) continue;
            String alias = annotation.value().strip();
            if (alias.isBlank() || !Modifier.isPublic(method.getModifiers()) || Modifier.isStatic(method.getModifiers())
                || method.getParameterCount() != 0 || !supported(method.getReturnType()))
                throw new IllegalArgumentException("Invalid annotated getter");
            if (schema.putIfAbsent(alias, new Field(alias, method, annotation.required())) != null)
                throw new IllegalArgumentException("Duplicate alias");
        }
        return List.copyOf(schema.values());` },
      { signature: 'Map<String, Object> export(Object target)', body: `        if (target == null || target.getClass() != type) throw new IllegalArgumentException("Wrong target type");
        Map<String, Object> result = new LinkedHashMap<>();
        for (Field field : fields) {
            Object value;
            try { value = field.method().invoke(target); }
            catch (InvocationTargetException failure) { throw new IllegalStateException("Getter failed", failure.getCause()); }
            catch (ReflectiveOperationException failure) { throw new IllegalStateException("Getter inaccessible", failure); }
            if (value == null && field.required()) throw new IllegalArgumentException("Missing " + field.alias());
            if (value != null) result.put(field.alias(), value);
        }
        return Collections.unmodifiableMap(result);` },
      { signature: 'List<Map<String, Object>> exportBatch(List<?> targets)', body: `        if (targets == null) throw new IllegalArgumentException("Missing batch");
        List<Map<String, Object>> results = new ArrayList<>();
        for (Object target : targets) results.add(export(target));
        return List.copyOf(results);` },
      { signature: 'List<String> fieldNames()', body: '        return fields.stream().map(Field::alias).toList();' }
    ],
    checks: `        Feature exporter = new Feature(View.class);
        Map<String, Object> result = exporter.export(new View());
        check(result.equals(Map.of("city", "Chicago")), "Secret or null field exposed");
        check(exporter.fieldNames().equals(List.of("city", "note")), "Schema order failed");
        reject(UnsupportedOperationException.class, () -> result.clear());
        reject(IllegalArgumentException.class, () -> new Feature(Duplicate.class));
        reject(IllegalArgumentException.class, () -> new Feature(Unsafe.class));
        reject(IllegalArgumentException.class, () -> new Feature(Missing.class).export(new Missing()));
        reject(IllegalArgumentException.class, () -> exporter.exportBatch(Arrays.asList(new View(), null)));
        check(exporter.exportBatch(List.of(new View(), new View())).size() == 2, "Batch failed");
        try { new Feature(Broken.class).export(new Broken()); throw new AssertionError("Expected getter failure"); }
        catch (IllegalStateException failure) { check(failure.getCause() instanceof IllegalArgumentException, "Original cause lost"); }`,
    hints: ['Compile a sorted allowlist of metadata once rather than scanning on each export.', 'Validate aliases and method signatures before invoking any target.', 'Treat optional nulls differently from missing required fields.', 'Unwrap InvocationTargetException without exposing unannotated getters.'],
    explanation: ['Runtime annotations need RUNTIME retention; otherwise reflection cannot discover the policy.', 'Allowlisting scalar return types prevents an annotated getter from recursively exposing a large object graph.', 'Reflection is appropriate for this learning task, but explicit DTO mapping is usually easier to audit for public APIs.'],
    notes: 'Add private/static/parameterized annotated methods, whitespace aliases, wrong target types, and an annotation-free class. This exercise deliberately excludes inherited getters and requires the exact compiled class.'
  })
];
