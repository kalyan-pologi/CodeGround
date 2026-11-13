import { productionScenarios } from './production-scenarios.js';
import { productionSubtaskGuidance } from './production-subtask-guidance.js';
import { productionLabFiles, productionLabSolutions, productionLabExpected } from './production-lab-files.js';
import { reidyStoryScenarios } from './reidy-story-scenarios.js';
import { projectFilesForScenario, reidyProjectRoot } from './reidy-project.js';
import { topics } from '../java-backend/data/topics.js';

const topicFor = {
  'n-plus-one': 14, 'missing-index': 10, 'slow-pagination': 10,
  'deadlocks': 15, 'lock-timeouts': 15, 'retry-storms': 19,
  'cache-stampede': 17, 'stale-cache-race': 17,
  'out-of-order-events': 18, 'outbox-backlog': 18,
  'thread-pool-exhaustion': 6, 'failed-deployment': 21,
  'paid-free-boundary': 13, 'pdf-download-config': 21, 'billing-history-gap': 10,
  'land-schema-normalization': 10, 'replace-comps': 14, 'cache-decorator': 17,
  'cache-kill-switch': 17, 'chat-query-latency': 14, 'startup-observability': 21,
  'notification-template-invalidation': 18
};

function makeExercise(scenario, id) {
  const comment = scenario.language === 'sql' ? '--' : scenario.language === 'yaml' ? '#' : '//';
  const labFiles = productionLabFiles[scenario.id];
  const runnable = Boolean(labFiles);
  const baseSolution = runnable ? labFiles.filter(file => file.language === 'java').map(file => productionLabSolutions[scenario.id][file.path] || file.starter).join('\n\n') : scenario.reference;
  const solution = scenario.id !== 'n-plus-one' ? baseSolution.replaceAll('StoryService', `StoryService${id}`).replaceAll('StoryTest', `StoryTest${id}`) : baseSolution;
  return {
    id, scenarioId: scenario.id,
    topic: topics[topicFor[scenario.id]], difficulty: 'Medium', runtime: runnable ? 'java' : 'project', language: runnable ? 'java' : scenario.language,
    title: scenario.title,
    project: { root: reidyProjectRoot, files: projectFilesForScenario(scenario.id) },
    environment: `Production scenario | ${scenario.category} | Project environment required`,
    statement: scenario.context,
    incident: { symptoms: scenario.symptoms, investigate: scenario.investigate },
    requirements: scenario.tasks,
    subtasks: productionSubtaskGuidance[scenario.id] || [],
    expected: runnable ? productionLabExpected[scenario.id] : scenario.checks.map((check, i) => `${i + 1}. ${check}`).join('\n'),
    starter: runnable ? labFiles.find(file => file.path === 'src/Main.java').starter : [`${comment} ${scenario.title}`, '',
      `${comment} TODO: reproduce the issue and capture the baseline evidence.`,
      ...scenario.tasks.map(task => `${comment} TODO: ${task}`), '',
      `${comment} Add your implementation and regression checks below.`,
      `${comment} Run the full lab in the project environment described by this scenario.`, ''].join('\n'),
    solution,
    files: labFiles,
    fileSolutions: productionLabSolutions[scenario.id],
    hintSteps: scenario.hints,
    pseudocode: scenario.investigate.join(' → '),
    explanation: [scenario.explanation],
    notes: scenario.deliverables,
    executionNote: runnable ? 'Runs a self-contained Java simulation. Edit the project files, then run Main.java; the supporting files are compiled together in the browser.' : 'Reproduce and verify this scenario in its project environment. The reference is a contextual remediation example; the browser Java runner does not provide the required database, Redis, Kafka, or deployment infrastructure.'
  };
}

const originalExercises = productionScenarios.map((scenario, index) => makeExercise(scenario, topics.length + index + 1));
const storyExercises = reidyStoryScenarios.map((scenario, index) => ({
  ...makeExercise({ ...scenario, language: 'java', hints: scenario.hints, checks: scenario.checks, reference: '', explanation: scenario.explanation, deliverables: scenario.deliverables }, topics.length + productionScenarios.length + index + 1),
  story: scenario.story,
  environment: `Production story ${scenario.story} | ${scenario.category} | Self-contained Java lab`,
  executionNote: 'Runs a self-contained Java simulation. Edit src/StoryService.java; Main.java and the regression test are fixed.',
  subtasks: scenario.tasks.map((task, taskIndex) => ({
    title: `Requirement ${taskIndex + 1}`,
    issue: 'The existing production path does not enforce this invariant.',
    impact: 'The failure can corrupt data, increase cost, or hide an operational incident.',
    implementation: task,
    edgeCases: scenario.checks[taskIndex] || 'Validate failure and retry behavior.',
    verify: scenario.checks[taskIndex] || 'Add a focused regression assertion.'
  }))
}));

export const productionExercises = [...originalExercises, ...storyExercises];
