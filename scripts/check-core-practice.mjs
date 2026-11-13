import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { coreProgram } from '../src/features/backend-practice/java-stream/core-runner.js';

const html = readFileSync(new URL('../src/features/backend-practice/java-stream/questions.html', import.meta.url), 'utf8');
const start = html.indexOf('<h2>Collections</h2>');
const section = html.slice(start);
const decode = value => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
const snippets = [...section.matchAll(/<pre><code>([\s\S]*?)<\/code><\/pre>/g)].map(match => decode(match[1]));
assert.equal(snippets.length, 15, 'Collections/File Handling/Date & Time question count changed unexpectedly');
const expectedOutputs = [
  'unique = [java, sql, aws]\ncounts = {java=3, sql=2, aws=1}, duplicates = [java, sql]',
  'names = {IT=[Ada, Cara], HR=[Ben]}\ntotals = {IT=9, HR=3}',
  'top = [100, 90, 80], cutoff = 80',
  'snapshot = [Java, SQL]\nview = [Java, SQL, Cloud]',
  'first = one, remaining = [three]',
  'lines = 2, valid = true',
  'java files = [Helper.java, Main.java]',
  'content = abc, bytes = 3',
  'lines = 3, b-lines = 1',
  'name = notes.txt, size = 3, regular = true\nmissing = false',
  'date = Feb 15, 2026, months = 1',
  'start = 09:30, end = 11:00, minutes = 90',
  'hours = 3, offset changed = true, end = 2026-03-08 05:30 -05:00',
  'date = 2026-01-01, epoch = 1767225600',
  'next = 2026-01-19, invalid = true'
];
for (const [heading, next] of [['Collections', 'File Handling'], ['File Handling', 'Date &amp; Time'], ['Date &amp; Time', null]]) {
  const start = html.indexOf(`<h2>${heading}</h2>`);
  const end = next ? html.indexOf(`<h2>${next}</h2>`, start) : html.length;
  assert.ok(start >= 0 && end > start, `Missing ${heading} section`);
  assert.equal((html.slice(start, end).match(/<p><b>Q:/g) || []).length, 5, `${heading} must have five questions`);
}

const folder = mkdtempSync(join(process.cwd(), '.tmp-core-practice-'));
try {
  snippets.forEach((snippet, index) => {
    const file = join(folder, 'Main.java');
    writeFileSync(file, coreProgram(snippet));
    const result = spawnSync('java', ['--source', '17', file], { encoding: 'utf8', timeout: 30000 });
    assert.equal(result.status, 0, `Question ${index + 76} failed:\n${result.stderr || result.stdout}`);
    assert.equal(result.stdout.replace(/\r\n/g, '\n').trim(), expectedOutputs[index], `Question ${index + 76} output changed`);
  });
} finally {
  rmSync(folder, { recursive: true, force: true });
}

console.log(`Validated ${snippets.length} Java Core questions (76-90).`);
