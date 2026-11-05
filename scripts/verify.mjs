import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { projectChallenges, projectMcqs } from '../src/project-exercises.js';
import { challenges } from '../practice/src/data/challenges.js';
import { mcqs } from '../practice/src/data/mcqs.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/catalog.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'migration-manifest.json'), 'utf8'));
for (const entry of manifest) {
  const bytes = fs.readFileSync(path.join(root, entry.file));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), entry.sha256, `Imported file differs: ${entry.file}`);
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
console.log(`Verified ${manifest.length} imported files byte-for-byte, ${catalog.length} unique notes, ${projectChallenges.length} coding exercises, and ${projectMcqs.length} project MCQs.`);
console.log(`Full original Java Practice banks available: ${challenges.length} coding challenges and ${mcqs.length} MCQs.`);
