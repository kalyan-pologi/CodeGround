import { javaChallenge } from '../java-backend/data/challenge-helpers.js';

export const sampleTasks = [{ id: 1, ...javaChallenge(
  3,
  'Medium',
  'Search ReidyAI properties with filters and pagination',
  'Implement searchProperties, the in-memory core of a property-search endpoint. Match city case-insensitively after trimming the search city, include prices at or below maxPrice, sort by ascending property ID, and return the requested zero-based page. Reject null or blank search cities, null or negative maxPrice, negative page numbers, and page sizes outside 1–100 with IllegalArgumentException. Return an empty list for no matches or a page beyond the results. Do not modify the input. This Java exercise models query behavior; database filtering and pagination belong in the repository layer in a Spring application.',
  'Page 0: [1, 2]\nPage 1: [4]\nChecks passed',
  '    record Property(long id, String city, BigDecimal askingPrice) {}',
  'static List<Property> searchProperties(List<Property> properties, String city, BigDecimal maxPrice, int page, int size)',
  `        if (city == null || city.isBlank()) throw new IllegalArgumentException("City is required");
        if (maxPrice == null || maxPrice.signum() < 0) throw new IllegalArgumentException("Invalid maximum price");
        if (page < 0 || size < 1 || size > 100) throw new IllegalArgumentException("Invalid pagination");
        String normalizedCity = city.strip().toLowerCase(Locale.ROOT);
        return properties.stream()
            .filter(property -> property.city().toLowerCase(Locale.ROOT).equals(normalizedCity))
            .filter(property -> property.askingPrice().compareTo(maxPrice) <= 0)
            .sorted(Comparator.comparingLong(Property::id))
            .skip((long) page * size)
            .limit(size)
            .toList();`,
  `        List<Property> properties = List.of(
            new Property(4, "Chicago", new BigDecimal("250000")),
            new Property(2, "chicago", new BigDecimal("200000")),
            new Property(3, "Austin", new BigDecimal("150000")),
            new Property(1, "CHICAGO", new BigDecimal("300000")),
            new Property(5, "Chicago", new BigDecimal("350000")));
        BigDecimal budget = new BigDecimal("300000");
        var first = searchProperties(properties, " Chicago ", budget, 0, 2);
        var second = searchProperties(properties, "Chicago", budget, 1, 2);
        if (!first.stream().map(Property::id).toList().equals(List.of(1L, 2L)))
            throw new AssertionError("First page, city matching, or inclusive price filter is incorrect");
        if (!second.stream().map(Property::id).toList().equals(List.of(4L)))
            throw new AssertionError("Second page is incorrect");
        if (!searchProperties(properties, "Chicago", budget, 99, 2).isEmpty())
            throw new AssertionError("Page beyond results must be empty");
        if (!searchProperties(properties, "Boston", budget, 0, 2).isEmpty())
            throw new AssertionError("Unmatched city must return an empty list");
        if (!searchProperties(List.of(), "Chicago", budget, 0, 2).isEmpty())
            throw new AssertionError("Empty input must return an empty list");
        for (int invalidSize : new int[] {0, 101}) {
            try {
                searchProperties(properties, "Chicago", budget, 0, invalidSize);
                throw new AssertionError("Invalid page size must be rejected");
            } catch (IllegalArgumentException expected) { }
        }
        if (properties.get(0).id() != 4) throw new AssertionError("Input was modified");
        System.out.println("Page 0: " + first.stream().map(Property::id).toList());
        System.out.println("Page 1: " + second.stream().map(Property::id).toList());
        System.out.println("Checks passed");`,
  'Validate parameters → normalize city → filter city and price → sort by ID → skip page × size → limit page size → collect. Filter and sort before pagination.',
  'Inputs contain non-null properties with unique IDs, non-null city names without surrounding whitespace, and valid nonnegative prices. Use BigDecimal.compareTo for prices, Locale.ROOT for case normalization, and long arithmetic for the page offset. Test the inclusive price boundary, mixed-case cities, empty input, missing city, out-of-range pages, invalid parameters, and input preservation. Interview follow-up: why is deterministic sorting required, and why should a database paginate before returning results?'
) }];
