// Contract checks injected into each standalone reference program during QA.
export const edgeCases = {
  1: `check(invoiceTotal(List.of()).toPlainString().equals("0.00"));
      check(invoiceTotal(List.of("0.005", "0.005")).toPlainString().equals("0.01"));
      expect(IllegalArgumentException.class, () -> invoiceTotal(List.of("-1")));
      expect(NumberFormatException.class, () -> invoiceTotal(List.of("oops")));`,
  2: `check(totalBytes(0, Long.MAX_VALUE) == 0);
      expect(ArithmeticException.class, () -> totalBytes(Long.MAX_VALUE, 2));
      expect(IllegalArgumentException.class, () -> totalBytes(-1, 0));`,
  3: `var mutable = new HashMap<String, List<String>>();
      var values = new ArrayList<>(List.of("east")); mutable.put("api", values);
      var frozen = snapshot(mutable); mutable.clear(); values.add("west");
      check(frozen.routes().get("api").equals(List.of("east")));
      expect(UnsupportedOperationException.class, () -> frozen.routes().put("new", List.of()));
      expect(UnsupportedOperationException.class, () -> frozen.routes().get("api").add("west"));
      var nulls = new HashMap<String, List<String>>(); nulls.put("bad", null);
      expect(NullPointerException.class, () -> snapshot(nulls));`,
  4: `check(quote(new BigDecimal("12.00"), amount -> amount).equals(new BigDecimal("12.00")));
      expect(IllegalArgumentException.class, () -> quote(BigDecimal.ONE, amount -> BigDecimal.TEN));
      expect(IllegalArgumentException.class, () -> quote(BigDecimal.ONE, amount -> new BigDecimal("-1")));
      expect(IllegalArgumentException.class, () -> quote(new BigDecimal("-1"), amount -> amount));`,
  5: `check(latestById(List.of()).isEmpty());
      var versioned = List.of(new Customer(1, 2, "new"), new Customer(1, 1, "old"), new Customer(1, 1, "old"));
      check(latestById(versioned).get(1L).name().equals("new"));
      expect(IllegalArgumentException.class, () -> latestById(List.of(new Customer(1, 2, "new"), new Customer(1, 1, "a"), new Customer(1, 1, "b"))));
      expect(IllegalArgumentException.class, () -> latestById(List.of(new Customer(1, -1, "bad"))));`,
  6: `var indexed = headerIndex(List.of(new Header(" X-ID ", "1"), new Header("x-id", "2")));
      check(indexed.get("x-id").equals(List.of("1", "2")));
      expect(UnsupportedOperationException.class, () -> indexed.get("x-id").add("3"));
      expect(UnsupportedOperationException.class, () -> indexed.clear());
      expect(IllegalArgumentException.class, () -> headerIndex(List.of(new Header("\\u2003", "x"))));
      expect(NullPointerException.class, () -> headerIndex(List.of(new Header("x", null))));`,
  7: `expect(IllegalArgumentException.class, () -> newCache(0));
      Map<String, Integer> updated = newCache(2);
      updated.put("a", 1); updated.put("b", 2); updated.put("a", 3); updated.put("c", 4);
      check(updated.size() == 2 && !updated.containsKey("b") && updated.get("a") == 3);
      Map<String, Integer> one = newCache(1); one.put("a", 1); one.put("b", 2); check(one.keySet().equals(Set.of("b")));`,
  8: `var original = new ArrayList<>(List.of(new Customer(3, null), new Customer(2, "a"), new Customer(1, "A")));
      check(sortedCustomers(original).stream().map(Customer::id).toList().equals(List.of(1L, 2L, 3L)));
      check(original.get(0).id() == 3);
      check(sortedCustomers(List.of()).isEmpty());`,
  9: `check(totalsByCustomer(List.of()).isEmpty());
      check(totalsByCustomer(List.of(new Order("A", "CANCELLED", 9))).isEmpty());
      check(totalsByCustomer(List.of(new Order("A", "PAID", 2), new Order("A", "PAID", 3))).get("A") == 5);`,
  10: `var previousLocale = Locale.getDefault();
      try { Locale.setDefault(Locale.forLanguageTag("tr-TR"));
          check(duplicateEmails(List.of(" I@EXAMPLE.COM ", "i@example.com", "\\u2003", "")).equals(Map.of("i@example.com", 2L)));
      } finally { Locale.setDefault(previousLocale); }
      check(duplicateEmails(List.of("a@example.com")).isEmpty());`,
  11: `check(balances(List.of(new Entry("a", new BigDecimal("1.00")), new Entry("a", new BigDecimal("-1.0")))).isEmpty());
      check(balances(List.of(new Entry("a", new BigDecimal("-1.25")))).get("a").compareTo(new BigDecimal("-1.25")) == 0);`,
  12: `check(quantities(List.of(new Shipment(true, List.of(new Line("A", -1))))).isEmpty());
      expect(IllegalArgumentException.class, () -> quantities(List.of(new Shipment(false, List.of(new Line("A", 0))))));
      expect(ArithmeticException.class, () -> quantities(List.of(new Shipment(false, List.of(new Line("A", Long.MAX_VALUE), new Line("A", 1))))));`,
  13: `Path invalidFile = Files.createTempFile("invalid-settings", ".txt");
      try {
          Files.write(invalidFile, List.of("a=1", "a=2"));
          try { load(invalidFile); throw new AssertionError("Duplicate accepted"); }
          catch (IllegalArgumentException failure) { check(failure.getMessage().contains("2")); }
          Files.write(invalidFile, List.of("# comment", " =value"));
          expect(IllegalArgumentException.class, () -> load(invalidFile));
          Files.write(invalidFile, List.of("bad")); expect(IllegalArgumentException.class, () -> load(invalidFile));
          Files.write(invalidFile, List.of("empty=", "token=a=b"));
          check(load(invalidFile).equals(Map.of("empty", "", "token", "a=b")));
      } finally { Files.deleteIfExists(invalidFile); }
      expect(IOException.class, () -> load(invalidFile));`,
  14: `Path atomicDirectory = Files.createTempDirectory("atomic-edge");
      Path report = atomicDirectory.resolve("report.txt");
      try {
          publish(report, "one"); publish(report, "two");
          check(Files.readString(report).equals("two"));
          try (var files = Files.list(atomicDirectory)) { check(files.count() == 1); }
          expect(IOException.class, () -> publish(atomicDirectory.resolve("missing").resolve("report"), "bad"));
      } finally { Files.deleteIfExists(report); Files.deleteIfExists(atomicDirectory); }`,
  15: `ZoneId newYork = ZoneId.of("America/New_York");
      expect(IllegalArgumentException.class, () -> resolve(LocalDateTime.parse("2025-03-09T02:30"), newYork));
      expect(IllegalArgumentException.class, () -> resolve(LocalDateTime.parse("2025-11-02T01:30"), newYork));
      check(resolve(LocalDateTime.parse("2025-01-01T00:00"), ZoneOffset.UTC).equals(Instant.parse("2025-01-01T00:00:00Z")));`,
  16: `AtomicInteger available = new AtomicInteger(100);
      ExecutorService workers = Executors.newFixedThreadPool(16);
      try {
          List<Future<Boolean>> attempts = new ArrayList<>();
          for (int n = 0; n < 1000; n++) attempts.add(workers.submit(() -> reserve(available, 1)));
          int success = 0; for (var attempt : attempts) if (attempt.get(3, TimeUnit.SECONDS)) success++;
          check(success == 100 && available.get() == 0);
      } finally { workers.shutdownNow(); }
      expect(IllegalArgumentException.class, () -> reserve(available, 0));`,
  17: `var concurrentFlights = new ConcurrentHashMap<String, CompletableFuture<String>>();
      var started = new CountDownLatch(1); var release = new CountDownLatch(1); var calls = new AtomicInteger();
      ExecutorService loaderThread = Executors.newSingleThreadExecutor();
      try {
          Future<CompletableFuture<String>> first = loaderThread.submit(() -> loadOnce(concurrentFlights, "x", () -> {
              calls.incrementAndGet(); started.countDown();
              try { if (!release.await(3, TimeUnit.SECONDS)) throw new AssertionError("Loader gate timeout"); }
              catch (InterruptedException failure) { Thread.currentThread().interrupt(); throw new RuntimeException(failure); }
              return "shared";
          }));
          check(started.await(3, TimeUnit.SECONDS));
          var second = loadOnce(concurrentFlights, "x", () -> { throw new AssertionError("Duplicate loader"); });
          release.countDown();
          check(first.get(3, TimeUnit.SECONDS) == second && second.join().equals("shared") && calls.get() == 1);
          check(concurrentFlights.isEmpty());
          check(loadOnce(concurrentFlights, "x", () -> "fresh").join().equals("fresh"));
          var originalFailure = new IllegalStateException("loader failed");
          var failed = loadOnce(concurrentFlights, "x", () -> { throw originalFailure; });
          try { failed.join(); throw new AssertionError("Failure hidden"); }
          catch (CompletionException failure) { check(failure.getCause() == originalFailure); }
          check(concurrentFlights.isEmpty());
      } finally { release.countDown(); loaderThread.shutdownNow(); }`,
  18: `ExecutorService lookups = Executors.newFixedThreadPool(2);
      CountDownLatch blocked = new CountDownLatch(1);
      try {
          CountDownLatch both = new CountDownLatch(2);
          java.util.function.Supplier<String> parallelLookup = () -> {
              both.countDown();
              try { if (!both.await(2, TimeUnit.SECONDS)) throw new AssertionError("Not concurrent"); }
              catch (InterruptedException failure) { throw new RuntimeException(failure); }
              return "ok";
          };
          check(summary(parallelLookup, parallelLookup, lookups).get(3, TimeUnit.SECONDS).equals("ok:ok"));
          var originalFailure = new IllegalStateException("lookup failed");
          try { summary(() -> { throw originalFailure; }, () -> "ok", lookups).join(); throw new AssertionError("Failure hidden"); }
          catch (CompletionException failure) { check(failure.getCause() == originalFailure); }
          var timed = summary(() -> {
              try { blocked.await(); } catch (InterruptedException failure) { throw new RuntimeException(failure); }
              return "late";
          }, () -> "ok", lookups);
          try { timed.get(3, TimeUnit.SECONDS); throw new AssertionError("Missing timeout"); }
          catch (ExecutionException failure) { check(failure.getCause() instanceof TimeoutException); }
          check(!lookups.isShutdown());
      } finally { blocked.countDown(); lookups.shutdownNow(); }`,
  19: `withTenant("A", () -> {
          check(TENANT.get().equals("A"));
          expect(IllegalStateException.class, () -> withTenant("B", () -> { throw new IllegalStateException(); }));
          check(TENANT.get().equals("A")); return null;
      });
      check(TENANT.get() == null);
      expect(NullPointerException.class, () -> withTenant(null, () -> "bad"));`,
  20: `var deliveries = new AtomicInteger();
      java.util.function.Consumer<String> listener = event -> deliveries.incrementAndGet();
      var firstRegistration = subscribe(listener); var secondRegistration = subscribe(listener);
      LISTENERS.forEach(callback -> callback.accept("one")); check(deliveries.get() == 2);
      firstRegistration.close(); firstRegistration.close();
      LISTENERS.forEach(callback -> callback.accept("two")); check(deliveries.get() == 3);
      secondRegistration.close(); check(LISTENERS.isEmpty());`,
  21: `AtomicInteger active = new AtomicInteger(); AtomicInteger peak = new AtomicInteger();
      CountDownLatch firstWave = new CountDownLatch(3); List<Callable<Integer>> bounded = new ArrayList<>();
      for (int n = 0; n < 20; n++) { final int value = n; bounded.add(() -> {
          check(Thread.currentThread().isVirtual());
          int running = active.incrementAndGet(); peak.accumulateAndGet(running, Math::max);
          try { firstWave.countDown(); check(firstWave.await(3, TimeUnit.SECONDS)); return value; }
          finally { active.decrementAndGet(); }
      }); }
      check(fetchAll(bounded, 3).equals(IntStream.range(0, 20).boxed().toList()));
      check(peak.get() == 3 && active.get() == 0);
      expect(IllegalArgumentException.class, () -> fetchAll(List.of(), 0));
      expect(ExecutionException.class, () -> fetchAll(List.of(() -> { throw new IllegalStateException(); }, () -> "ok"), 1));`,
  22: `check(missingFields(new Form("Ada", "ada@example.com")).isEmpty());
      check(missingFields(new Form("", null)).equals(List.of("email", "name")));`,
  23: `if (Boolean.getBoolean("java.practice.h2")) {
          try (Connection database = DriverManager.getConnection("jdbc:h2:mem:lookup")) {
              try (Statement statement = database.createStatement()) {
                  statement.execute("create table customers(id bigint primary key, email varchar not null)");
                  statement.execute("insert into customers values(1, 'ada@example.com')");
              }
              check(findEmail(database, 1).orElseThrow().equals("ada@example.com"));
              check(findEmail(database, 9).isEmpty()); check(!database.isClosed());
          }
      }`,
  24: `if (Boolean.getBoolean("java.practice.h2")) {
          try (Connection database = DriverManager.getConnection("jdbc:h2:mem:transfer")) {
              try (Statement statement = database.createStatement()) {
                  statement.execute("create table accounts(id bigint primary key, cents bigint not null)");
                  statement.execute("insert into accounts values(1,1000),(2,200)");
              }
              transfer(database, 1, 2, 300);
              check(scalar(database, "select cents from accounts where id=1") == 700);
              check(scalar(database, "select cents from accounts where id=2") == 500);
              expect(SQLException.class, () -> transfer(database, 1, 9, 100));
              check(scalar(database, "select cents from accounts where id=1") == 700);
              expect(SQLException.class, () -> transfer(database, 1, 2, 900));
              expect(IllegalArgumentException.class, () -> transfer(database, 1, 1, 1));
              expect(IllegalArgumentException.class, () -> transfer(database, 1, 2, 0));
              check(database.getAutoCommit() && !database.isClosed());
              check(scalar(database, "select sum(cents) from accounts") == 1200);
          }
      }`,
};

export const assertions = `
    interface Throwing { void run() throws Exception; }
    static void check(boolean value) { if (!value) throw new AssertionError("Contract violated"); }
    static void expect(Class<? extends Throwable> type, Throwing work) throws Exception {
        try { work.run(); }
        catch (Throwable failure) {
            if (type.isInstance(failure)) return;
            throw new AssertionError("Expected " + type.getName() + ", got " + failure, failure);
        }
        throw new AssertionError("Expected " + type.getName());
    }
    static long scalar(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement(); ResultSet rows = statement.executeQuery(sql)) {
            if (!rows.next()) throw new AssertionError("Missing row");
            return rows.getLong(1);
        }
    }
`;
