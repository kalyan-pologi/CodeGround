import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { projectChallenges, projectMcqs } from '../src/features/backend-practice/reidy/project-exercises.js';
import { challenges } from '../src/features/backend-practice/java-backend/data/challenges.js';
import { mcqs } from '../src/features/backend-practice/java-backend/data/mcqs.js';
import { projectTopicTasks } from '../src/features/backend-practice/reidy/project-topic-tasks.js';
import { topics } from '../src/features/backend-practice/java-backend/data/topics.js';
import { productionScenarios } from '../src/features/backend-practice/reidy/production-scenarios.js';
import { productionExercises } from '../src/features/backend-practice/reidy/production-exercises.js';
import { reidyStoryScenarios } from '../src/features/backend-practice/reidy/reidy-story-scenarios.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/data/catalog.json'), 'utf8'));
const resolveFeatureNote = (base, file) => {
  const directory = path.join(root, base);
  const match = fs.readdirSync(directory, { recursive: true }).find(entry => path.basename(entry) === path.basename(file));
  return match ? path.join(directory, match) : path.join(directory, path.basename(file));
};
const keys = new Set();
for (const note of catalog) {
  const key = `${note.repo}/${note.id}`;
  assert.ok(!keys.has(key), `Duplicate note key: ${key}`); keys.add(key);
  const aliases = {
    'library/sd/notes/': 'src/features/system-design/notes/',
    'library/genai/notes/': 'src/features/genai/notes/'
  };
  const featureFile = Object.entries(aliases).reduce((value, [prefix, replacement]) => value.startsWith(prefix) ? replacement + value.slice(prefix.length) : value, note.file);
  const notePath = featureFile.startsWith('src/features/system-design/notes/')
    ? resolveFeatureNote('src/features/system-design/notes', note.file)
    : featureFile.startsWith('src/features/genai/notes/')
      ? resolveFeatureNote('src/features/genai/notes', note.file)
      : featureFile.startsWith('features/')
        ? path.join(root, 'src', featureFile)
    : path.join(root, 'public', note.file);
  assert.ok(fs.existsSync(notePath), `Missing note: ${key}`);
}
for (const challenge of projectChallenges) {
  for (const field of ['title', 'statement', 'starter', 'solution', 'expected']) assert.ok(challenge[field], `Challenge ${challenge.id} missing ${field}`);
  assert.match(challenge.solution, /public class Main/);
}
for (const question of projectMcqs) {
  assert.equal(question.options.length, 4);
  assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4);
  assert.ok(question.explanation);
}
assert.equal(projectTopicTasks.length, 30);
assert.equal(new Set(projectTopicTasks.map(task => task.id)).size, projectTopicTasks.length);
for (const task of projectTopicTasks) {
  for (const field of ['title', 'statement', 'starter', 'solution', 'expected', 'notes', 'runtime']) assert.ok(task[field], `Task ${task.id}: missing ${field}`);
  assert.ok(task.sourceIds?.length >= 1, `Task ${task.id}: missing source mapping`);
  assert.ok(task.requirements?.length >= 3, `Task ${task.id}: needs implementation requirements`);
  assert.ok(task.hintSteps?.length >= 1, `Task ${task.id}: missing hints`);
  assert.ok(task.subtasks?.length >= 4, `Task ${task.id}: needs implementation phases`);
  assert.ok(task.files?.length >= 4, `Task ${task.id}: needs a multi-file sample codebase`);
  for (const file of task.files) {
    assert.ok(file.starter, `Task ${task.id}: empty sample file ${file.path}`);
    assert.ok(Object.hasOwn(task.fileSolutions || {}, file.path), `Task ${task.id}: missing solution file ${file.path}`);
  }
}
for (const topic of topics) {
  const topicIndex = topics.indexOf(topic) + 1;
  const task = projectTopicTasks.find(candidate => candidate.sourceIds?.includes(`topic-${topicIndex}`));
  assert.ok(task, `Missing project task coverage: ${topic}`);
  for (const field of ['title', 'statement', 'starter', 'solution', 'expected', 'pseudocode', 'notes', 'runtime']) assert.ok(task[field], `${topic}: missing ${field}`);
  assert.ok(task.requirements?.length >= 6, `${topic}: needs feature requirements`);
  assert.ok(task.hintSteps?.length >= 4, `${topic}: needs progressive hints`);
  assert.ok(task.explanation?.length >= 3, `${topic}: needs an explained solution`);
}
console.log(`Verified ${catalog.length} catalog notes and ${projectTopicTasks.length} ReidyAI tasks covering every practice topic.`);
console.log(`Full original Java Practice banks available: ${challenges.length} coding challenges and ${mcqs.length} MCQs.`);
assert.equal(productionScenarios.length, 12);
assert.equal(reidyStoryScenarios.length, 10);
assert.equal(new Set(reidyStoryScenarios.map(scenario => scenario.id)).size, reidyStoryScenarios.length);
for (const scenario of reidyStoryScenarios) {
  for (const field of ['id', 'title', 'context', 'explanation', 'deliverables']) assert.ok(scenario[field], `${scenario.id}: missing ${field}`);
  for (const field of ['symptoms', 'investigate', 'tasks', 'checks', 'hints']) assert.ok(scenario[field]?.length >= 3, `${scenario.id}: incomplete ${field}`);
}
assert.equal(new Set(productionScenarios.map(scenario => scenario.id)).size, 12);
assert.equal(new Set(productionScenarios.map(scenario => scenario.category)).size, 5);
for (const scenario of productionScenarios) {
  for (const field of ['id', 'category', 'title', 'context', 'reference', 'explanation', 'deliverables', 'language']) assert.ok(scenario[field], `${scenario.id}: missing ${field}`);
  assert.ok(scenario.symptoms?.length >= 2);
  for (const field of ['investigate', 'tasks', 'checks', 'hints']) assert.ok(scenario[field]?.length >= 3, `${scenario.id}: incomplete ${field}`);
}
console.log('Verified 12 production scenarios across five focus areas.');
assert.equal(productionExercises.length, productionScenarios.length + 10);
assert.equal(new Set(productionExercises.map(exercise => exercise.id)).size, productionExercises.length);
for (const exercise of productionExercises) {
  assert.ok(topics.includes(exercise.topic), `Unknown production topic: ${exercise.topic}`);
  assert.ok(!projectTopicTasks.filter(task => !task.scenarioId).some(task => task.sourceId === exercise.id), 'Production and topic source IDs overlap');
  assert.ok(['project', 'java'].includes(exercise.runtime));
  for (const field of ['starter', 'solution', 'expected', 'notes', 'executionNote']) assert.ok(exercise[field]);
}
assert.deepEqual(productionExercises.map(exercise => exercise.id), Array.from({ length: 22 }, (_, index) => 23 + index));
