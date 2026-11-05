import { javaFeature } from './project-feature-builder.js';

export const mediumJavaTasks = [
  javaFeature({
    topic: 0, title: 'Build an idempotent appraisal credit ledger',
    statement: 'A paid appraisal can be retried after a client timeout. Build a single-threaded credit ledger that charges once per request key, detects conflicting retries, and supports a one-time refund. Keep arithmetic and state transitions explicit rather than relying on floating-point money calculations.',
    requirements: [
      'Initialize a nonnegative integer credit balance. Validate nonblank request keys and positive costs; trim keys so whitespace does not create a second charge.',
      'charge returns the saved charge on an identical retry. A reused key with a different cost is rejected, including after a refund.',
      'Reject insufficient funds without changing the balance or recording a charge. A failed attempt may be retried later after adding credits.',
      'refund restores a charge once, returns false on repeat, and rejects an unknown request. A refunded key stays reserved and cannot charge again.',
      'addCredits accepts a positive amount and rejects integer overflow without changing the previous balance.',
      'Expose the current balance and an independent unmodifiable charge history. Complete the supplied boundary checks and add failure-then-top-up tests.'
    ],
    model: '    record Charge(String key, int cost, boolean refunded) {}',
    members: `        private int balance;
        private final Map<String, Charge> charges = new LinkedHashMap<>();
        Feature(int initial) {
            if (initial < 0) throw new IllegalArgumentException("Negative balance");
            balance = initial;
        }`,
    methods: [
      { signature: 'private String key(String value)', body: `        if (value == null || value.isBlank()) throw new IllegalArgumentException("Missing key");
        return value.strip();` },
      { signature: 'Charge charge(String rawKey, int cost)', body: `        String key = key(rawKey);
        if (cost <= 0) throw new IllegalArgumentException("Invalid cost");
        Charge previous = charges.get(key);
        if (previous != null) {
            if (previous.cost() != cost) throw new IllegalArgumentException("Conflicting retry");
            return previous;
        }
        if (balance < cost) throw new IllegalStateException("Insufficient credits");
        Charge charge = new Charge(key, cost, false);
        balance -= cost;
        charges.put(key, charge);
        return charge;` },
      { signature: 'boolean refund(String rawKey)', body: `        String key = key(rawKey);
        Charge charge = charges.get(key);
        if (charge == null) throw new IllegalArgumentException("Unknown charge");
        if (charge.refunded()) return false;
        int restored = Math.addExact(balance, charge.cost());
        charges.put(key, new Charge(key, charge.cost(), true));
        balance = restored;
        return true;` },
      { signature: 'void addCredits(int amount)', body: `        if (amount <= 0) throw new IllegalArgumentException("Invalid top-up");
        balance = Math.addExact(balance, amount);` },
      { signature: 'int balance()', body: '        return balance;' },
      { signature: 'List<Charge> history()', body: '        return List.copyOf(charges.values());' }
    ],
    checks: `        Feature ledger = new Feature(5);
        Charge first = ledger.charge(" req-1 ", 2);
        check(ledger.charge("req-1", 2).equals(first) && ledger.balance() == 3, "Retry charged twice");
        reject(IllegalArgumentException.class, () -> ledger.charge("req-1", 3));
        reject(IllegalStateException.class, () -> ledger.charge("req-2", 4));
        check(ledger.history().size() == 1 && ledger.balance() == 3, "Failed charge changed state");
        List<Charge> before = ledger.history();
        check(ledger.refund("req-1") && !ledger.refund("req-1"), "Refund is not idempotent");
        check(ledger.balance() == 5 && ledger.charge("req-1", 2).refunded(), "Refunded key reused");
        check(!before.get(0).refunded(), "History is a live view");
        reject(UnsupportedOperationException.class, () -> before.clear());
        ledger.addCredits(2); ledger.charge("req-2", 4);
        check(ledger.balance() == 3, "Failed request could not retry");
        Feature maximum = new Feature(Integer.MAX_VALUE);
        reject(ArithmeticException.class, () -> maximum.addCredits(1));
        check(maximum.balance() == Integer.MAX_VALUE, "Overflow changed balance");
        reject(IllegalArgumentException.class, () -> ledger.charge(" ", 1));
        reject(IllegalArgumentException.class, () -> ledger.charge("bad", 0));
        reject(IllegalArgumentException.class, () -> ledger.refund("missing"));`,
    hints: ['Define the invariant balance >= 0 and validate before mutating.', 'Check the request-key history before checking available credits.', 'Compute checked arithmetic into a temporary value before publishing a refund.', 'Keep refunded records so old keys cannot silently become new charges.'],
    explanation: ['A request key represents one immutable charge intent. Replaying it must return its existing state, even if it has been refunded.', 'Math.addExact prevents overflow from turning valid credits into a negative balance; assignment happens only after the calculation succeeds.', 'The map is an educational local ledger. A service needs persistent keys and a transaction covering the balance and charge record.'],
    notes: 'Checks cover retries, conflicting costs, insufficient funds, refund replay, top-up overflow, and immutable history. Add an overflow-on-refund case after a top-up. State is single-threaded; do not mistake this for cross-instance billing protection.'
  }),
  javaFeature({
    topic: 1, title: 'Build a normalized appraisal quote engine',
    statement: 'ReidyAI offers standard and premium reports. Build an encapsulated quote engine that normalizes text requests, delegates discounts to a policy, validates the policy result, and returns immutable quote objects. Keep pricing rules interchangeable rather than switching on concrete policy implementations.',
    requirements: [
      'Copy the supplied price map. Require a nonnegative price for every Tier; later source-map mutations must not change engine prices.',
      'Normalize report names with strip and Locale.ROOT uppercase. Reject null, blank, and unknown names.',
      'Create a percentage-discount policy with a rate from 0 through 1 inclusive. Policies return a discounted amount; quote must reject negative, null, or above-base results.',
      'Round the final amount once to two decimals with HALF_UP. Return the tier, original base, and final amount in a Quote record.',
      'Support batch quoting in encounter order without changing input strings. An invalid request rejects the batch result.',
      'Expose an unmodifiable price snapshot and demonstrate a second policy without changing the quote algorithm.'
    ],
    model: `    enum Tier { STANDARD, PREMIUM }
    interface DiscountPolicy { BigDecimal apply(BigDecimal base); }
    record Quote(Tier tier, BigDecimal base, BigDecimal total) {}`,
    members: `        private final Map<Tier, BigDecimal> prices;
        Feature(Map<Tier, BigDecimal> source) {
            if (source == null) throw new IllegalArgumentException("Missing prices");
            EnumMap<Tier, BigDecimal> copy = new EnumMap<>(Tier.class);
            for (Tier tier : Tier.values()) {
                BigDecimal amount = source.get(tier);
                if (amount == null || amount.signum() < 0) throw new IllegalArgumentException("Invalid prices");
                copy.put(tier, amount);
            }
            prices = Collections.unmodifiableMap(copy);
        }`,
    methods: [
      { signature: 'Tier normalize(String raw)', body: `        if (raw == null || raw.isBlank()) throw new IllegalArgumentException("Missing tier");
        return Tier.valueOf(raw.strip().toUpperCase(Locale.ROOT));` },
      { signature: 'static DiscountPolicy percentage(BigDecimal rate)', body: `        if (rate == null || rate.signum() < 0 || rate.compareTo(BigDecimal.ONE) > 0)
            throw new IllegalArgumentException("Invalid rate");
        return base -> base.multiply(BigDecimal.ONE.subtract(rate));` },
      { signature: 'Quote quote(String raw, DiscountPolicy policy)', body: `        Tier tier = normalize(raw);
        if (policy == null) throw new IllegalArgumentException("Missing policy");
        BigDecimal base = prices.get(tier);
        BigDecimal total = policy.apply(base);
        if (total == null || total.signum() < 0 || total.compareTo(base) > 0)
            throw new IllegalArgumentException("Invalid policy result");
        return new Quote(tier, base, total.setScale(2, RoundingMode.HALF_UP));` },
      { signature: 'List<Quote> quoteBatch(List<String> requests, DiscountPolicy policy)', body: `        if (requests == null) throw new IllegalArgumentException("Missing requests");
        List<Quote> result = new ArrayList<>();
        for (String request : requests) result.add(quote(request, policy));
        return List.copyOf(result);` },
      { signature: 'Map<Tier, BigDecimal> prices()', body: '        return prices;' }
    ],
    checks: `        Map<Tier, BigDecimal> source = new EnumMap<>(Tier.class);
        source.put(Tier.STANDARD, new BigDecimal("10.05")); source.put(Tier.PREMIUM, new BigDecimal("20"));
        Feature engine = new Feature(source); source.put(Tier.STANDARD, BigDecimal.ZERO);
        DiscountPolicy tenPercent = Feature.percentage(new BigDecimal("0.10"));
        check(engine.quote(" standard ", tenPercent).total().equals(new BigDecimal("9.05")), "Normalization or rounding failed");
        check(engine.quote("premium", base -> base.subtract(BigDecimal.ONE)).total().equals(new BigDecimal("19.00")), "Second policy failed");
        List<Quote> quotes = engine.quoteBatch(List.of("premium", "standard"), tenPercent);
        check(quotes.get(0).tier() == Tier.PREMIUM && quotes.size() == 2, "Batch order lost");
        reject(UnsupportedOperationException.class, () -> quotes.clear());
        reject(UnsupportedOperationException.class, () -> engine.prices().clear());
        reject(IllegalArgumentException.class, () -> engine.quote("unknown", tenPercent));
        reject(IllegalArgumentException.class, () -> engine.quote(null, tenPercent));
        reject(IllegalArgumentException.class, () -> Feature.percentage(new BigDecimal("1.01")));
        reject(IllegalArgumentException.class, () -> engine.quote("standard", base -> base.add(BigDecimal.ONE)));
        reject(IllegalArgumentException.class, () -> engine.quote("standard", base -> null));
        check(engine.quote("premium", Feature.percentage(BigDecimal.ONE)).total().signum() == 0, "Full discount rejected");`,
    hints: ['Use an enum for valid report types and an EnumMap for configured prices.', 'Normalize text at one boundary so pricing works with typed values.', 'Delegate to the interface and validate its result rather than trusting every implementation.', 'Use exact decimal constants and round only when producing the final quote.'],
    explanation: ['Composition lets a membership discount, fixed discount, or promotional policy share one quote workflow.', 'Defensive copying protects configuration; records and immutable monetary values keep quote results independent.', 'Validating the result protects the engine even when a custom policy has an invalid implementation.'],
    notes: 'Explain encapsulation, records, interfaces, normalization, and polymorphism. Add tests for zero discount, an empty batch, an incomplete price map, and a negative policy result. Do not construct monetary amounts from double.'
  }),
  javaFeature({
    topic: 3, title: 'Build an appraisal analytics pipeline from versioned reports',
    statement: 'An analytics endpoint receives repeated appraisal events, incomplete work, and multiple completed reports for one property. Build a Stream-based pipeline that validates event identity, selects the latest completed report per property, aggregates city statistics, and returns ranked paginated results.',
    requirements: [
      'Deduplicate by event ID using record equality. Identical repeated events are accepted; conflicting payloads for one ID reject the input.',
      'Ignore incomplete reports when selecting results. For each property, select the greatest createdAt, breaking timestamp ties by greatest event ID.',
      'Normalize city names with strip and Locale.ROOT lowercase. Return city statistics containing report count, exact total, and average rounded HALF_UP to two decimals.',
      'Rank selected reports by amount descending then property ID ascending. Require a top limit from 1–100.',
      'Paginate ranked results with page >= 0 and size 1–100. A page beyond the end is empty; large offsets must not overflow.',
      'Keep the input untouched and return unmodifiable result collections. Empty input produces empty collections, not fabricated averages.'
    ],
    model: `    record Report(long eventId, long propertyId, String city, BigDecimal amount, Instant createdAt, boolean complete) {}
    record CityStats(long count, BigDecimal total, BigDecimal average) {}`,
    methods: [
      { signature: 'List<Report> unique(List<Report> events)', body: `        if (events == null) throw new IllegalArgumentException("Missing events");
        Map<Long, Report> unique = new LinkedHashMap<>();
        for (Report report : events) {
            if (report == null || report.eventId() <= 0 || report.propertyId() <= 0 || report.city() == null
                || report.city().isBlank() || report.amount() == null || report.amount().signum() < 0 || report.createdAt() == null)
                throw new IllegalArgumentException("Invalid report");
            Report previous = unique.putIfAbsent(report.eventId(), report);
            if (previous != null && !previous.equals(report)) throw new IllegalArgumentException("Conflicting event");
        }
        return List.copyOf(unique.values());` },
      { signature: 'List<Report> latest(List<Report> events)', body: `        Comparator<Report> version = Comparator.comparing(Report::createdAt).thenComparingLong(Report::eventId);
        return unique(events).stream().filter(Report::complete)
            .collect(java.util.stream.Collectors.toMap(Report::propertyId, Function.identity(), BinaryOperator.maxBy(version)))
            .values().stream().sorted(Comparator.comparingLong(Report::propertyId)).toList();` },
      { signature: 'Map<String, CityStats> summarize(List<Report> events)', body: `        Map<String, List<Report>> groups = latest(events).stream().collect(java.util.stream.Collectors.groupingBy(
            report -> report.city().strip().toLowerCase(Locale.ROOT), TreeMap::new, java.util.stream.Collectors.toList()));
        Map<String, CityStats> result = new TreeMap<>();
        groups.forEach((city, reports) -> {
            BigDecimal total = reports.stream().map(Report::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
            result.put(city, new CityStats(reports.size(), total,
                total.divide(BigDecimal.valueOf(reports.size()), 2, RoundingMode.HALF_UP)));
        });
        return Collections.unmodifiableMap(result);` },
      { signature: 'List<Report> ranked(List<Report> events)', body: `        return latest(events).stream().sorted(Comparator.comparing(Report::amount).reversed()
            .thenComparingLong(Report::propertyId)).toList();` },
      { signature: 'List<Report> top(List<Report> events, int limit)', body: `        if (limit < 1 || limit > 100) throw new IllegalArgumentException("Invalid limit");
        return ranked(events).stream().limit(limit).toList();` },
      { signature: 'List<Report> page(List<Report> events, int page, int size)', body: `        if (page < 0 || size < 1 || size > 100) throw new IllegalArgumentException("Invalid pagination");
        return ranked(events).stream().skip((long) page * size).limit(size).toList();` }
    ],
    checks: `        Feature analytics = new Feature(); Instant time = Instant.parse("2026-01-01T00:00:00Z");
        Report older = new Report(1, 10, "Chicago", new BigDecimal("100"), time, true);
        Report newer = new Report(2, 10, " CHICAGO ", new BigDecimal("300"), time.plusSeconds(1), true);
        Report tied = new Report(3, 20, "chicago", new BigDecimal("300"), time.plusSeconds(1), true);
        Report pending = new Report(4, 10, "Chicago", new BigDecimal("999"), time.plusSeconds(9), false);
        List<Report> input = new ArrayList<>(List.of(older, newer, tied, pending, newer));
        check(analytics.latest(input).equals(List.of(newer, tied)), "Latest selection failed");
        CityStats stats = analytics.summarize(input).get("chicago");
        check(stats.count() == 2 && stats.total().compareTo(new BigDecimal("600")) == 0
            && stats.average().equals(new BigDecimal("300.00")), "Wrong city statistics");
        check(analytics.top(input, 1).equals(List.of(newer)), "Ranking tie-break failed");
        check(analytics.page(input, 1, 1).equals(List.of(tied)), "Pagination failed");
        check(analytics.page(input, Integer.MAX_VALUE, 100).isEmpty(), "Overflowing offset");
        check(analytics.summarize(List.of()).isEmpty(), "Empty input fabricated a city");
        reject(UnsupportedOperationException.class, () -> analytics.summarize(input).clear());
        reject(IllegalArgumentException.class, () -> analytics.top(input, 0));
        reject(IllegalArgumentException.class, () -> analytics.unique(List.of(newer,
            new Report(2, 10, "Chicago", BigDecimal.ONE, time, true))));
        check(input.size() == 5, "Input changed");`,
    hints: ['Resolve duplicate identity before grouping reports by property.', 'Use a merge function with a timestamp-and-ID comparator for latest selection.', 'Aggregate only the selected reports; otherwise older values inflate totals.', 'Apply stable ranking before skip and limit, and use long page arithmetic.'],
    explanation: ['The order of transformations matters: deduplication, latest selection, aggregation, and pagination solve different problems.', 'A merge function makes duplicate-key behavior explicit instead of silently dropping reports.', 'BigDecimal reduction avoids binary floating-point drift; dividing once produces a defined average.'],
    notes: 'Add equal-timestamp version tests, multiple cities, incomplete-only input, malformed reports, and fractional averages. Discuss why parallelizing a stateful HashSet filter would be unsafe and why database analytics may be preferable at scale.'
  }),
  javaFeature({
    topic: 4, title: 'Build a resilient property CSV import with a rejection report',
    statement: 'A listing partner uploads a UTF-8 CSV file. Build an importer that accepts valid properties, records row-specific validation failures without exposing raw rows, detects duplicate IDs, and propagates actual I/O failures. Implement the file wrapper as well as the parsing workflow.',
    requirements: [
      'Require the exact header id,city,price. The exercise format has three comma-separated unquoted fields; quoted commas are outside its scope.',
      'Parse positive long IDs, nonblank trimmed cities, and nonnegative BigDecimal prices. Record the physical line number for malformed rows.',
      'Skip blank data lines. Keep the first accepted property for an ID and reject later duplicate rows without replacing it.',
      'Continue after validation errors and return immutable accepted/rejected lists. Rejection messages contain row number and reason, not the raw row.',
      'The Reader/Writer method does not close caller-owned resources. The Path method opens UTF-8 resources with try-with-resources and rejects identical input/output paths.',
      'Propagate IOException instead of disguising it as bad input. A rejection-writer failure aborts processing; file output is not an atomic transaction.'
    ],
    model: `    record Property(long id, String city, BigDecimal price) {}
    record Issue(int row, String reason) {}
    record ImportResult(List<Property> accepted, List<Issue> rejected) {}
    static final class RowFailure extends Exception {
        RowFailure(String reason) { super(reason); }
        RowFailure(String reason, Throwable cause) { super(reason, cause); }
    }`,
    methods: [
      { signature: 'Property parse(String line) throws RowFailure', body: `        String[] fields = line.split(",", -1);
        if (fields.length != 3) throw new RowFailure("expected three fields");
        try {
            long id = Long.parseLong(fields[0].strip());
            String city = fields[1].strip();
            BigDecimal price = new BigDecimal(fields[2].strip());
            if (id <= 0 || city.isBlank() || price.signum() < 0) throw new RowFailure("invalid property values");
            return new Property(id, city, price);
        } catch (NumberFormatException failure) { throw new RowFailure("invalid number", failure); }` },
      { signature: 'void rejectRow(Writer writer, Issue issue) throws IOException', body: '        writer.write("row=" + issue.row() + ": " + issue.reason() + "\\n");' },
      { signature: 'ImportResult read(Reader input, Writer rejectionOutput) throws IOException', body: `        if (input == null || rejectionOutput == null) throw new IllegalArgumentException("Missing resource");
        BufferedReader reader = input instanceof BufferedReader buffered ? buffered : new BufferedReader(input);
        if (!"id,city,price".equals(reader.readLine())) throw new IllegalArgumentException("Invalid header");
        Map<Long, Property> accepted = new LinkedHashMap<>(); List<Issue> issues = new ArrayList<>();
        int row = 1; String line;
        while ((line = reader.readLine()) != null) {
            row++;
            if (line.isBlank()) continue;
            try {
                Property property = parse(line);
                if (accepted.containsKey(property.id())) throw new RowFailure("duplicate property ID");
                accepted.put(property.id(), property);
            } catch (RowFailure failure) {
                Issue issue = new Issue(row, failure.getMessage());
                rejectRow(rejectionOutput, issue); issues.add(issue);
            }
        }
        rejectionOutput.flush();
        return new ImportResult(List.copyOf(accepted.values()), List.copyOf(issues));` },
      { signature: 'ImportResult importFile(Path input, Path rejected) throws IOException', body: `        if (input == null || rejected == null || input.toAbsolutePath().normalize().equals(rejected.toAbsolutePath().normalize()))
            throw new IllegalArgumentException("Distinct file paths required");
        if (Files.exists(rejected) && Files.isSameFile(input, rejected)) throw new IllegalArgumentException("Same file");
        try (Reader reader = Files.newBufferedReader(input, StandardCharsets.UTF_8);
             Writer writer = Files.newBufferedWriter(rejected, StandardCharsets.UTF_8)) {
            return read(reader, writer);
        }` }
    ],
    checks: `        Feature importer = new Feature();
        String csv = "id,city,price\\n1, Chicago ,250000.50\\n2,Austin,bad\\n1,Boston,10\\n\\n3,Austin,0\\n";
        StringReader reader = new StringReader(csv); StringWriter rejected = new StringWriter();
        ImportResult result = importer.read(reader, rejected);
        check(result.accepted().size() == 2 && result.rejected().size() == 2, "Wrong import counts");
        check(result.rejected().get(0).row() == 3 && result.rejected().get(1).row() == 4, "Wrong physical rows");
        check(result.accepted().get(0).city().equals("Chicago"), "City not trimmed");
        check(!rejected.toString().contains("Austin,bad") && rejected.toString().contains("row=3"), "Raw row exposed");
        reader.read(); // Caller resource must still be open.
        reject(UnsupportedOperationException.class, () -> result.accepted().clear());
        reject(IllegalArgumentException.class, () -> importer.read(new StringReader("wrong\\n"), new StringWriter()));
        Writer broken = new Writer() {
            public void write(char[] data, int offset, int length) throws IOException { throw new IOException("disk full"); }
            public void flush() {} public void close() {}
        };
        reject(IOException.class, () -> importer.read(new StringReader("id,city,price\\nbad\\n"), broken));
        Path directory = Files.createTempDirectory("reidy-import-");
        Path source = directory.resolve("input.csv"), output = directory.resolve("rejected.txt");
        try {
            Files.writeString(source, csv, StandardCharsets.UTF_8);
            check(importer.importFile(source, output).accepted().size() == 2, "File import failed");
            reject(IllegalArgumentException.class, () -> importer.importFile(source, source));
        } finally { Files.deleteIfExists(source); Files.deleteIfExists(output); Files.deleteIfExists(directory); }`,
    hints: ['Separate row-validation failures from infrastructure exceptions.', 'Use split with a negative limit so missing trailing values remain visible.', 'Track physical row numbers and accepted IDs independently.', 'Only the method that opens a resource should close it.'],
    explanation: ['Recoverable row errors belong in the rejection report; an I/O error means the importer cannot promise a complete result.', 'Defensive result lists prevent later mutation from changing the import summary.', 'Normalizing paths and checking existing aliases avoids accidentally truncating the source in this exercise; concurrent filesystem changes require a stronger upload workflow.'],
    notes: 'Add missing-column, blank-city, negative-price, null-resource, header-only, and read-failure cases. The file wrapper writes directly to the rejection file; use temporary files plus an atomic move if all-or-nothing output publication is required.'
  }),
  javaFeature({
    topic: 5, title: 'Build a clock-driven rental estimate cache lifecycle',
    statement: 'Rental estimates expire according to elapsed time, even around daylight-saving transitions. Build an injectable-clock cache that creates deadlines, reports remaining TTL, expires entries, and presents deadlines in a requested zone without using sleep in tests.',
    requirements: [
      'Use Key(propertyId, type) so rental estimate types never collide. Require a positive ID and nonblank canonical type.',
      'Store a nonnegative estimate with a nonnegative TTL. Zero TTL expires immediately. Capture one clock instant per operation.',
      'An entry is fresh only when createdAt <= now < expiresAt. Remove expired entries on lookup; a backwards clock must not make a future-created entry fresh.',
      'Return zero remaining TTL for missing, expired, or future-created entries. Do not return a negative duration.',
      'Support explicit invalidation and bulk expiry cleanup. Return the number actually removed by cleanup.',
      'Convert stored expiry instants to a caller-supplied ZoneId for display. Keep arithmetic on Instant and Duration, not local wall-clock time.'
    ],
    model: `    record Key(long propertyId, String type) {}
    record Estimate(BigDecimal amount, Instant createdAt, Instant expiresAt) {}
    static final class MutableClock extends Clock {
        Instant now; MutableClock(Instant now) { this.now = now; }
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return Clock.fixed(now, zone); }
        public Instant instant() { return now; }
    }`,
    members: `        private final Clock clock;
        private final Map<Key, Estimate> entries = new HashMap<>();
        Feature(Clock clock) { this.clock = Objects.requireNonNull(clock); }`,
    methods: [
      { signature: 'void validate(Key key)', body: `        if (key == null || key.propertyId() <= 0 || key.type() == null || key.type().isBlank()
            || !key.type().equals(key.type().strip().toUpperCase(Locale.ROOT)))
            throw new IllegalArgumentException("Invalid canonical key");` },
      { signature: 'void put(Key key, BigDecimal amount, Duration ttl)', body: `        validate(key);
        if (amount == null || amount.signum() < 0 || ttl == null || ttl.isNegative())
            throw new IllegalArgumentException("Invalid estimate");
        Instant now = clock.instant(); Instant expires = now.plus(ttl);
        entries.put(key, new Estimate(amount, now, expires));` },
      { signature: 'Optional<Estimate> fresh(Key key)', body: `        validate(key); Instant now = clock.instant(); Estimate entry = entries.get(key);
        if (entry == null) return Optional.empty();
        if (now.isBefore(entry.createdAt())) return Optional.empty();
        if (!now.isBefore(entry.expiresAt())) { entries.remove(key); return Optional.empty(); }
        return Optional.of(entry);` },
      { signature: 'Duration remaining(Key key)', body: `        validate(key); Instant now = clock.instant(); Estimate entry = entries.get(key);
        if (entry == null || now.isBefore(entry.createdAt()) || !now.isBefore(entry.expiresAt())) return Duration.ZERO;
        return Duration.between(now, entry.expiresAt());` },
      { signature: 'int purgeExpired()', body: `        Instant now = clock.instant(); int before = entries.size();
        entries.values().removeIf(entry -> !now.isBefore(entry.expiresAt()));
        return before - entries.size();` },
      { signature: 'boolean invalidate(Key key)', body: '        validate(key); return entries.remove(key) != null;' },
      { signature: 'Optional<ZonedDateTime> expiresIn(Key key, ZoneId zone)', body: `        Objects.requireNonNull(zone); return fresh(key).map(entry -> entry.expiresAt().atZone(zone));` }
    ],
    checks: `        Instant start = Instant.parse("2026-11-01T06:59:00Z"); MutableClock clock = new MutableClock(start);
        Feature cache = new Feature(clock); Key key = new Key(1, "RENTAL_ESTIMATE");
        cache.put(key, new BigDecimal("2000"), Duration.ofMinutes(2));
        check(cache.remaining(key).equals(Duration.ofMinutes(2)), "Wrong initial TTL");
        ZonedDateTime displayed = cache.expiresIn(key, ZoneId.of("America/Chicago")).orElseThrow();
        check(displayed.getHour() == 1 && displayed.getMinute() == 1 && displayed.getOffset().equals(ZoneOffset.ofHours(-6)), "DST conversion failed");
        clock.now = start.minusSeconds(1); check(cache.fresh(key).isEmpty(), "Future-created entry was fresh");
        clock.now = start.plusSeconds(119); check(cache.fresh(key).isPresent(), "Expired early");
        clock.now = start.plusSeconds(120); check(cache.remaining(key).isZero() && cache.fresh(key).isEmpty(), "Expiry boundary failed");
        cache.put(key, BigDecimal.ZERO, Duration.ZERO); check(cache.purgeExpired() == 1, "Zero TTL retained");
        Key other = new Key(1, "MARKET_RENT"); cache.put(other, BigDecimal.ONE, Duration.ofSeconds(10));
        check(cache.fresh(key).isEmpty() && cache.fresh(other).isPresent(), "Types collided");
        check(cache.invalidate(other) && !cache.invalidate(other), "Invalidation count failed");
        reject(IllegalArgumentException.class, () -> cache.put(key, BigDecimal.ONE, Duration.ofSeconds(-1)));
        reject(IllegalArgumentException.class, () -> cache.fresh(new Key(1, " rental ")));`,
    hints: ['Inject Clock so tests control time directly.', 'Compute expiry from an Instant and compare with an exclusive upper bound.', 'Treat the same property with two rental types as two cache entries.', 'Convert to ZonedDateTime only when formatting a deadline for a person.'],
    explanation: ['A DST overlap changes the displayed wall time, not the elapsed duration between two instants.', 'One captured now per operation avoids inconsistent boundary decisions if time advances between comparisons.', 'A backwards clock is handled conservatively. This example does not replace distributed cache expiry or solve clock synchronization across services.'],
    notes: 'Add multiple-entry purge, expiry overflow, null keys, invalid amounts, and overwrite tests. Entries created in the future are hidden but not purged until their deadline; document that policy when discussing clock skew.'
  })
];
