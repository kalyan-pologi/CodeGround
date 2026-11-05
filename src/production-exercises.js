import { productionScenarios } from './production-scenarios.js';
import { topics } from '../practice/src/data/topics.js';

const topicFor = {
  'n-plus-one': 14, 'missing-index': 10, 'slow-pagination': 10,
  'deadlocks': 15, 'lock-timeouts': 15, 'retry-storms': 19,
  'cache-stampede': 17, 'stale-cache-race': 17,
  'out-of-order-events': 18, 'outbox-backlog': 18,
  'thread-pool-exhaustion': 6, 'failed-deployment': 21
};

export const productionExercises = productionScenarios.map((scenario, index) => {
  const comment = scenario.language === 'sql' ? '--' : scenario.language === 'yaml' ? '#' : '//';
  return {
    id: topics.length + index + 1, scenarioId: scenario.id,
    topic: topics[topicFor[scenario.id]], difficulty: 'Medium', runtime: 'project', language: scenario.language,
    title: scenario.title,
    environment: `Production scenario | ${scenario.category} | Project environment required`,
    statement: scenario.context,
    incident: { symptoms: scenario.symptoms, investigate: scenario.investigate },
    requirements: scenario.tasks,
    expected: scenario.checks.map((check, i) => `${i + 1}. ${check}`).join('\n'),
    starter: [`${comment} ${scenario.title}`, '',
      `${comment} TODO: reproduce the issue and capture the baseline evidence.`,
      ...scenario.tasks.map(task => `${comment} TODO: ${task}`), '',
      `${comment} Add your implementation and regression checks below.`,
      `${comment} Run the full lab in the project environment described by this scenario.`, ''].join('\n'),
    solution: scenario.reference,
    hintSteps: scenario.hints,
    pseudocode: scenario.investigate.join(' → '),
    explanation: [scenario.explanation],
    notes: scenario.deliverables,
    executionNote: 'Reproduce and verify this scenario in its project environment. The reference is a contextual remediation example; the browser Java runner does not provide the required database, Redis, Kafka, or deployment infrastructure.'
  };
});
