import { projectFeature } from './project-feature-builder.js';

const apiImports = `import java.math.BigDecimal;
import java.net.URI;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;`;

const propertyApiTask = projectFeature({
  topic: 13, title: 'Build a validated property API with consistent errors',
  statement: 'Implement the HTTP boundary for creating, reading, searching, and repricing properties. Use DTO validation, explicit response contracts, bounded pagination, optimistic update intent, and safe error responses.',
  requirements: [
    'POST /api/properties validates nonblank city and positive price, trims city, and returns 201 with a resource Location and DTO.',
    'GET /api/properties/{id} rejects nonpositive IDs and returns 404 when the service finds no property.',
    'GET /api/properties accepts city, page, and size. Enforce page >= 0 and size 1–100 before calling the service.',
    'PUT /api/properties/{id}/price validates a nonnegative expectedVersion and a positive price. Pass both to the service rather than overwriting blindly.',
    'Translate a missing property to 404 and a version conflict to 409 using ProblemDetail. Do not expose exception messages or entities.',
    'Keep controller logic limited to HTTP validation and mapping. Authorization and database transactions remain separate service responsibilities.'
  ],
  imports: apiImports,
  model: `record CreateProperty(@NotBlank String city, @NotNull @Positive BigDecimal price) {}
record RepriceProperty(@Min(0) long expectedVersion, @NotNull @Positive BigDecimal price) {}
record PropertyDto(long id, String city, BigDecimal price, long version) {}
class PropertyConflict extends RuntimeException {}
interface PropertyOperations {
    PropertyDto create(String city, BigDecimal price);
    Optional<PropertyDto> find(long id);
    List<PropertyDto> search(String city, int page, int size);
    PropertyDto reprice(long id, long expectedVersion, BigDecimal price);
}`,
  units: [
    { owner: '@RestController\n@RequestMapping("/api/properties")\nclass PropertyController', members: '    private final PropertyOperations operations;\n    PropertyController(PropertyOperations operations) { this.operations = operations; }', methods: [
      { signature: 'private void id(long id)', body: '        if (id <= 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid ID");' },
      { signature: '@PostMapping\n    ResponseEntity<PropertyDto> create(@Valid @RequestBody CreateProperty request)', body: `        PropertyDto result = operations.create(request.city().strip(), request.price());
        return ResponseEntity.created(URI.create("/api/properties/" + result.id())).body(result);` },
      { signature: '@GetMapping("/{id}")\n    ResponseEntity<PropertyDto> find(@PathVariable long id)', body: '        id(id); return ResponseEntity.of(operations.find(id));' },
      { signature: '@GetMapping\n    List<PropertyDto> search(@RequestParam String city, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size)', body: `        if (city == null || city.isBlank() || page < 0 || size < 1 || size > 100)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid search");
        return List.copyOf(operations.search(city.strip(), page, size));` },
      { signature: '@PutMapping("/{id}/price")\n    PropertyDto reprice(@PathVariable long id, @Valid @RequestBody RepriceProperty request)', body: '        id(id); return operations.reprice(id, request.expectedVersion(), request.price());' }
    ] },
    { owner: '@RestControllerAdvice\nclass PropertyErrors', methods: [
      { signature: '@ExceptionHandler(PropertyConflict.class)\n    ResponseEntity<ProblemDetail> conflict()', body: `        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        problem.setTitle("Property changed"); problem.setDetail("Reload the property before retrying the update.");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);` },
      { signature: '@ExceptionHandler(NoSuchElementException.class)\n    ResponseEntity<ProblemDetail> missing()', body: `        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        problem.setTitle("Property not found");
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);` }
    ] }
  ],
  expected: 'Valid creation returns 201/Location. Invalid DTOs and pagination return 400 without service work. Missing resources return 404; stale update intent returns 409.',
  hints: ['Define request DTO constraints independently from response DTOs.', 'Validate path/query parameters before delegation.', 'Keep version conflict handling in one advice rather than duplicating try/catch in endpoints.', 'Use an expected version as intent, while letting the persistence layer enforce concurrency.'],
  explanation: ['DTOs make the public contract explicit and avoid exposing internal entity fields or lazy associations.', 'Validation annotations cover request bodies, while the exercise explicitly guards query and path values.', 'A precondition passed to the service is not by itself concurrency protection; the JPA task enforces version checks during persistence.'],
  notes: 'Setup: starter-web, starter-validation, and a PropertyOperations bean in an isolated exercise project. The service must apply ownership checks. Verify malformed JSON, missing fields, nonpositive IDs, city trimming, maximum page size, Location, and stable error bodies. Names are scaffold types; adapt them to the real project rather than replacing its full API.'
});

const jpaTask = projectFeature({
  topic: 14, title: 'Build transactional property search and optimistic repricing',
  statement: 'Implement a persistence service that searches in the database, maps DTOs inside a transaction, and reprices a listing only when the client version and database version still agree.',
  requirements: [
    'Search using a case-insensitive city, inclusive maximum price, deterministic ID order, and page size 1–100. Validate every input before querying.',
    'Map the returned entity page into ListingView DTOs without leaking managed entities to the API.',
    'find returns an Optional DTO within a read-only transaction.',
    'reprice loads the entity, checks the expected @Version value, applies a positive new price, and flushes before returning the new DTO.',
    'Translate Spring/JPA optimistic-lock failures into ListingConflict and let the transaction roll back. Do not automatically retry stale user intent.',
    'Integration-test equal-price search boundaries, pagination, missing rows, stale client versions, and two concurrent edits.'
  ],
  imports: 'import java.math.BigDecimal;\nimport java.util.*;\nimport jakarta.persistence.*;\nimport org.springframework.data.domain.*;\nimport org.springframework.data.jpa.repository.JpaRepository;\nimport org.springframework.data.jpa.repository.Query;\nimport org.springframework.data.repository.query.Param;\nimport org.springframework.dao.OptimisticLockingFailureException;\nimport org.springframework.stereotype.Service;\nimport org.springframework.transaction.annotation.Transactional;',
  model: `@Entity class ListingEntity {
    @Id Long id;
    String city;
    BigDecimal price;
    @Version long version;
    protected ListingEntity() {}
}
record ListingView(long id, String city, BigDecimal price, long version) {}
class ListingConflict extends RuntimeException {
    ListingConflict() {} ListingConflict(Throwable cause) { super(cause); }
}
interface ListingRepository extends JpaRepository<ListingEntity, Long> {
    @Query("select p from ListingEntity p where lower(p.city) = lower(:city) and p.price <= :price")
    Page<ListingEntity> search(@Param("city") String city, @Param("price") BigDecimal price, Pageable pageable);
}`,
  units: [{ owner: '@Service\nclass ListingService', members: '    private final ListingRepository repository;\n    ListingService(ListingRepository repository) { this.repository = repository; }', methods: [
    { signature: 'private ListingView view(ListingEntity entity)', body: '        return new ListingView(entity.id, entity.city, entity.price, entity.version);' },
    { signature: '@Transactional(readOnly = true)\n    public Optional<ListingView> find(long id)', body: '        if (id <= 0) throw new IllegalArgumentException("Invalid ID");\n        return repository.findById(id).map(this::view);' },
    { signature: '@Transactional(readOnly = true)\n    public Page<ListingView> search(String city, BigDecimal maximum, int page, int size)', body: `        if (city == null || city.isBlank() || maximum == null || maximum.signum() < 0 || page < 0 || size < 1 || size > 100)
            throw new IllegalArgumentException("Invalid search");
        return repository.search(city.strip(), maximum, PageRequest.of(page, size, Sort.by("id"))).map(this::view);` },
    { signature: '@Transactional\n    public ListingView reprice(long id, long expectedVersion, BigDecimal price)', body: `        if (id <= 0 || expectedVersion < 0 || price == null || price.signum() <= 0)
            throw new IllegalArgumentException("Invalid price update");
        ListingEntity entity = repository.findById(id).orElseThrow();
        if (entity.version != expectedVersion) throw new ListingConflict();
        entity.price = price;
        try { repository.flush(); }
        catch (OptimisticLockingFailureException | OptimisticLockException failure) { throw new ListingConflict(failure); }
        return view(entity);` }
  ] }],
  expected: 'Search performs database-side pagination. A successful edit increments the version. Stale and racing edits fail without committing an overwrite.',
  hints: ['Use a fixed sort in the Pageable rather than accepting arbitrary client sort fields.', 'Convert entity results while their transactional context is available.', 'Check the user version and retain the @Version mapping for the actual database race.', 'Flush inside the boundary so concurrency failures are translated before return.'],
  explanation: ['The client version check explains stale intent, while the database version predicate closes the race after that check.', 'Managed entity changes are persisted by the transaction; calling save again is not required for this already-managed entity.', 'Page may issue a count query. Slice or keyset pagination is a useful follow-up for high-volume browsing.'],
  notes: 'Setup: data-jpa, a transactional database, entity scanning, and a Spring-managed service proxy. Add an index appropriate to the target database and case-insensitive predicate. Verify concurrency in separate transactions; mocks or one shared test transaction cannot prove locking behavior. Authorization is required before editing a real listing.'
});

const mvcTask = projectFeature({
  topic: 20, title: 'Build a MockMvc regression suite for the property API',
  statement: 'Use the property API from the REST task as the system under test. Build a slice suite covering creation, validation, resource lookup, bounded search, and stale-version errors. Verify both HTTP output and which service operations did or did not happen.',
  requirements: [
    'Stub valid creation and assert 201, Location, ID, and normalized city delegation.',
    'Use parameterized invalid price JSON and assert 400 with no service interaction.',
    'Check blank city and out-of-range search sizes before the service is invoked.',
    'Check both an existing resource response and a missing resource 404.',
    'Make repricing throw a version conflict and assert a safe 409 ProblemDetail without the internal exception text.',
    'Keep this slice focused on HTTP behavior; filters are deliberately disabled. Test authentication, ownership, and CSRF in the separate security task.'
  ],
  imports: apiImports + '\nimport org.junit.jupiter.api.Test;\nimport org.junit.jupiter.params.ParameterizedTest;\nimport org.junit.jupiter.params.provider.ValueSource;\nimport org.springframework.beans.factory.annotation.Autowired;\nimport org.springframework.boot.test.autoconfigure.web.servlet.*;\nimport org.springframework.context.annotation.Import;\nimport org.springframework.test.context.bean.override.mockito.MockitoBean;\nimport org.springframework.test.web.servlet.MockMvc;\nimport static org.mockito.Mockito.*;\nimport static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;\nimport static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;',
  model: propertyApiTask.solution.replace(/^import [^\n]+\n/gm, ''),
  units: [{ owner: '@WebMvcTest(PropertyController.class)\n@Import(PropertyErrors.class)\n@AutoConfigureMockMvc(addFilters = false)\nclass PropertyApiTest', members: '    @Autowired MockMvc mvc;\n    @MockitoBean PropertyOperations operations;', methods: [
    { signature: '@Test void createsAndNormalizesCity() throws Exception', body: `        when(operations.create("Chicago", new BigDecimal("250000")))
            .thenReturn(new PropertyDto(42, "Chicago", new BigDecimal("250000"), 0));
        mvc.perform(post("/api/properties").contentType(MediaType.APPLICATION_JSON)
            .content("{\\"city\\":\\" Chicago \\",\\"price\\":250000}"))
            .andExpect(status().isCreated()).andExpect(header().string("Location", "/api/properties/42"))
            .andExpect(jsonPath("$.id").value(42));
        verify(operations).create("Chicago", new BigDecimal("250000"));` },
    { signature: '@ParameterizedTest @ValueSource(strings = {"0", "-1", "null"})\n    void rejectsInvalidPrices(String price) throws Exception', body: `        mvc.perform(post("/api/properties").contentType(MediaType.APPLICATION_JSON)
            .content("{\\"city\\":\\"Chicago\\",\\"price\\":" + price + "}"))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(operations);` },
    { signature: '@Test void rejectsBlankCityAndOversizedSearch() throws Exception', body: `        mvc.perform(post("/api/properties").contentType(MediaType.APPLICATION_JSON)
            .content("{\\"city\\":\\" \\",\\"price\\":100}"))
            .andExpect(status().isBadRequest());
        mvc.perform(get("/api/properties").param("city", "Chicago").param("size", "101"))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(operations);` },
    { signature: '@Test void returnsExistingAndMissingResources() throws Exception', body: `        when(operations.find(1)).thenReturn(Optional.of(new PropertyDto(1, "Chicago", BigDecimal.TEN, 2)));
        when(operations.find(2)).thenReturn(Optional.empty());
        mvc.perform(get("/api/properties/1")).andExpect(status().isOk()).andExpect(jsonPath("$.version").value(2));
        mvc.perform(get("/api/properties/2")).andExpect(status().isNotFound());` },
    { signature: '@Test void mapsStaleVersionToSafeProblem() throws Exception', body: `        when(operations.reprice(1, 2, new BigDecimal("200"))).thenThrow(new PropertyConflict());
        mvc.perform(put("/api/properties/1/price").contentType(MediaType.APPLICATION_JSON)
            .content("{\\"expectedVersion\\":2,\\"price\\":200}"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.title").value("Property changed"))
            .andExpect(jsonPath("$.detail").value("Reload the property before retrying the update."));
        verify(operations).reprice(1, 2, new BigDecimal("200"));` },
    { signature: '@Test void forwardsBoundedSearch() throws Exception', body: `        when(operations.search("Chicago", 1, 2)).thenReturn(List.of(new PropertyDto(3, "Chicago", BigDecimal.TEN, 0)));
        mvc.perform(get("/api/properties").param("city", " Chicago ").param("page", "1").param("size", "2"))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(3));
        verify(operations).search("Chicago", 1, 2);` }
  ] }],
  expected: 'All slice tests pass, and mutations removing validation, Location, city trimming, or conflict advice cause a targeted failure.',
  hints: ['Keep test JSON literal and focused on one boundary at a time.', 'Use verifyNoInteractions for rejected input, not just an HTTP status assertion.', 'Stub the exact domain result needed to verify the public response.', 'Import the error advice explicitly so the slice exercises the intended error contract.'],
  explanation: ['A controller test should verify delegation as well as output; a 400 response after performing a write would still be a defect.', 'A slice keeps database behavior outside the test, so persistence and transaction claims require separate integration tests.', 'This fixture reuses the REST task’s supplied implementation to keep the contracts aligned. Place it in an isolated exercise package to avoid duplicate class names.'],
  notes: 'Setup: Boot 3.5 starter-web, starter-validation, starter-test, and a discoverable @SpringBootConfiguration. Add malformed JSON, negative path IDs, missing price, and missing-resource update tests. Do not disable filters in the actual application configuration.'
});

export const mediumApiTasks = [propertyApiTask, jpaTask, mvcTask];
