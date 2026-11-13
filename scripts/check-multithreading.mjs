import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { threadProgram } from '../src/features/backend-practice/java-stream/thread-runner.js';

const html = readFileSync(new URL('../src/features/backend-practice/java-stream/questions.html', import.meta.url), 'utf8');
const start = html.indexOf('<h2>Multithreading</h2>');
const end = html.indexOf('<h2>Collections</h2>', start);
const section = html.slice(start, end < 0 ? undefined : end);
const decode = value => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
const snippets = [...section.matchAll(/<pre><code>([\s\S]*?)<\/code><\/pre>/g)].map(match => decode(match[1]));
assert.equal(snippets.length, 10, 'Multithreading question count changed unexpectedly');
const expectedOutputs = [
  'thread = 3\nfuture = 7',
  'synchronized = 200, atomic = 250, adjusted = true',
  'transfers = 2, value = 42',
  'received = one,two',
  'items = [one, two]',
  'latch = 2, barriers = 2, phaser = 2',
  'matched = 2, permits = 2',
  'stopped = true, interrupted = true',
  'total = 18, completed = 3',
  'scheduled = 7, sum = 55'
];

const folder = mkdtempSync(join(process.cwd(), '.tmp-multithreading-'));
try {
  snippets.forEach((snippet, index) => {
    const file = join(folder, 'Main.java');
    writeFileSync(file, threadProgram(snippet));
    const result = spawnSync('java', ['--source', '17', file], { encoding: 'utf8', timeout: 30000 });
    assert.equal(result.status, 0, `Question ${index + 1} failed:\n${result.stderr || result.stdout}`);
    assert.equal(result.stdout.replace(/\r\n/g, '\n').trim(), expectedOutputs[index], `Question ${index + 66} output changed`);
  });
} finally {
  rmSync(folder, { recursive: true, force: true });
}

console.log(`Validated ${snippets.length} Multithreading questions.`);
