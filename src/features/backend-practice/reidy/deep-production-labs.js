const specById = {
  'property-read-performance': ['PropertyRead', 'bounded property reads, owner authorization, batch loading, and index evidence'],
  'stable-feed-pagination': ['Feed', 'authorized keyset pagination, compound cursors, and bounded query budgets'],
  'safe-credit-workflow': ['CreditTransfer', 'stable lock ordering, rollback, sufficient balance, and idempotency'],
  'bounded-dependency-retries': ['DependencyGateway', 'one retry owner, deadlines, jitter, failure classification, and cancellation'],
  'coherent-rental-cache': ['RentalCache', 'token-owned leases, versioned keys, single-flight loading, and stale-write protection'],
  'cache-aside-service': ['CacheAside', 'freshness, provider fallback, invalidation, metrics, and unchanged callers'],
  'cache-operations': ['CacheOperations', 'safe kill-switch behavior, lazy initialization, diagnostics, and recovery'],
  'durable-event-delivery': ['EventDelivery', 'inbox deduplication, ordered draining, outbox claims, dead letters, and replay'],
  'bounded-notification-workers': ['Notification', 'bounded executors, durable acceptance, rejection metrics, and graceful shutdown'],
  'safe-rollout-observability': ['Rollout', 'startup evidence, health probes, readiness traffic control, and rollback safety'],
  'billing-idempotency': ['Billing', 'free/paid separation, atomic history, locked balance changes, and replay'],
  'validated-appraisal-delivery': ['AppraisalDelivery', 'nullable schema validation, safe blob names, and signed downloads'],
  'atomic-comparable-refresh': ['ComparableRefresh', 'validated replacement, duplicate rejection, atomic persistence, and rollback'],
  'distributed-template-invalidation': ['TemplateInvalidation', 'trusted messages, one-key invalidation, deduplication, and metrics']
};

const java = (name, body) => `class ${name} {\n${body}\n}`;

export function deepProductionLab(task, groupId) {
  const spec = specById[groupId];
  if (!spec || groupId === 'property-read-performance') return null;
  const [prefix, focus] = spec;
  const service = `${prefix}Service`;
  const repository = `${prefix}Repository`;
  const controller = `${prefix}Controller`;
  const readme = `# ${task.title}\n\n${task.statement}\n\nFocus: ${focus}.\n\nArchitecture: Controller -> Service -> Repository -> dependency boundary.\n\nImplementation phases:\n1. Reproduce the production failure and capture baseline evidence.\n2. Implement validation, authorization, and the service boundary.\n3. Implement persistence/cache/messaging behavior.\n4. Add failure, concurrency, retry, and restart tests.\n5. Document metrics, logs, and recovery behavior.\n\nThe TODOs are intentional. The read-only acceptance contract describes the behavior your implementation must prove.`;
  const domain = `record ${prefix}Command(String key, long ownerId, int amount) {}\nrecord ${prefix}Result(String key, String status) {}`;
  const controllerCode = java(controller, `    private final ${service} service;\n    ${controller}(${service} service) { this.service = service; }\n\n    Object handle(${prefix}Command command) {\n        // TODO: map transport input, identity, validation errors, and response status.\n        return service.execute(command);\n    }`);
  const repositoryCode = java(repository, `    java.util.Map<String, ${prefix}Result> state = new java.util.HashMap<>();\n\n    java.util.Optional<${prefix}Result> find(String key) {\n        // TODO: authorize, query with the correct index/lock/claim, and preserve state transitions.\n        return java.util.Optional.ofNullable(state.get(key));\n    }\n\n    void save(${prefix}Result result) {\n        // TODO: persist atomically and make the operation safe under retries.\n        state.put(result.key(), result);\n    }`);
  const serviceStarter = java(service, `    private final ${repository} repository;\n    ${service}(${repository} repository) { this.repository = repository; }\n\n    ${prefix}Result execute(${prefix}Command command) {\n        // TODO: ${focus}.\n        // TODO: preserve the invariant across partial failure and duplicate requests.\n        throw new UnsupportedOperationException("Implement the production contract");\n    }`);
  const serviceSolution = java(service, `    private final ${repository} repository;\n    ${service}(${repository} repository) { this.repository = repository; }\n\n    ${prefix}Result execute(${prefix}Command command) {\n        if (command == null || command.key() == null || command.key().isBlank()) throw new IllegalArgumentException("invalid command");\n        return repository.find(command.key()).orElseGet(() -> {\n            ${prefix}Result result = new ${prefix}Result(command.key(), "completed");\n            repository.save(result);\n            return result;\n        });\n    }`);
  const testCode = `class ${service}AcceptanceTest {\n    static void run() {\n        // Fixed acceptance contract: add tests for baseline, happy path, invalid input,\n        // duplicate/retry behavior, concurrent callers, dependency failure, and recovery.\n        // A returned value alone is not sufficient evidence for this lab.\n    }\n}`;
  const config = `spring:\n  application:\n    name: ${groupId}\n  profiles:\n    active: test\nmanagement:\n  endpoints:\n    web:\n      exposure:\n        include: health,metrics`;
  const files = [
    { path: 'README.md', language: 'markdown', readOnly: true, starter: readme },
    { path: 'src/Domain.java', language: 'java', readOnly: true, starter: domain },
    { path: `src/${controller}.java`, language: 'java', starter: controllerCode },
    { path: `src/${service}.java`, language: 'java', starter: serviceStarter },
    { path: `src/${repository}.java`, language: 'java', starter: repositoryCode },
    { path: `test/${service}AcceptanceTest.java`, language: 'java', readOnly: true, starter: testCode },
    { path: 'config/application-test.yml', language: 'yaml', readOnly: true, starter: config }
  ];
  const fileSolutions = Object.fromEntries(files.map(file => [file.path, file.path === `src/${service}.java` ? serviceSolution : file.starter]));
  return { files, fileSolutions, executionNote: 'Project lab: implement and verify this contract in the Reidy Spring Boot project. The browser view supplies the sample codebase; database, Redis, Kafka, and deployment behavior must be verified in the project environment.' };
}
