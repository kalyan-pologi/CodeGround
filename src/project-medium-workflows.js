import { projectFeature } from './project-feature-builder.js';

export const mediumWorkflowTasks = [
  projectFeature({
    topic: 12, title: 'Build an injected notification router with controlled fallback',
    statement: 'Notification delivery supports several Spring-managed channels. Build a validated strategy registry, render messages through an injected formatter, and fall back only for a recognized transient channel failure. Return a delivery receipt for each successful notification.',
    requirements: [
      'Inject channel beans and a formatter through the constructor. Reject duplicate or blank channel names during registry construction.',
      'Require a message ID, recipient, and body. Validate both requested channel names before attempting delivery.',
      'Try the primary channel once. Try the configured fallback only when ChannelUnavailable is thrown; do not swallow arbitrary programming/runtime errors.',
      'Do not deliver the same message twice after primary success. If both transient attempts fail, propagate the last failure with the primary failure suppressed.',
      'Return a Receipt containing message ID and actual channel. Support batch delivery in encounter order and expose an immutable list of registered names.',
      'Document partial batch delivery: external sends already performed cannot be rolled back by throwing from the batch method.'
    ],
    imports: 'import java.util.*;\nimport org.springframework.stereotype.Service;',
    model: `record Message(String id, String recipient, String body) {}
record Receipt(String messageId, String channel) {}
class ChannelUnavailable extends RuntimeException { ChannelUnavailable(String message) { super(message); } }
interface DeliveryChannel { String name(); void send(String recipient, String rendered); }
interface MessageFormatter { String render(Message message); }`,
    units: [{ owner: '@Service\nclass NotificationRouter', members: `    private final Map<String, DeliveryChannel> channels;
    private final MessageFormatter formatter;
    NotificationRouter(List<DeliveryChannel> candidates, MessageFormatter formatter) {
        this.channels = index(candidates); this.formatter = Objects.requireNonNull(formatter);
    }`, methods: [
      { signature: 'private static Map<String, DeliveryChannel> index(List<DeliveryChannel> candidates)', body: `        if (candidates == null) throw new IllegalArgumentException("Missing channels");
        Map<String, DeliveryChannel> index = new TreeMap<>();
        for (DeliveryChannel channel : candidates) {
            if (channel == null || channel.name() == null || channel.name().isBlank()
                || index.putIfAbsent(channel.name(), channel) != null) throw new IllegalArgumentException("Invalid channels");
        }
        return Collections.unmodifiableMap(index);` },
      { signature: 'private DeliveryChannel channel(String name)', body: `        DeliveryChannel channel = channels.get(name);
        if (channel == null) throw new IllegalArgumentException("Unknown channel");
        return channel;` },
      { signature: 'private void validate(Message message)', body: `        if (message == null || message.id() == null || message.id().isBlank() || message.recipient() == null
            || message.recipient().isBlank() || message.body() == null || message.body().isBlank())
            throw new IllegalArgumentException("Invalid message");` },
      { signature: 'Receipt deliver(String primaryName, String fallbackName, Message message)', body: `        validate(message); DeliveryChannel primary = channel(primaryName);
        DeliveryChannel fallback = fallbackName == null ? null : channel(fallbackName);
        if (primary == fallback) throw new IllegalArgumentException("Fallback must differ");
        String rendered = Objects.requireNonNull(formatter.render(message));
        try { primary.send(message.recipient(), rendered); return new Receipt(message.id(), primary.name()); }
        catch (ChannelUnavailable first) {
            if (fallback == null) throw first;
            try { fallback.send(message.recipient(), rendered); return new Receipt(message.id(), fallback.name()); }
            catch (ChannelUnavailable second) { if (second != first) second.addSuppressed(first); throw second; }
        }` },
      { signature: 'List<Receipt> deliverBatch(String primary, String fallback, List<Message> messages)', body: `        if (messages == null) throw new IllegalArgumentException("Missing batch");
        for (Message message : messages) validate(message);
        List<Receipt> receipts = new ArrayList<>();
        for (Message message : messages) receipts.add(deliver(primary, fallback, message));
        return List.copyOf(receipts);` },
      { signature: 'List<String> names()', body: '        return List.copyOf(channels.keySet());' }
    ] }],
    expected: 'Primary success sends once. A transient primary failure triggers one fallback. Duplicate registration fails startup; arbitrary runtime errors are not retried.',
    hints: ['Build the immutable strategy index once in the constructor.', 'Separate validation and channel lookup from performing an external send.', 'Catch only the exception that explicitly permits fallback.', 'Test interaction counts, not just the returned receipt.'],
    explanation: ['Constructor injection makes dependencies explicit and allows fake channels in unit tests.', 'Not every exception means the provider failed safely before accepting the message. Fallback after an ambiguous timeout may duplicate delivery; provider idempotency is a production requirement.', 'Batch validation prevents obvious malformed later messages from causing avoidable partial delivery, but cannot make external sends transactional.'],
    notes: 'Setup: starter and supplied channel/formatter beans. Define ChannelUnavailable to mean no message was accepted, not an ambiguous delivery timeout. Test successful primary, successful fallback, exhausted fallback, unknown channels, duplicate beans, invalid messages, immutable receipts, and a programming exception that must not trigger fallback.'
  }),
  projectFeature({
    topic: 15, title: 'Build a paid appraisal transaction with credit locking and an outbox',
    statement: 'Coordinate a remote property lookup with local paid-appraisal persistence. Separate the network boundary from the billing transaction, replay completed request keys, and commit the credit debit, report, and outbox event together.',
    requirements: [
      'Validate and normalize a charge intent containing account, property, key, and positive credit cost.',
      'A completed identical request replays before another remote lookup. Reusing a key for a different property or cost is a conflict.',
      'For a new request, resolve the property outside the billing transaction. A lookup failure must not deduct credits.',
      'Inside the transaction, lock the account before rechecking the key. Competing requests for the same account must follow this same order.',
      'Reject insufficient credits; otherwise debit the managed account and persist the report and an outbox record in one transaction. Never call Kafka in this boundary.',
      'Integration-test duplicate concurrent keys, insufficient balance, changed intent, remote failure, and persistence failure after the debit. Read committed state from another transaction.'
    ],
    imports: 'import java.util.*;\nimport jakarta.persistence.*;\nimport org.springframework.stereotype.Service;\nimport org.springframework.transaction.annotation.Transactional;',
    model: `record ChargeIntent(long accountId, long propertyId, String key, int cost) {
    ChargeIntent {
        if (accountId <= 0 || propertyId <= 0 || key == null || key.isBlank() || cost <= 0)
            throw new IllegalArgumentException("Invalid charge intent");
        key = key.strip();
    }
}
record PropertySnapshot(long id) {}
record PaidReport(UUID id, long accountId, long propertyId, String key, int cost) {}
@Entity class CreditAccount {
    @Id long id;
    int credits;
    protected CreditAccount() {}
}
interface PropertyClient { PropertySnapshot get(long id); }
interface CreditAccounts { CreditAccount lock(long accountId); }
interface PaidReports { Optional<PaidReport> find(long accountId, String key); void save(PaidReport report); }
interface AppraisalOutbox { void save(UUID eventId, UUID reportId, String type); }`,
    units: [
      { owner: '@Service\nclass AppraisalBilling', members: `    private final CreditAccounts accounts; private final PaidReports reports; private final AppraisalOutbox outbox;
    AppraisalBilling(CreditAccounts accounts, PaidReports reports, AppraisalOutbox outbox) {
        this.accounts = accounts; this.reports = reports; this.outbox = outbox;
    }`, methods: [
        { signature: 'private PaidReport requireSame(PaidReport report, ChargeIntent intent)', body: `        if (report.propertyId() != intent.propertyId() || report.cost() != intent.cost())
            throw new IllegalArgumentException("Conflicting request key");
        return report;` },
        { signature: '@Transactional(readOnly = true)\n    public Optional<PaidReport> replay(ChargeIntent intent)', body: '        return reports.find(intent.accountId(), intent.key()).map(report -> requireSame(report, intent));' },
        { signature: '@Transactional\n    public PaidReport create(ChargeIntent intent)', body: `        CreditAccount account = accounts.lock(intent.accountId());
        Optional<PaidReport> previous = replay(intent);
        if (previous.isPresent()) return previous.get();
        if (account.credits < intent.cost()) throw new IllegalStateException("Insufficient credits");
        PaidReport report = new PaidReport(UUID.randomUUID(), intent.accountId(), intent.propertyId(), intent.key(), intent.cost());
        account.credits -= intent.cost();
        reports.save(report); outbox.save(UUID.randomUUID(), report.id(), "AppraisalPaid");
        return report;` }
      ] },
      { owner: '@Service\nclass PaidAppraisalFacade', members: `    private final PropertyClient properties; private final AppraisalBilling billing;
    PaidAppraisalFacade(PropertyClient properties, AppraisalBilling billing) { this.properties = properties; this.billing = billing; }`, methods: [
        { signature: 'private PropertySnapshot lookup(long propertyId)', body: `        PropertySnapshot snapshot = properties.get(propertyId);
        if (snapshot == null || snapshot.id() != propertyId) throw new IllegalStateException("Invalid property response");
        return snapshot;` },
        { signature: 'public PaidReport request(long accountId, long propertyId, String key, int cost)', body: `        ChargeIntent intent = new ChargeIntent(accountId, propertyId, key, cost);
        Optional<PaidReport> previous = billing.replay(intent);
        if (previous.isPresent()) return previous.get();
        lookup(propertyId);
        return billing.create(intent);` }
      ] }
    ],
    expected: 'An identical request returns one report and deducts credits once. Report/outbox failure rolls back the account debit. No remote call runs inside the billing transaction.',
    hints: ['Use a nontransactional facade for network coordination and a separate proxied writer for billing.', 'Treat the fast replay lookup as an optimization and recheck after acquiring the account lock.', 'Enforce a database unique constraint on account ID plus request key.', 'Keep all stores on the same transaction manager and database.'],
    explanation: ['The recheck under a shared account lock closes the gap between the early lookup and the transaction.', 'The writer invokes its replay helper internally inside an already-active transaction; the facade calls the separate public proxy for the initial read.', 'An outbox records publication intent, not immediate notification delivery. The event relay and consumer need independent retry/deduplication policies.'],
    notes: 'Setup: data-jpa, implementations for the supplied stores, one transaction manager, and a real database. CreditAccounts.lock must return a managed account with a pessimistic write lock; reports need UNIQUE(account_id, request_key). All competing credit writers must follow the same lock discipline. Do not run the facade inside an existing transaction. Authorization must determine the account ID server-side.'
  }),
  projectFeature({
    topic: 16, title: 'Build ownership-aware property access and visibility rules',
    statement: 'Protect property reads, edits, and list visibility. Combine a Spring Security filter boundary with a service that loads persisted ownership rather than accepting a user-supplied owner ID.',
    requirements: [
      'Allow GET /actuator/health publicly; require ROLE_ADMIN for /api/admin/** and authentication for other endpoints.',
      'Use HTTP Basic only for this isolated exercise and retain CSRF protection. Do not disable security globally to make tests pass.',
      'Reject absent, unauthenticated, and anonymous principals before reading resource data.',
      'Read and write access requires the persisted owner or ROLE_ADMIN. A missing property produces NoSuchElementException; another owner produces AccessDeniedException.',
      'List queries must filter by the authenticated user ID in the repository, unless the principal is an administrator. Do not fetch all rows and filter them in Java.',
      'Use numeric principal names for ordinary users, reject invalid names, and return immutable visible results.'
    ],
    imports: 'import java.util.*;\nimport org.springframework.context.annotation.*;\nimport org.springframework.security.config.annotation.web.builders.HttpSecurity;\nimport org.springframework.security.config.Customizer;\nimport org.springframework.security.core.Authentication;\nimport org.springframework.security.authentication.AnonymousAuthenticationToken;\nimport org.springframework.security.access.AccessDeniedException;\nimport org.springframework.security.web.SecurityFilterChain;\nimport org.springframework.stereotype.Service;',
    model: `record OwnedProperty(long id, long ownerId, String city) {}
interface OwnedProperties {
    Optional<OwnedProperty> find(long id);
    List<OwnedProperty> findByOwnerId(long ownerId);
    List<OwnedProperty> findAllForAdmin();
}`,
    units: [
      { owner: '@Configuration\nclass PropertySecurity', methods: [
        { signature: '@Bean\n    SecurityFilterChain propertyFilterChain(HttpSecurity http) throws Exception', body: `        http.authorizeHttpRequests(rules -> rules
            .requestMatchers(org.springframework.http.HttpMethod.GET, "/actuator/health").permitAll()
            .requestMatchers("/api/admin/**").hasRole("ADMIN").anyRequest().authenticated())
            .httpBasic(Customizer.withDefaults());
        return http.build();` }
      ] },
      { owner: '@Service\nclass PropertyAccess', members: '    private final OwnedProperties properties;\n    PropertyAccess(OwnedProperties properties) { this.properties = properties; }', methods: [
        { signature: 'private void requireAuthenticated(Authentication authentication)', body: `        if (authentication == null || !authentication.isAuthenticated() || authentication instanceof AnonymousAuthenticationToken)
            throw new AccessDeniedException("Authentication required");` },
        { signature: 'private boolean admin(Authentication authentication)', body: '        return authentication.getAuthorities().stream().anyMatch(authority -> authority.getAuthority().equals("ROLE_ADMIN"));' },
        { signature: 'private long userId(Authentication authentication)', body: `        try { long id = Long.parseLong(authentication.getName()); if (id > 0) return id; }
        catch (NumberFormatException ignored) { }
        throw new AccessDeniedException("Invalid principal identity");` },
        { signature: 'public OwnedProperty requireOwnerOrAdmin(long propertyId, Authentication authentication)', body: `        requireAuthenticated(authentication);
        if (propertyId <= 0) throw new IllegalArgumentException("Invalid property ID");
        OwnedProperty property = properties.find(propertyId).orElseThrow();
        if (!admin(authentication) && property.ownerId() != userId(authentication)) throw new AccessDeniedException("Not allowed");
        return property;` },
        { signature: 'public List<OwnedProperty> visible(Authentication authentication)', body: `        requireAuthenticated(authentication);
        return List.copyOf(admin(authentication) ? properties.findAllForAdmin() : properties.findByOwnerId(userId(authentication)));` }
      ] }
    ],
    expected: 'Public health works, ordinary users cannot use admin routes, another owner is denied, and list queries use the authenticated owner rather than a client parameter.',
    hints: ['Separate request authentication from resource ownership.', 'Resolve ownership from the stored row, not an input claim.', 'Check administrator authority before parsing an ordinary-user numeric ID.', 'Assert repository query selection in tests for list visibility.'],
    explanation: ['A protected URL is not sufficient authorization for a specific property.', 'Filtering at the repository boundary avoids leaking another owner’s records through a broad list query.', 'Basic-auth credentials may be attached automatically by browsers, so CSRF remains enabled in this example. Production transport and identity setup are separate requirements.'],
    notes: 'Setup: starter-security, starter-web, user authentication beans, and OwnedProperties. Test filter behavior with spring-security-test, including csrf() for state-changing requests. Separately test owner/admin/anonymous cases, malformed principals, missing rows, and repository interactions. Actual read/write services must invoke the ownership boundary before performing operations; this scaffold does not auto-protect arbitrary service calls.'
  })
];
