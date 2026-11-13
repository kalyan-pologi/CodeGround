import { deepProductionLab } from './deep-production-labs.js';
import { buildCacheInsertCollisionTask } from './cache-insert-collision-lab.js';

const productionGroups = [
  { id: 'property-read-performance', title: 'Build a production property search read path', sources: ['n-plus-one', 'missing-index'], focus: 'Combine N+1 elimination, bounded fetch plans, composite indexing, query plans, and measurable read/write trade-offs.' },
  { id: 'stable-feed-pagination', title: 'Build a stable, authorized property feed', sources: ['slow-pagination', 'chat-query-latency'], focus: 'Combine keyset pagination, authorization-first loading, bounded queries, and consistent not-found behavior.' },
  { id: 'safe-credit-workflow', title: 'Build a deadlock-safe credit workflow', sources: ['deadlocks', 'lock-timeouts'], focus: 'Combine deterministic lock ordering, short transactions, remote-call isolation, rollback, and idempotent retries.' },
  { id: 'bounded-dependency-retries', title: 'Build a bounded property dependency gateway', sources: ['retry-storms'], focus: 'Centralize retries, enforce deadlines, add jitter, classify failures, and prevent side-effect retries.' },
  { id: 'cache-insert-collision', title: 'Fix concurrent rental cache insert failures', sources: ['cache-stampede'], focus: 'Reproduce the SELECT-then-INSERT race and make SQL Server insert-if-absent safe under parallel requests.' },
  { id: 'cache-aside-service', title: 'Build a resilient cache-aside service', sources: ['cache-decorator'], focus: 'Keep callers unchanged while adding freshness, fallback, metrics, invalidation, and provider-failure behavior.' },
  { id: 'cache-operations', title: 'Build an operable cache with a kill switch', sources: ['cache-kill-switch'], focus: 'Make disabled mode safe, observable, dependency-free, and reversible without restarting the application.' },
  { id: 'durable-event-delivery', title: 'Build durable ordered event delivery', sources: ['out-of-order-events', 'outbox-backlog'], focus: 'Combine inbox ordering, deduplication, outbox claims, at-least-once delivery, dead letters, and replay.' },
  { id: 'bounded-notification-workers', title: 'Build bounded notification processing', sources: ['thread-pool-exhaustion'], focus: 'Use bounded executors, admission control, durable acceptance, rejection metrics, and graceful shutdown.' },
  { id: 'safe-rollout-observability', title: 'Build a diagnosable safe rollout', sources: ['startup-observability', 'failed-deployment'], focus: 'Combine startup failure capture, health probes, readiness traffic control, graceful shutdown, and rollback evidence.' },
  { id: 'billing-idempotency', title: 'Build an idempotent billing and appraisal history', sources: ['paid-free-boundary', 'billing-history-gap'], focus: 'Separate free and paid paths, persist billable history atomically, replay completed requests, and prevent double charging.' },
  { id: 'validated-appraisal-delivery', title: 'Build validated appraisal delivery and schema compatibility', sources: ['pdf-download-config', 'land-schema-normalization'], focus: 'Combine safe storage references, input validation, nullable shared schemas, and backward-compatible responses.' },
  { id: 'atomic-comparable-refresh', title: 'Build an atomic comparable-property refresh', sources: ['replace-comps'], focus: 'Validate a complete replacement set, preserve the old state on failure, reject duplicates, and audit changes.' },
  { id: 'distributed-template-invalidation', title: 'Build secure distributed template invalidation', sources: ['notification-template-invalidation'], focus: 'Invalidate only the changed key across instances, authenticate messages, deduplicate events, and preserve unrelated cache entries.' }
];

const javaGroups = [
  { id: 'java-fundamentals-design', title: 'Build a safe Java domain model', sources: [1, 2], focus: 'Combine Java fundamentals, strings, object design, validation, equality, immutability, and defensive copying.' },
  { id: 'java-collections-streams', title: 'Build a collection and Stream analytics pipeline', sources: [3, 4], focus: 'Combine generics, collection choice, ordering, duplicate policy, collectors, lazy evaluation, and stream performance.' },
  { id: 'java-errors-time-files', title: 'Build a reliable file and time-processing service', sources: [5, 6], focus: 'Combine exception contracts, resource cleanup, UTF-8 file handling, java.time, zones, parsing, and deterministic clocks.' },
  { id: 'java-concurrency-memory', title: 'Build a thread-safe memory-aware worker', sources: [7, 8], focus: 'Combine synchronization, executors, cancellation, visibility, heap behavior, resource ownership, and leak prevention.' },
  { id: 'java-modern-reflection', title: 'Build an extensible Java runtime feature', sources: [9, 10], focus: 'Combine Java 8–21 language features, records, sealed types, reflection, annotations, and safe extension boundaries.' },
  { id: 'java-jdbc-testing', title: 'Build a tested JDBC data boundary', sources: [11, 12], focus: 'Combine SQL parameterization, transactions, resource handling, migrations, build tooling, and repeatable tests.' },
  { id: 'spring-core-di', title: 'Build a Spring dependency boundary', sources: [13], focus: 'Practice component scanning, constructor injection, configuration properties, profiles, bean scopes, and test isolation.' },
  { id: 'spring-rest-validation', title: 'Build a validated Spring REST API', sources: [14], focus: 'Practice controllers, DTO mapping, validation, error envelopes, status codes, pagination, and authorization context.' },
  { id: 'spring-jpa', title: 'Build a correct Spring Data persistence layer', sources: [15], focus: 'Practice entity boundaries, fetch plans, projections, query methods, pagination, optimistic locking, and N+1 prevention.' },
  { id: 'spring-transactions-aop', title: 'Build transactional Spring services', sources: [16], focus: 'Practice transaction boundaries, propagation, isolation, rollback rules, proxies, self-invocation, and side-effect ordering.' },
  { id: 'spring-security', title: 'Build an authorization-safe Spring API', sources: [17], focus: 'Practice authentication, method authorization, tenant ownership, password/token handling, CORS/CSRF decisions, and security tests.' },
  { id: 'spring-cache-redis', title: 'Build a Spring cache and Redis policy', sources: [18], focus: 'Practice cache-aside behavior, TTL, serialization, invalidation, failure fallback, key design, and metrics.' },
  { id: 'spring-messaging-async', title: 'Build asynchronous Spring messaging', sources: [19], focus: 'Practice message contracts, retries, acknowledgments, idempotent consumers, async executors, ordering, and dead letters.' },
  { id: 'spring-resilience', title: 'Build a resilient Spring service boundary', sources: [20], focus: 'Practice timeouts, retry ownership, circuit breakers, bulkheads, fallback policy, correlation, and graceful degradation.' },
  { id: 'spring-integration-testing', title: 'Build a production-grade Spring test suite', sources: [21], focus: 'Practice unit, slice, MockMvc, integration, Testcontainers-style boundaries, fixtures, test isolation, and regression design.' },
  { id: 'spring-observability', title: 'Build observable Spring performance paths', sources: [22], focus: 'Practice Actuator, structured logs, correlation IDs, metrics, tracing boundaries, slow-query evidence, and readiness checks.' }
];

function phaseSubtasks(task, focus) {
  const requirements = task.requirements || [];
  return [
    { title: 'Baseline and reproduce', issue: 'The current implementation hides the production failure behind a happy-path result.', impact: 'Without a reproducible baseline, a fix can appear correct while the real failure remains.', implementation: 'Run the supplied sample, capture the failing output, timings, query/attempt counts, and relevant state transitions.', edgeCases: 'Empty input, invalid input, duplicate requests, concurrent callers, and dependency failure.', verify: 'Add or run a regression test that fails before the fix and passes after it.' },
    ...requirements.map((requirement, index) => ({ title: `Implementation phase ${index + 1}`, issue: requirement, impact: 'The defect can cause incorrect data, security exposure, latency, cost, or operational instability.', implementation: requirement, edgeCases: 'Test the boundary values, retries, partial failure, ordering, ownership, and restart behavior relevant to this requirement.', verify: 'Prove the invariant with a focused unit, integration, or concurrency test and record the observable evidence.' })),
    { title: 'Production hardening', issue: 'A local happy-path fix is not enough for a long-running service.', impact: 'Unbounded work, unclear ownership, or missing telemetry can recreate the incident under load.', implementation: `Apply the combined focus: ${focus}`, edgeCases: 'Timeouts, cancellation, process restart, stale data, duplicate delivery, and backward compatibility.', verify: 'Document the metric, log, trace, or database evidence that would confirm the fix in production.' }
  ];
}

function mergeTasks(primary, sources, focus, title, id, labId = '') {
  const merged = {
    ...primary,
    id,
    title,
    sourceIds: sources.map(source => source.scenarioId || `topic-${source.sourceId || source.id}`),
    statement: `${primary.statement} This deep lab also covers: ${focus}`,
    requirements: [...new Set(sources.flatMap(source => source.requirements || []))],
    subtasks: phaseSubtasks(primary, focus),
    hintSteps: [...new Set(sources.flatMap(source => source.hintSteps || []))],
    notes: [...new Set(sources.map(source => source.notes).filter(Boolean))].join('\n\n'),
    expected: primary.runtime === 'java'
      ? primary.expected
      : sources.map(source => source.expected).filter(Boolean).join('\n\n'),
    mergedSources: sources.map(source => source.title)
  };
  const deepLab = deepProductionLab(merged, labId);
  if (deepLab) Object.assign(merged, deepLab);
  return merged;
}

function addSampleProjectFiles(task) {
  if (task.files?.length) return task;
  const sourcePath = task.runtime === 'java' ? 'src/Main.java' : 'src/Exercise.java';
  const testPath = task.runtime === 'java' ? 'test/MainAcceptanceTest.java' : 'test/ExerciseAcceptanceTest.java';
  const config = `spring:\n  application:\n    name: java-core-${task.id}\n  profiles:\n    active: test`;
  const readme = `# ${task.title}\n\n${task.statement}\n\nImplement the requirements and verify the acceptance criteria.\n\nExpected behavior:\n${task.expected || '(defined by the tests and requirements)'}`;
  const test = `// Read-only acceptance-test contract for ${task.title}.\n// Add the corresponding tests in the Reidy Spring project before considering this lab complete.\n// Requirements: ${task.requirements?.length || 0}; source scenarios: ${(task.sourceIds || []).join(', ')}.`;
  return {
    ...task,
    files: [
      { path: sourcePath, language: 'java', starter: task.starter || '' },
      { path: 'README.md', language: 'markdown', readOnly: true, starter: readme },
      { path: testPath, language: 'java', readOnly: true, starter: test },
      { path: 'config/application-test.yml', language: 'yaml', readOnly: true, starter: config }
    ],
    fileSolutions: {
      [sourcePath]: task.solution || '',
      'README.md': readme,
      [testPath]: test,
      'config/application-test.yml': config
    }
  };
}

export function buildDeepReidyTasks(productionExercises, topicTasks) {
  const productionById = new Map(productionExercises.map(task => [task.scenarioId, task]));
  const topicById = new Map(topicTasks.map(task => [task.sourceId || task.id, task]));
  const production = productionGroups.map((group, index) => {
    const sources = group.sources.map(source => productionById.get(source)).filter(Boolean);
    if (group.id === 'cache-insert-collision') return buildCacheInsertCollisionTask(sources[0], index + 1);
    return mergeTasks(sources[0], sources, group.focus, group.title, index + 1, group.id);
  });
  const java = javaGroups.map((group, index) => {
    const sources = group.sources.map(source => topicById.get(source)).filter(Boolean);
    return addSampleProjectFiles(mergeTasks(sources[0], sources, group.focus, group.title, production.length + index + 1));
  });
  return [...production, ...java];
}

export const deepReidyGroupCounts = { production: productionGroups.length, java: javaGroups.length, total: productionGroups.length + javaGroups.length };
