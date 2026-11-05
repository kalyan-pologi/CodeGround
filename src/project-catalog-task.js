const model = `    interface Identified { long id(); }
    record Property(long id, String city, BigDecimal askingPrice) implements Identified {}
    record Notification(long id, String eventType) implements Identified {}
`;

const scaffold = `    static final class Catalog<T extends Identified> {
        private final Map<Long, T> byId = new LinkedHashMap<>();

        void add(T item) {
            // TODO validate and add; reject an existing ID
            throw new UnsupportedOperationException("Not implemented");
        }

        boolean update(T item) {
            // TODO replace only an existing ID
            throw new UnsupportedOperationException("Not implemented");
        }

        Optional<T> findById(long id) {
            // TODO return an Optional
            throw new UnsupportedOperationException("Not implemented");
        }

        boolean remove(long id) {
            // TODO remove if present
            throw new UnsupportedOperationException("Not implemented");
        }

        int importBatch(List<? extends T> batch) {
            // TODO validate the entire batch before changing the catalog
            throw new UnsupportedOperationException("Not implemented");
        }

        List<T> search(Predicate<? super T> filter, Comparator<? super T> order,
                       int page, int size) {
            // TODO filter, sort, and paginate without modifying the stored order
            throw new UnsupportedOperationException("Not implemented");
        }

        Map<Long, T> snapshot() {
            // TODO return an independent, unmodifiable map in insertion order
            throw new UnsupportedOperationException("Not implemented");
        }
    }
`;

const implementation = `    static final class Catalog<T extends Identified> {
        private final Map<Long, T> byId = new LinkedHashMap<>();

        private static void validateId(long id) {
            if (id <= 0) throw new IllegalArgumentException("ID must be positive");
        }

        private static void validate(Identified item) {
            if (item == null) throw new IllegalArgumentException("Item is required");
            validateId(item.id());
        }

        void add(T item) {
            validate(item);
            if (byId.putIfAbsent(item.id(), item) != null)
                throw new IllegalArgumentException("ID already exists: " + item.id());
        }

        boolean update(T item) {
            validate(item);
            return byId.replace(item.id(), item) != null;
        }

        Optional<T> findById(long id) {
            validateId(id);
            return Optional.ofNullable(byId.get(id));
        }

        boolean remove(long id) {
            validateId(id);
            return byId.remove(id) != null;
        }

        int importBatch(List<? extends T> batch) {
            if (batch == null) throw new IllegalArgumentException("Batch is required");
            Map<Long, T> staged = new LinkedHashMap<>(byId);
            for (T item : batch) {
                validate(item);
                T existing = staged.putIfAbsent(item.id(), item);
                if (existing != null && !existing.equals(item))
                    throw new IllegalArgumentException("Conflicting ID: " + item.id());
            }
            int added = staged.size() - byId.size();
            byId.clear();
            byId.putAll(staged);
            return added;
        }

        List<T> search(Predicate<? super T> filter, Comparator<? super T> order,
                       int page, int size) {
            if (filter == null || order == null || page < 0 || size < 1 || size > 100)
                throw new IllegalArgumentException("Invalid search");
            List<T> matches = new ArrayList<>();
            for (T item : byId.values()) if (filter.test(item)) matches.add(item);
            matches.sort(order);
            long offset = (long) page * size;
            if (offset >= matches.size()) return List.of();
            int end = (int) Math.min((long) matches.size(), offset + size);
            return List.copyOf(matches.subList((int) offset, end));
        }

        Map<Long, T> snapshot() {
            return Collections.unmodifiableMap(new LinkedHashMap<>(byId));
        }
    }
`;

const checks = `    static Property property(long id, String city, String price) {
        return new Property(id, city, new BigDecimal(price));
    }

    static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    static void expect(Class<? extends Throwable> type, Runnable action) {
        try { action.run(); }
        catch (Throwable failure) {
            if (type.isInstance(failure)) return;
            throw new AssertionError("Expected " + type.getSimpleName(), failure);
        }
        throw new AssertionError("Expected " + type.getSimpleName());
    }

    static List<Long> ids(List<Property> properties) {
        List<Long> result = new ArrayList<>();
        for (Property property : properties) result.add(property.id());
        return result;
    }

    static void checkCrud() {
        Catalog<Property> catalog = new Catalog<>();
        Property first = property(1, "Chicago", "250000");
        catalog.add(first);
        require(catalog.findById(1).orElseThrow().equals(first), "Added property missing");
        expect(IllegalArgumentException.class, () -> catalog.add(first));
        Property changed = property(1, "Chicago", "260000");
        require(catalog.update(changed), "Existing update must succeed");
        require(catalog.findById(1).orElseThrow().equals(changed), "Update not saved");
        require(!catalog.update(property(99, "Austin", "1")), "Missing update must not insert");
        require(catalog.remove(1) && !catalog.remove(1), "Remove must report presence");
        require(catalog.findById(1).isEmpty(), "Removed property retained");
        System.out.println("PASS: add, update, find, remove");
    }

    static void checkBatchDeduplication() {
        Catalog<Property> catalog = new Catalog<>();
        Property one = property(1, "Chicago", "250000");
        Property two = property(2, "Austin", "200000");
        Property three = property(3, "Boston", "300000");
        catalog.add(one);
        List<Property> batch = new ArrayList<>(List.of(one, two, two, three));
        require(catalog.importBatch(batch) == 2, "Count only newly inserted IDs");
        require(catalog.importBatch(batch) == 0, "Identical re-import must be idempotent");
        require(new ArrayList<>(catalog.snapshot().keySet()).equals(List.of(1L, 2L, 3L)), "Import order lost");
        require(batch.size() == 4, "Input batch was modified");
        require(catalog.importBatch(List.of()) == 0, "Empty import must add nothing");
        System.out.println("PASS: batch import and deduplication");
    }

    static void checkBatchRollback() {
        Catalog<Property> catalog = new Catalog<>();
        catalog.add(property(1, "Chicago", "250000"));
        Map<Long, Property> before = catalog.snapshot();
        expect(IllegalArgumentException.class, () -> catalog.importBatch(List.of(
            property(2, "Austin", "200000"), property(1, "Chicago", "999999"))));
        require(catalog.snapshot().equals(before), "A conflicting import partially changed the catalog");
        expect(IllegalArgumentException.class, () -> catalog.importBatch(List.of(
            property(3, "Boston", "300000"), property(3, "Boston", "350000"))));
        require(catalog.snapshot().equals(before), "Conflict within batch partially committed");
        expect(IllegalArgumentException.class, () -> catalog.importBatch(Arrays.asList(
            property(4, "Austin", "200000"), null)));
        require(catalog.snapshot().equals(before), "Invalid item partially committed");
        System.out.println("PASS: all-or-nothing batch validation");
    }

    static void checkSearch() {
        Catalog<Property> catalog = new Catalog<>();
        catalog.importBatch(List.of(property(3, "Chicago", "300000"),
            property(1, "Chicago", "250000"), property(2, "CHICAGO", "250000"),
            property(4, "Austin", "100000"), property(5, "Chicago", "400000")));
        Predicate<Property> affordableChicago = p -> p.city().equalsIgnoreCase("Chicago")
            && p.askingPrice().compareTo(new BigDecimal("300000")) <= 0;
        Comparator<Property> order = Comparator.comparing(Property::askingPrice).thenComparingLong(Property::id);
        require(ids(catalog.search(affordableChicago, order, 0, 2)).equals(List.of(1L, 2L)), "Filter, tie-break, or first page incorrect");
        require(ids(catalog.search(affordableChicago, order, 1, 2)).equals(List.of(3L)), "Second page incorrect");
        require(catalog.search(affordableChicago, order, 99, 2).isEmpty(), "Out-of-range page not empty");
        require(catalog.search(affordableChicago, order, Integer.MAX_VALUE, 100).isEmpty(), "Offset overflow");
        require(catalog.search(p -> false, order, 0, 2).isEmpty(), "No-match query not empty");
        require(new ArrayList<>(catalog.snapshot().keySet()).equals(List.of(3L, 1L, 2L, 4L, 5L)), "Search reordered stored data");
        System.out.println("PASS: filtering, stable sorting, pagination");
    }

    static void checkSnapshots() {
        Catalog<Property> catalog = new Catalog<>();
        Property original = property(1, "Chicago", "250000");
        catalog.add(original);
        Map<Long, Property> snapshot = catalog.snapshot();
        List<Property> results = catalog.search(p -> true, Comparator.comparingLong(Property::id), 0, 10);
        expect(UnsupportedOperationException.class, () -> snapshot.remove(1L));
        expect(UnsupportedOperationException.class, () -> results.add(property(2, "Austin", "1")));
        catalog.update(property(1, "Chicago", "260000"));
        catalog.add(property(2, "Austin", "200000"));
        require(snapshot.size() == 1 && snapshot.get(1L).equals(original), "Snapshot is a live view");
        require(results.equals(List.of(original)), "Search results changed after an update");
        System.out.println("PASS: independent unmodifiable results");
    }

    static void checkValidation() {
        Catalog<Property> catalog = new Catalog<>();
        expect(IllegalArgumentException.class, () -> catalog.add(null));
        expect(IllegalArgumentException.class, () -> catalog.add(property(0, "Chicago", "1")));
        expect(IllegalArgumentException.class, () -> catalog.update(null));
        expect(IllegalArgumentException.class, () -> catalog.update(property(-1, "Chicago", "1")));
        expect(IllegalArgumentException.class, () -> catalog.findById(0));
        expect(IllegalArgumentException.class, () -> catalog.remove(-1));
        expect(IllegalArgumentException.class, () -> catalog.importBatch(null));
        Comparator<Property> order = Comparator.comparingLong(Property::id);
        expect(IllegalArgumentException.class, () -> catalog.search(null, order, 0, 10));
        expect(IllegalArgumentException.class, () -> catalog.search(p -> true, null, 0, 10));
        expect(IllegalArgumentException.class, () -> catalog.search(p -> true, order, -1, 10));
        expect(IllegalArgumentException.class, () -> catalog.search(p -> true, order, 0, 0));
        expect(IllegalArgumentException.class, () -> catalog.search(p -> true, order, 0, 101));
        require(catalog.snapshot().isEmpty(), "Validation changed the empty catalog");
        System.out.println("PASS: invalid inputs and empty catalog");
    }

    static void checkGenericsAndOrder() {
        Catalog<Notification> notifications = new Catalog<>();
        List<Notification> input = List.of(new Notification(7, "PropertyCreated"));
        require(notifications.importBatch(input) == 1, "Catalog is hard-coded to Property");
        Predicate<Identified> positive = item -> item.id() > 0;
        Comparator<Identified> byId = Comparator.comparingLong(Identified::id);
        require(notifications.search(positive, byId, 0, 10).equals(input), "Generic consumers rejected");
        Catalog<Property> properties = new Catalog<>();
        properties.add(property(2, "Austin", "1"));
        properties.add(property(1, "Chicago", "1"));
        properties.update(property(2, "Austin", "2"));
        require(new ArrayList<>(properties.snapshot().keySet()).equals(List.of(2L, 1L)), "Update changed insertion order");
        properties.remove(2);
        properties.add(property(2, "Austin", "3"));
        require(new ArrayList<>(properties.snapshot().keySet()).equals(List.of(1L, 2L)), "Re-added ID must append");
        System.out.println("PASS: generic reuse and insertion order");
    }

    public static void main(String[] args) {
        checkCrud();
        checkBatchDeduplication();
        checkBatchRollback();
        checkSearch();
        checkSnapshots();
        checkValidation();
        checkGenericsAndOrder();
        System.out.println("All property catalog checks passed");
    }
`;

const program = catalog => `import java.math.BigDecimal;\nimport java.util.*;\nimport java.util.function.*;\n\npublic class Main {\n${model}\n${catalog}\n${checks}}\n`;

export const propertyCatalogTask = {
  topic: 'Collections & Generics', difficulty: 'Medium', runtime: 'java',
  title: 'Build a reusable property catalog with safe batch imports',
  environment: 'Java 17 | Standalone feature task | Suggested time: 60–90 minutes',
  statement: 'ReidyAI receives individual property changes and batches from listing partners. Build a reusable Catalog<T extends Identified> that keeps unique records, supports updates and paginated searches, and rejects conflicting imports without leaving partial changes. The same catalog must work for notification records. Implement the seven catalog operations and validation helpers; the supplied main method contains executable acceptance checks. This task is single-threaded and in-memory.',
  requirements: [
    'Store one item per positive ID. Reject null items and nonpositive IDs with IllegalArgumentException. Preserve first-insertion order. Provided Property city and price values are valid; this task validates identity and collection behavior.',
    'add rejects any existing ID. update replaces only an existing record and reports success without inserting missing IDs. Replacing a record preserves its position.',
    'findById returns Optional.empty() when a positive ID is absent. remove reports whether a record existed. Removing and later re-adding an ID appends it to insertion order.',
    'importBatch accepts List<? extends T>. Ignore identical repeated records according to equals, reject conflicting records with the same ID, and return the number of newly inserted IDs. Identical existing records also count as duplicates, not new inserts.',
    'Validate a complete batch before publishing its changes. A conflict or invalid item anywhere in a batch must leave the catalog exactly as it was. Never modify the caller’s input list.',
    'search accepts Predicate<? super T> and Comparator<? super T>. Filter first, sort the matches, then apply zero-based pagination. Require page >= 0 and size 1–100; reject null predicates/comparators. Handle very large page numbers without integer overflow.',
    'Return independent, unmodifiable search lists and insertion-ordered map snapshots. Later catalog changes must not change earlier results. These are shallow snapshots; the provided records have immutable fields.',
    'Demonstrate generic reuse with Catalog<Property> and Catalog<Notification>. Complete the supplied acceptance checks, then add your own tests for batch conflicts and sorting tie-breakers.'
  ],
  starter: program(scaffold), solution: program(implementation),
  expected: 'PASS: add, update, find, remove\nPASS: batch import and deduplication\nPASS: all-or-nothing batch validation\nPASS: filtering, stable sorting, pagination\nPASS: independent unmodifiable results\nPASS: invalid inputs and empty catalog\nPASS: generic reuse and insertion order\nAll property catalog checks passed',
  pseudocode: 'Implement identity validation and basic CRUD first. Add a staged copy for batch imports. Build search results in a separate list, sort and paginate that list, and return defensive immutable copies. Run all checks and add a second domain type.',
  hintSteps: [
    'Start with LinkedHashMap<Long, T>: it provides ID lookup and preserves insertion order. replace updates without creating an absent mapping.',
    'For batch import, work on a temporary copy of the current map. Compare duplicates using equals. Commit the staged map only after every input record passes.',
    'Use ? extends T for a batch that supplies records, and ? super T for a predicate/comparator that consumes records. Test these with an Identified-level predicate.',
    'Create separate result collections. Compute the page offset as long before narrowing it, and return an empty result if the offset is beyond the match count.'
  ],
  explanation: [
    'The catalog owns identity and collection rules; the caller supplies domain-specific filtering and ordering. This keeps the generic container reusable rather than hard-coding city or salary fields.',
    'Staging the batch gives all-or-nothing validation for this single-threaded exercise. It is not a database transaction and does not provide crash recovery or thread safety.',
    'An unmodifiable view of the live map would still change after catalog updates. Copying before wrapping preserves earlier snapshots. Mutable record contents would need their own defensive treatment.',
    'ID lookup is expected O(1). Import uses O(n + b) time and extra storage for n existing and b incoming items. Search scans n records and sorts m matches in O(n + m log m). For a large production catalog, database-side filtering, indexing, and pagination replace full scans.',
    'Duplicate equality follows T.equals. For the provided Property record, BigDecimal equality includes scale, so 1.0 and 1.00 are different record values. Normalize monetary values before import if your domain treats them as equivalent.'
  ],
  notes: 'Use the seven executable check groups in main to validate behavior. Add tests of your own rather than editing the expected checks to make an implementation pass. Explain LinkedHashMap vs HashMap, shallow copy vs live view, generic producer/consumer bounds, and why this local batch commit is not a replacement for a transaction. No threads, database, or Spring dependencies are required.'
};
