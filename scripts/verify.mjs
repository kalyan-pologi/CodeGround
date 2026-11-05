import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { projectChallenges, projectMcqs } from '../src/project-exercises.js';
import { challenges } from '../practice/src/data/challenges.js';
import { mcqs } from '../practice/src/data/mcqs.js';
import { projectTopicTasks } from '../src/project-topic-tasks.js';
import { topics } from '../practice/src/data/topics.js';
import { productionScenarios } from '../src/production-scenarios.js';
import { productionExercises } from '../src/production-exercises.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/catalog.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'migration-manifest.json'), 'utf8'));
let verifiedFiles = 0;
for (const entry of manifest) {
  // Archived source documents were intentionally ignored by the original repo.
  // Verify them when present locally, without requiring them in a public checkout.
  if (entry.localOnly && !fs.existsSync(path.join(root, entry.file))) continue;
  const bytes = fs.readFileSync(path.join(root, entry.file));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), entry.adaptedSha256 || entry.sha256, `Imported file differs: ${entry.file}`);
  verifiedFiles++;
}
const keys = new Set();
for (const note of catalog) {
  const key = `${note.repo}/${note.id}`;
  assert.ok(!keys.has(key), `Duplicate note key: ${key}`); keys.add(key);
  assert.ok(fs.existsSync(path.join(root, 'public', note.file)), `Missing note: ${key}`);
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
assert.equal(projectTopicTasks.length, topics.length + productionExercises.length);
assert.equal(new Set(projectTopicTasks.map(task => task.id)).size, projectTopicTasks.length);
assert.equal(new Set(projectTopicTasks.map(task => task.topic)).size, topics.length);
for (const topic of topics) {
  const task = projectTopicTasks.find(task => task.topic === topic);
  assert.ok(task, `Missing project task: ${topic}`);
  for (const field of ['title', 'statement', 'starter', 'solution', 'expected', 'pseudocode', 'notes', 'runtime']) assert.ok(task[field], `${topic}: missing ${field}`);
  assert.ok(task.requirements?.length >= 6, `${topic}: needs feature requirements`);
  assert.ok(task.hintSteps?.length >= 4, `${topic}: needs progressive hints`);
  assert.ok(task.explanation?.length >= 3, `${topic}: needs an explained solution`);
}
console.log(`Verified ${verifiedFiles} imported/adapted files, ${catalog.length} unique notes, and ${projectTopicTasks.length} ReidyAI tasks covering every practice topic.`);
console.log(`Full original Java Practice banks available: ${challenges.length} coding challenges and ${mcqs.length} MCQs.`);
assert.equal(productionScenarios.length, 12);
assert.equal(new Set(productionScenarios.map(scenario => scenario.id)).size, 12);
assert.equal(new Set(productionScenarios.map(scenario => scenario.category)).size, 5);
for (const scenario of productionScenarios) {
  for (const field of ['id', 'category', 'title', 'context', 'reference', 'explanation', 'deliverables', 'language']) assert.ok(scenario[field], `${scenario.id}: missing ${field}`);
  assert.ok(scenario.symptoms?.length >= 2);
  for (const field of ['investigate', 'tasks', 'checks', 'hints']) assert.ok(scenario[field]?.length >= 3, `${scenario.id}: incomplete ${field}`);
}
console.log('Verified 12 production scenarios across five focus areas.');
assert.equal(productionExercises.length, productionScenarios.length);
assert.equal(new Set(productionExercises.map(exercise => exercise.id)).size, productionExercises.length);
for (const exercise of productionExercises) {
  assert.ok(topics.includes(exercise.topic), `Unknown production topic: ${exercise.topic}`);
  assert.ok(!projectTopicTasks.filter(task => !task.scenarioId).some(task => task.id === exercise.id), 'Production and topic task IDs overlap');
  assert.equal(exercise.runtime, 'project');
  for (const field of ['starter', 'solution', 'expected', 'notes', 'executionNote']) assert.ok(exercise[field]);
}
assert.deepEqual(productionExercises.map(exercise => exercise.id), Array.from({ length: 12 }, (_, index) => 23 + index));
