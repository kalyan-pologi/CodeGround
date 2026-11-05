import assert from 'node:assert/strict';
import { mcqs } from '../src/data/mcqs.js';
import { challenges } from '../src/data/challenges.js';
import { topics, topicGroups } from '../src/data/topics.js';

assert.equal(topics.length, 22);
assert.equal(new Set(topics).size, 22);
assert.deepEqual(topicGroups.map(group => group.topics.length), [12, 10]);
for (const [bank, size, medium, hard] of [[mcqs, 100, 60, 40], [challenges, 50, 20, 30]]) {
  assert.equal(bank.length, size);
  assert.equal(new Set(bank.map(question => question.title)).size, size, 'Duplicate title');
  assert.deepEqual(bank.map(question => question.id), Array.from({ length: size }, (_, i) => i + 1));
  assert.equal(bank.filter(question => question.difficulty === 'Medium').length, medium);
  assert.equal(bank.filter(question => question.difficulty === 'Hard').length, hard);
  for (const topic of topics) assert.ok(bank.some(question => question.topic === topic), `No coverage for ${topic}`);
  for (const question of bank) {
    assert.ok(topics.includes(question.topic));
    assert.ok(question.title.trim());
    if (question.options) {
      assert.equal(question.options.length, 4);
      assert.equal(new Set(question.options).size, 4);
      assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4);
      for (const field of ['code', 'prompt', 'explanation']) assert.ok(question[field]?.trim());
    } else {
      for (const field of ['statement', 'expected', 'starter', 'solution', 'pseudocode', 'notes', 'environment'])
        assert.ok(question[field]?.trim(), `Missing ${field} in ${question.id}`);
      assert.notEqual(question.starter, question.solution);
      assert.ok(!question.solution.includes('TODO'), `Unfinished solution ${question.id}`);
    }
    for (const value of Object.values(question)) {
      if (typeof value === 'string') assert.ok(!value.includes('\uFFFD'), `Encoding error in ${question.id}`);
    }
  }
}
console.log('Data checks passed: 100 MCQs (60 medium / 40 hard), 50 challenges (20 medium / 30 hard), all 22 topics in both modes.');
