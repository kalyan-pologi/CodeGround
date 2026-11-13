const lines = (...items) => items.join('\n');

const readme = lines(
  '# Property browsing: remove the N+1 query',
  '',
  'You are working on a production property-search slice. The first version loads one page, then loads photos once per property. With 30 properties, one request becomes 31 database round trips.',
  '',
  'Implement the feature boundary, not just the output string. Treat the repository as a database adapter and the service as the authorization and consistency boundary.',
  'Requirements:',
  '1. Authorize every property and photo query with ownerId; never trust a client property ID.',
  '2. Validate city, max price, cursor, and limit (1..50) before touching the repository.',
  '3. Apply city and price filters before pagination.',
  '4. Return deterministic keyset order by createdAt, then id, after the exclusive cursor.',
  '5. Load all photos for the page in one batch query and restore property order.',
  '6. Skip the photo query when the page is empty.',
  '7. Return immutable request, response, cursor, and photo collections.',
  '8. Preserve a next cursor only when another page exists.',
  '9. Keep the query budget at two queries for a non-empty page and one for an empty page.',
  '',
  'Edit src/PropertyRepository.java, src/PropertyService.java, and src/PropertyController.java. The model files, entry point, and regression test are fixed.',
  'Run the starter first. The failing assertions describe production bugs: data leakage, unstable pages, N+1 queries, and mutable responses.',
  '',
  'Expected output:',
  'queries=2',
  'ids=[1, 2]',
  'photoCounts=[2, 1]',
  'nextCursor=200:2',
  'filteredIds=[3]',
  'emptyQueries=1',
  'tests=passed'
);

const main = lines(
  'public class Main {',
  '    public static void main(String[] args) {',
  '        PropertyRepository repository = PropertyRepository.sample();',
  '        PropertyController controller = new PropertyController(new PropertyService(repository));',
  '        System.out.println(controller.browse(42L, "Chicago", 100000, 0, 0, 2));',
  '        BrowseResult filtered = new PropertyController(new PropertyService(PropertyRepository.sample())).browse(42L, "Austin", 100000, 0, 0, 10);',
  '        System.out.println("filteredIds=" + filtered.ids());',
  '        System.out.println("emptyQueries=" + new PropertyService(PropertyRepository.sample()).browse(new BrowseRequest(42L, "Missing", 100000, 0, 0, 10)).queryCount());',
  '        PropertyServiceTest.run();',
  '    }',
  '}'
);

const domain = lines(
  'record Property(int id, long ownerId, String city, long createdAt, int priceCents, java.util.List<Photo> photos) {',
  '    Property {',
  '        if (id <= 0 || ownerId <= 0 || city == null || city.isBlank() || priceCents < 0) throw new IllegalArgumentException("invalid property");',
  '        photos = java.util.List.copyOf(photos == null ? java.util.List.of() : photos);',
  '    }',
  '}',
  '',
  'record Photo(int id, long ownerId, int propertyId, String url) {}',
  '',
  'record BrowseRequest(long ownerId, String city, int maxPriceCents, int afterCreatedAt, int afterId, int limit) {}',
  '',
  'record Cursor(long createdAt, int id) {',
  '    @Override public String toString() { return createdAt + ":" + id; }',
  '}',
  '',
  'record PropertySummary(int id, String city, int priceCents, java.util.List<String> photoUrls) {',
  '    PropertySummary { photoUrls = java.util.List.copyOf(photoUrls); }',
  '}',
  '',
  'record BrowseResult(java.util.List<PropertySummary> items, Cursor nextCursor, int queryCount) {',
  '    BrowseResult { items = java.util.List.copyOf(items); }',
  '    String ids() { return items.stream().map(PropertySummary::id).toList().toString(); }',
  '    String photoCounts() { return items.stream().map(item -> item.photoUrls().size()).toList().toString(); }',
  '    @Override public String toString() { return "queries=" + queryCount + "\\nids=" + ids() + "\\nphotoCounts=" + photoCounts() + "\\nnextCursor=" + (nextCursor == null ? "none" : nextCursor); }',
  '}'
);

const repositoryStarter = lines(
  'class PropertyRepository {',
  '    private final java.util.List<Property> properties;',
  '    int queries;',
  '',
  '    PropertyRepository(java.util.List<Property> properties) { this.properties = java.util.List.copyOf(properties); }',
  '    static PropertyRepository sample() {',
  '        return new PropertyRepository(java.util.List.of(',
  '            new Property(1, 42L, "Chicago", 100, 85000, java.util.List.of(new Photo(11, 42L, 1, "front.jpg"), new Photo(12, 42L, 1, "rear.jpg"))),',
  '            new Property(2, 42L, "Chicago", 200, 95000, java.util.List.of(new Photo(21, 42L, 2, "living.jpg"))),',
  '            new Property(3, 42L, "Austin", 300, 70000, java.util.List.of()),',
  '            new Property(4, 42L, "Chicago", 400, 125000, java.util.List.of(new Photo(41, 42L, 4, "premium.jpg"))),',
  '            new Property(5, 99L, "Chicago", 500, 1000, java.util.List.of(new Photo(51, 99L, 5, "private.jpg")))));',
  '    }',
  '',
  '    java.util.List<Property> findPage(BrowseRequest request) {',
  '        queries++;',
  '        return properties.stream().filter(property -> true).limit(request.limit()).toList(); // intentionally unsafe starter',
  '    }',
  '',
  '    java.util.Map<Integer, java.util.List<Photo>> findPhotos(long ownerId, java.util.List<Integer> propertyIds) {',
  '        queries++;',
  '        return properties.stream().filter(property -> propertyIds.contains(property.id()))',
  '            .collect(java.util.stream.Collectors.toMap(Property::id, Property::photos)); // leaks cross-tenant rows',
  '    }',
  '}'
);

const serviceStarter = lines(
  'class PropertyService {',
  '    private final PropertyRepository repository;',
  '    PropertyService(PropertyRepository repository) { this.repository = repository; }',
  '',
  '    BrowseResult browse(BrowseRequest request) {',
  '        java.util.List<Property> page = repository.findPage(request);',
  '        java.util.List<PropertySummary> summaries = page.stream().map(property -> {',
  '            java.util.List<Photo> photos = repository.findPhotos(request.ownerId(), java.util.List.of(property.id())).getOrDefault(property.id(), java.util.List.of());',
  '            return new PropertySummary(property.id(), property.city(), property.priceCents(), photos.stream().map(Photo::url).toList());',
  '        }).toList();',
  '        return new BrowseResult(summaries, null, repository.queries);',
  '    }',
  '}'
);

const serviceSolution = lines(
  'class PropertyService {',
  '    private final PropertyRepository repository;',
  '    PropertyService(PropertyRepository repository) { this.repository = repository; }',
  '',
  '    BrowseResult browse(BrowseRequest request) {',
  '        validate(request);',
  '        java.util.List<Property> page = repository.findPage(request);',
  '        java.util.List<Integer> ids = page.stream().map(Property::id).toList();',
  '        java.util.Map<Integer, java.util.List<Photo>> photosByProperty = ids.isEmpty() ? java.util.Map.of() : repository.findPhotos(request.ownerId(), ids);',
  '        java.util.List<PropertySummary> summaries = page.stream().map(property -> new PropertySummary(property.id(), property.city(), property.priceCents(), photosByProperty.getOrDefault(property.id(), java.util.List.of()).stream().map(Photo::url).toList())).toList();',
  '        Cursor next = page.size() == request.limit() ? page.get(page.size() - 1) == null ? null : new Cursor(page.get(page.size() - 1).createdAt(), page.get(page.size() - 1).id()) : null;',
  '        return new BrowseResult(summaries, next, repository.queries);',
  '    }',
  '',
  '    private void validate(BrowseRequest request) {',
  '        if (request == null || request.ownerId() <= 0) throw new IllegalArgumentException("ownerId must be positive");',
  '        if (request.city() != null && request.city().isBlank()) throw new IllegalArgumentException("city must be null or non-blank");',
  '        if (request.maxPriceCents() < 0 || request.limit() < 1 || request.limit() > 50) throw new IllegalArgumentException("invalid price or limit");',
  '        if (request.afterCreatedAt() < 0 || request.afterId() < 0) throw new IllegalArgumentException("cursor must not be negative");',
  '        if ((request.afterCreatedAt() == 0) != (request.afterId() == 0)) throw new IllegalArgumentException("cursor must contain both values");',
  '    }',
  '}'
);

const repositorySolution = lines(
  'class PropertyRepository {',
  '    private final java.util.List<Property> properties;',
  '    int queries;',
  '    PropertyRepository(java.util.List<Property> properties) { this.properties = java.util.List.copyOf(properties); }',
  '    static PropertyRepository sample() {',
  '        return new PropertyRepository(java.util.List.of(',
  '            new Property(1, 42L, "Chicago", 100, 85000, java.util.List.of(new Photo(11, 42L, 1, "front.jpg"), new Photo(12, 42L, 1, "rear.jpg"))),',
  '            new Property(2, 42L, "Chicago", 200, 95000, java.util.List.of(new Photo(21, 42L, 2, "living.jpg"))),',
  '            new Property(3, 42L, "Austin", 300, 70000, java.util.List.of()),',
  '            new Property(4, 42L, "Chicago", 400, 125000, java.util.List.of(new Photo(41, 42L, 4, "premium.jpg"))),',
  '            new Property(5, 99L, "Chicago", 500, 1000, java.util.List.of(new Photo(51, 99L, 5, "private.jpg")))));',
  '    }',
  '    java.util.List<Property> findPage(BrowseRequest request) {',
  '        queries++;',
  '        return properties.stream().filter(property -> property.ownerId() == request.ownerId())',
  '            .filter(property -> request.city() == null || property.city().equalsIgnoreCase(request.city()))',
  '            .filter(property -> property.priceCents() <= request.maxPriceCents())',
  '            .filter(property -> property.createdAt() > request.afterCreatedAt() || (property.createdAt() == request.afterCreatedAt() && property.id() > request.afterId()))',
  '            .sorted(java.util.Comparator.comparingLong(Property::createdAt).thenComparingInt(Property::id))',
  '            .limit(request.limit()).toList();',
  '    }',
  '    java.util.Map<Integer, java.util.List<Photo>> findPhotos(long ownerId, java.util.List<Integer> propertyIds) {',
  '        queries++;',
  '        return properties.stream().filter(property -> property.ownerId() == ownerId && propertyIds.contains(property.id()))',
  '            .flatMap(property -> property.photos().stream()).filter(photo -> photo.ownerId() == ownerId)',
  '            .collect(java.util.stream.Collectors.groupingBy(Photo::propertyId, java.util.LinkedHashMap::new, java.util.stream.Collectors.toUnmodifiableList()));',
  '    }',
  '}'
);

const controller = lines(
  'class PropertyController {',
  '    private final PropertyService service;',
  '    PropertyController(PropertyService service) { this.service = service; }',
  '    BrowseResult browse(long ownerId, String city, int maxPriceCents, int afterCreatedAt, int afterId, int limit) {',
  '        return service.browse(new BrowseRequest(ownerId, city, maxPriceCents, afterCreatedAt, afterId, limit));',
  '    }',
  '}'
);
const test = lines(
  'class PropertyServiceTest {',
  '    static void run() {',
  '        PropertyRepository repository = PropertyRepository.sample();',
  '        PropertyService service = new PropertyService(repository);',
  '        BrowseResult result = service.browse(new BrowseRequest(42L, "Chicago", 100000, 0, 0, 2));',
  '        require(result.toString().equals("queries=2\\nids=[1, 2]\\nphotoCounts=[2, 1]\\nnextCursor=200:2"), "browse regression: " + result);',
  '        require(repository.queries == 2, "Expected one page query and one batched photo query");',
  '        require(service.browse(new BrowseRequest(42L, "Austin", 100000, 0, 0, 10)).ids().equals("[3]"), "City filtering failed");',
  '        require(new PropertyService(PropertyRepository.sample()).browse(new BrowseRequest(42L, "Missing", 100000, 0, 0, 10)).queryCount() == 1, "Empty pages must not query photos");',
  '        require(new PropertyService(PropertyRepository.sample()).browse(new BrowseRequest(42L, "Chicago", 200000, 200, 2, 10)).ids().equals("[4]"), "Cursor filtering failed");',
  '        require(new PropertyService(PropertyRepository.sample()).browse(new BrowseRequest(42L, "Chicago", 200000, 0, 0, 10)).ids().equals("[1, 2, 4]"), "Owner filtering failed");',
  '        expectFailure(() -> service.browse(new BrowseRequest(0, null, 100000, 0, 0, 2)));',
  '        expectFailure(() -> service.browse(new BrowseRequest(42L, " ", 100000, 0, 0, 2)));',
  '        expectFailure(() -> service.browse(new BrowseRequest(42L, null, 100000, 0, 2, 2)));',
  '        expectFailure(() -> service.browse(new BrowseRequest(42L, null, 100000, 0, 0, 51)));',
  '        expectFailure(() -> result.items().add(new PropertySummary(9, "x", 1, java.util.List.of())));',
  '        System.out.println("tests=passed");',
  '    }',
  '    private static void require(boolean condition, String message) { if (!condition) throw new AssertionError(message); }',
  '    private static void expectFailure(Runnable action) { try { action.run(); throw new AssertionError("Expected failure"); } catch (RuntimeException expected) { } }',
  '}'
);

export const nPlusOneFiles = [
  { path: 'README.md', language: 'markdown', readOnly: true, starter: readme },
  { path: 'src/Main.java', language: 'java', readOnly: true, starter: main },
  { path: 'src/Property.java', language: 'java', readOnly: true, starter: domain },
  { path: 'src/PropertyController.java', language: 'java', starter: controller },
  { path: 'src/PropertyRepository.java', language: 'java', starter: repositoryStarter },
  { path: 'src/PropertyService.java', language: 'java', starter: serviceStarter },
  { path: 'test/PropertyServiceTest.java', language: 'java', readOnly: true, starter: test }
];

export const nPlusOneSolutions = {
  'README.md': readme,
  'src/Main.java': main,
  'src/Property.java': domain,
  'src/PropertyController.java': controller,
  'src/PropertyRepository.java': repositorySolution,
  'src/PropertyService.java': serviceSolution,
  'test/PropertyServiceTest.java': test
};

export const nPlusOneExpected = 'queries=2\nids=[1, 2]\nphotoCounts=[2, 1]\nnextCursor=200:2\nfilteredIds=[3]\nemptyQueries=1\ntests=passed';
