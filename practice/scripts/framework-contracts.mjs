// Unit checks for real reference code, without contacting external services.
export function frameworkContract(question) {
  const cases = {
    25: 'new ExpiryTest().checksDeadlineBoundary();',
    26: 'new RetryingTest().succeedsOnThirdAttempt(); new RetryingTest().rethrowsLastFailure();',
    27: `var sent = new java.util.ArrayList<String>();
      Channel email = new Channel() { public String name() { return "email"; } public void send(String value) { sent.add(value); } };
      var router = new NotificationRouter(java.util.List.of(email)); router.send("email", "hello");
      check(sent.equals(java.util.List.of("hello")));
      expect(IllegalArgumentException.class, () -> router.send("unknown", "x"));
      expect(IllegalArgumentException.class, () -> new NotificationRouter(java.util.List.of(email, email)));`,
    28: `var controller = new CustomerController((name, email) -> new CustomerDto(42, name, email));
      var response = controller.create(new CreateCustomer("Ada", "ada@example.com"));
      check(response.getStatusCode().value() == 201);
      check(response.getHeaders().getLocation().toString().equals("/customers/42"));
      check(response.getBody().name().equals("Ada"));`,
    30: `String quote = String.valueOf((char)34);
      var controller = new DocumentController((id, version, text) -> new DocumentDto(id, version + 1, text));
      var response = controller.replace(1, quote + "7" + quote, new ReplaceDocument("new"));
      check(response.getStatusCode().value() == 200 && response.getHeaders().getETag().equals(quote + "8" + quote));
      for (String invalid : java.util.List.of("7", "W/" + quote + "7" + quote, "*", quote + "-1" + quote, quote + "7" + quote + "," + quote + "8" + quote, quote + "99999999999999999999999" + quote)) {
          try { controller.replace(1, invalid, new ReplaceDocument("bad")); throw new AssertionError("Invalid ETag accepted"); }
          catch (org.springframework.web.server.ResponseStatusException failure) { check(failure.getStatusCode().value() == 400); }
      }
      try { controller.replace(1, null, new ReplaceDocument("bad")); throw new AssertionError("Missing ETag accepted"); }
      catch (org.springframework.web.server.ResponseStatusException failure) { check(failure.getStatusCode().value() == 428); }
      var stale = new DocumentController((id, version, text) -> { throw new VersionMismatch(); });
      try { stale.replace(1, quote + "7" + quote, new ReplaceDocument("bad")); throw new AssertionError("Stale accepted"); }
      catch (org.springframework.web.server.ResponseStatusException failure) { check(failure.getStatusCode().value() == 412); }`,
    38: `var original = new IllegalStateException("debit"); var auditFailure = new IllegalStateException("audit");
      var writer = new AuditWriter((id, reason) -> { throw auditFailure; });
      var withdrawal = new Withdrawal((id, cents) -> { throw original; }, writer);
      try { withdrawal.withdraw(1, 100); throw new AssertionError("Failure swallowed"); }
      catch (IllegalStateException failure) { check(failure == original && failure.getSuppressed()[0] == auditFailure); }
      check(AuditWriter.class.getDeclaredMethod("record", long.class).getAnnotation(org.springframework.transaction.annotation.Transactional.class).propagation() == org.springframework.transaction.annotation.Propagation.REQUIRES_NEW);`,
    40: `var reader = new DocumentReader((tenant, id) -> tenant.equals("A") ? java.util.Optional.of(new DocumentDto(id, "owned")) : java.util.Optional.empty());
      var context = org.springframework.security.core.context.SecurityContextHolder.getContext();
      try {
          expect(org.springframework.security.access.AccessDeniedException.class, () -> reader.read(1));
          var jwt = org.springframework.security.oauth2.jwt.Jwt.withTokenValue("test").header("alg", "RS256").claim("tenant_id", "A").build();
          context.setAuthentication(new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(jwt, "n/a", java.util.List.of()));
          check(reader.read(1).text().equals("owned"));
          var missing = org.springframework.security.oauth2.jwt.Jwt.withTokenValue("test").header("alg", "RS256").claim("sub", "Ada").build();
          context.setAuthentication(new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(missing, "n/a", java.util.List.of()));
          expect(org.springframework.security.access.AccessDeniedException.class, () -> reader.read(1));
      } finally { org.springframework.security.core.context.SecurityContextHolder.clearContext(); }`,
    41: `var manager = new org.springframework.cache.concurrent.ConcurrentMapCacheManager("products");
      manager.getCache("products").put(1L, "one"); manager.getCache("products").put(2L, "two");
      new CatalogCacheInvalidator(manager).changed(new ProductChanged(1));
      check(manager.getCache("products").get(1L) == null && manager.getCache("products").get(2L) != null);
      check(CatalogCacheInvalidator.class.getDeclaredMethod("changed", ProductChanged.class).getAnnotation(org.springframework.transaction.event.TransactionalEventListener.class).phase() == org.springframework.transaction.event.TransactionPhase.AFTER_COMMIT);`,
    44: `var executor = new AsyncConfiguration().reportExecutor(); executor.initialize();
      var started = new java.util.concurrent.CountDownLatch(2); var release = new java.util.concurrent.CountDownLatch(1);
      Runnable blocked = () -> { started.countDown(); try { release.await(); } catch (InterruptedException ex) { Thread.currentThread().interrupt(); } };
      try {
          executor.execute(blocked); executor.execute(blocked); check(started.await(3, java.util.concurrent.TimeUnit.SECONDS));
          for (int i = 0; i < 10; i++) executor.execute(blocked);
          expect(org.springframework.core.task.TaskRejectedException.class, () -> executor.execute(blocked));
          check(executor.getPoolSize() == 2 && executor.getQueueSize() == 10);
      } finally { release.countDown(); executor.shutdown(); }`,
    45: `var calls = new java.util.concurrent.atomic.AtomicInteger();
      var client = org.springframework.web.reactive.function.client.WebClient.builder()
          .clientConnector(new org.springframework.http.client.reactive.JdkClientHttpConnector())
          .exchangeFunction(request -> reactor.core.publisher.Mono.just(org.springframework.web.reactive.function.client.ClientResponse
              .create(calls.incrementAndGet() < 3 ? org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE : org.springframework.http.HttpStatus.OK).body("available").build())).build();
      check(new InventoryClient(client).load(1).block(java.time.Duration.ofSeconds(3)).equals("available")); check(calls.get() == 3);
      var badCalls = new java.util.concurrent.atomic.AtomicInteger();
      var missing = org.springframework.web.reactive.function.client.WebClient.builder()
          .clientConnector(new org.springframework.http.client.reactive.JdkClientHttpConnector())
          .exchangeFunction(request -> { badCalls.incrementAndGet(); return reactor.core.publisher.Mono.just(org.springframework.web.reactive.function.client.ClientResponse.create(org.springframework.http.HttpStatus.NOT_FOUND).build()); }).build();
      expect(org.springframework.web.reactive.function.client.WebClientResponseException.NotFound.class, () -> new InventoryClient(missing).load(1).block(java.time.Duration.ofSeconds(3)));
      check(badCalls.get() == 1);`,
    46: `var keys = new java.util.ArrayList<String>();
      var payments = new Payments((key, request) -> { keys.add(key); return new ChargeReceipt("receipt"); });
      var key = java.util.UUID.randomUUID(); payments.charge(key, 100); payments.charge(key, 100);
      check(keys.equals(java.util.List.of(key.toString(), key.toString())));
      expect(IllegalArgumentException.class, () -> payments.charge(key, 0));
      expect(NullPointerException.class, () -> payments.charge(null, 100));`,
    47: `var test = new CustomerValidationTest(); test.service = org.mockito.Mockito.mock(CustomerService.class);
      test.mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(new CustomerController(test.service)).build();
      test.rejectsBlankNameWithoutCallingService();`,
    49: `var registry = new io.micrometer.core.instrument.simple.SimpleMeterRegistry();
      check(new MeasuredCheckout(registry, () -> "ok").place().equals("ok"));
      var original = new IllegalStateException("failed");
      try { new MeasuredCheckout(registry, () -> { throw original; }).place(); throw new AssertionError("Failure hidden"); }
      catch (IllegalStateException failure) { check(failure == original); }
      check(registry.get("checkout.duration").timer().count() == 2); registry.close();`,
    50: `var registry = new io.micrometer.core.instrument.simple.SimpleMeterRegistry(); var metrics = new ApiMetrics(registry);
      for (int i = 0; i < 1000; i++) metrics.record("/orders/" + i, i);
      metrics.record("/orders/{id}", 404);
      check(registry.getMeters().size() == 12);
      check(registry.get("api.requests").tag("route", "/orders/{id}").tag("status", "4xx").counter().count() == 1); registry.close();`,
  };
  if (question.id === 39) {
    const validator = question.solution.match(/OAuth2TokenValidator<Jwt> audience = ([\s\S]*?);/)[0];
    cases[39] = `${validator}
      var missing = Jwt.withTokenValue("test").header("alg", "RS256").claim("sub", "Ada").build();
      check(audience.validate(missing).hasErrors());
      var valid = Jwt.withTokenValue("test").header("alg", "RS256").claim("aud", java.util.List.of("orders-api")).build();
      check(!audience.validate(valid).hasErrors());
      var wrong = Jwt.withTokenValue("test").header("alg", "RS256").claim("aud", java.util.List.of("other")).build();
      check(audience.validate(wrong).hasErrors());`;
  }
  if (!cases[question.id]) return null;
  return `
class Behavior {
    interface Throwing { void run() throws Exception; }
    static void check(boolean value) { if (!value) throw new AssertionError("Contract violated"); }
    static void expect(Class<? extends Throwable> type, Throwing work) throws Exception {
        try { work.run(); } catch (Throwable failure) {
            if (type.isInstance(failure)) return;
            throw new AssertionError("Unexpected failure", failure);
        }
        throw new AssertionError("Expected " + type.getName());
    }
    public static void main(String[] args) throws Exception { ${cases[question.id]} }
}`;
}
