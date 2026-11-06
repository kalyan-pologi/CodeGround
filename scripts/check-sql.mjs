import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { sqlExercise } from '../src/sql-exercises.js';

const SQL = await initSqlJs();
const html = readFileSync(new URL('../public/library/interview/notes/sql-snippets.html', import.meta.url), 'utf8');
const snippets = [...html.matchAll(/<pre><code>([\s\S]*?)<\/code><\/pre>/g)].map(match => match[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"'));
let ran = 0;
for (const snippet of snippets) {
  const exercise = sqlExercise(snippet);
  if (!exercise.runnable) continue;
  const db = new SQL.Database();
  try {
    db.run(exercise.setup);
    const results = db.exec(exercise.solution);
    if (snippet.includes('ON DELETE SET NULL')) assert.deepEqual(results.at(-1).values, [[1, null], [2, 2]]);
    if (snippet.includes('ON DELETE CASCADE')) assert.deepEqual(results.at(-1).values, [[2, 2]]);
    if (snippet.includes('ISDATE')) {
      assert.equal(results[0].values[0][0], 1);
      assert.equal(db.exec(exercise.solution.replace('2020-01-04', '2023-02-30'))[0].values[0][0], 0);
    }
    if (exercise.preview) db.exec(exercise.preview);
    ran++;
  } catch (error) { throw new Error(`${snippet}\n${error.message}`); }
  finally { db.close(); }
}
assert.equal(ran, snippets.length - 1);
console.log(`Executed ${ran} SQL solutions; MySQL stored procedure retained as a reference.`);
