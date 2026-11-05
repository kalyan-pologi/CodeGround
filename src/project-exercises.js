import { javaChallenge as j } from '../practice/src/data/challenge-helpers.js';
import { topics } from '../practice/src/data/topics.js';

export const projectChallenges = [
  j(1, 'Medium', 'Protect an immutable property snapshot',
    'Implement snapshot for an appraisal-service property snapshot. Reject blank addresses and null amenity lists or elements. Copy amenities so changing the source list cannot change the returned snapshot; the returned list must reject modification.',
    'After adding pool to the source, snapshot amenities remain [garage].',
    '    record PropertySnapshot(long id, String address, List<String> amenities) {}',
    'static PropertySnapshot snapshot(long id, String address, List<String> amenities)',
    '        if (address == null || address.isBlank()) throw new IllegalArgumentException("Blank address");\n        return new PropertySnapshot(id, address, List.copyOf(amenities));',
    '        var amenities = new ArrayList<>(List.of("garage"));\n        var property = snapshot(1, "100 Synthetic Ave", amenities);\n        amenities.add("pool");\n        System.out.println(property.amenities());',
    'Validate the address, copy the collection, and construct a record from that independent immutable list.',
    'Check source mutation, modification through the returned record, null elements, and blank addresses. A record alone does not make its list immutable.'),
  j(2, 'Medium', 'Deduplicate notification event IDs',
    'Implement firstDeliveries for communication-service event IDs. Return unique, nonblank IDs in first-seen order. Reject null or blank IDs. This is an isolated batch exercise; durable consumer deduplication belongs in a database transaction.',
    '[event-1, event-2, event-1] -> [event-1, event-2]', '',
    'static List<String> firstDeliveries(List<String> eventIds)',
    '        Set<String> seen = new LinkedHashSet<>();\n        for (String id : eventIds) {\n            if (id == null || id.isBlank()) throw new IllegalArgumentException("Blank event ID");\n            seen.add(id);\n        }\n        return List.copyOf(seen);',
    '        System.out.println(firstDeliveries(List.of("event-1", "event-2", "event-1")));',
    'Use a set with insertion order, validate every ID, and return an immutable list.',
    'Check empty input, repeated IDs, stable order, and invalid IDs. Explain why this in-memory set does not protect separate consumer instances.'),
  j(3, 'Medium', 'Summarize property counts by city',
    'Implement countsByCity for property search analytics. Normalize each nonblank city using strip and Locale.ROOT lowercase, count occurrences, and return a map sorted alphabetically by city. Reject null or blank cities.',
    '[Chicago, chicago, Austin] -> {austin=1, chicago=2}', '',
    'static Map<String, Long> countsByCity(List<String> cities)',
    '        return cities.stream().map(city -> {\n            if (city == null || city.isBlank()) throw new IllegalArgumentException("Blank city");\n            return city.strip().toLowerCase(Locale.ROOT);\n        }).collect(Collectors.groupingBy(city -> city, TreeMap::new, Collectors.counting()));',
    '        System.out.println(countsByCity(List.of("Chicago", " chicago ", "Austin")));',
    'Normalize each city, group identical normalized names, and count into a sorted map.',
    'Check empty input, whitespace, mixed case, null cities, and non-English default locale.'),
  j(0, 'Medium', 'Validate and debit appraisal credits',
    'Implement remainingCredits for a standalone paid-appraisal credit calculation. Reject negative balances, nonpositive costs, and insufficient credits using IllegalArgumentException. Return the remaining integer credits. This models the arithmetic only; real charging requires a transaction and idempotency.',
    'remainingCredits(5, 1) -> 4\nremainingCredits(0, 1) -> IllegalArgumentException', '',
    'static int remainingCredits(int balance, int cost)',
    '        if (balance < 0 || cost <= 0) throw new IllegalArgumentException("Invalid credits");\n        if (balance < cost) throw new IllegalArgumentException("Insufficient credits");\n        return balance - cost;',
    '        System.out.println(remainingCredits(5, 1));',
    'Validate balance and cost before checking sufficiency, then subtract.',
    'Check exact balance, insufficient credits, negative balance, zero cost, and maximum integer balance. Explain why checking a balance outside a transaction is unsafe.'),
  j(5, 'Medium', 'Expire cached rental estimates at the boundary',
    'Implement isFresh for a rental estimate cache. A result is fresh only if ttl is positive, now is not before createdAt, and now is strictly before createdAt plus ttl. A zero TTL expires immediately; reject negative TTL.',
    'Created 12:00:00Z, TTL 60 seconds: fresh at 12:00:59Z; expired at 12:01:00Z.', '',
    'static boolean isFresh(Instant createdAt, Instant now, Duration ttl)',
    '        if (ttl.isNegative()) throw new IllegalArgumentException("Negative TTL");\n        return !ttl.isZero() && !now.isBefore(createdAt) && now.isBefore(createdAt.plus(ttl));',
    '        Instant created = Instant.parse("2026-01-01T12:00:00Z");\n        System.out.println(isFresh(created, created.plusSeconds(59), Duration.ofSeconds(60)));\n        System.out.println(isFresh(created, created.plusSeconds(60), Duration.ofSeconds(60)));',
    'Validate the duration and compare instants against an exclusive expiry boundary.',
    'Check just before expiry, exact expiry, zero TTL, negative TTL, and a clock earlier than creation. Inputs are non-null and expiry arithmetic is within Instant range.')
].map((challenge, index) => ({ id: index + 1, ...challenge }));

export const projectMcqs = [
  { topic: topics[15], title: 'A paid appraisal is retried', code: 'POST /api/properties/1/appraisals/paid\nIdempotency-Key: demo-001\n// The client repeats the same request.', prompt: 'Which behavior should the repeated request have?', options: ['Charge again and create a new report', 'Return the previous result without charging again', 'Delete the previous report', 'Always fail with a server error'], answer: 1, explanation: 'The same completed request key should replay its saved result. Persist and enforce the key atomically with the charge so concurrent requests cannot both charge.' },
  { topic: topics[18], title: 'Kafka is unavailable after a property update', code: 'transaction {\n  saveProperty();\n  saveOutboxEvent();\n}', prompt: 'Why save an outbox event in the business transaction?', options: ['It makes Kafka part of the database transaction', 'It prevents every duplicate delivery', 'It durably records publication intent for retry', 'It removes the need for a consumer'], answer: 2, explanation: 'Committing the business change and publication intent together avoids losing the intent. A publisher retries later, and consumers still need deduplication.' },
  { topic: topics[1], title: 'A record leaks property amenities', code: 'record Snapshot(List<String> amenities) {}\nvar source = new ArrayList<>(List.of("garage"));\nvar snapshot = new Snapshot(source);\nsource.add("pool");', prompt: 'What does snapshot.amenities() contain?', options: ['[garage]', '[garage, pool]', 'An empty list', 'A compile error'], answer: 1, explanation: 'The record keeps the supplied list reference. Use a defensive immutable copy at construction to protect this snapshot.' },
  { topic: topics[19], title: 'Property lookup fails before a paid appraisal', code: 'property = propertyClient.get(propertyId);\n// Only after this succeeds: start the billing transaction.', prompt: 'Why keep the remote lookup outside the billing transaction?', options: ['HTTP calls automatically roll back both databases', 'It guarantees that the property never changes', 'It eliminates all network failures', 'It avoids holding billing locks during the network call'], answer: 3, explanation: 'The lookup completes before the billing transaction acquires its resources. A failed lookup should not debit credits. Cross-service consistency still needs explicit design.' },
  { topic: topics[17], title: 'An expired rental cache entry exists', code: 'createdAt = 12:00:00Z\nttl = 60 seconds\nnow = 12:01:00Z', prompt: 'With an exclusive expiry boundary, is this entry fresh?', options: ['No, now equals the expiry time', 'Yes, for one more second', 'Yes, because the entry exists', 'Only if it was read before'], answer: 0, explanation: 'A time-based cache must compare now against its expiry boundary. Existence alone does not establish freshness.' }
].map((question, index) => ({ id: index + 1, difficulty: 'Medium', ...question }));
