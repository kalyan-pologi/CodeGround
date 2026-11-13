import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { futureProgram } from '../src/features/backend-practice/java-stream/future-runner.js';

const html = readFileSync(new URL('../src/features/backend-practice/java-stream/questions.html', import.meta.url), 'utf8');
const start = html.indexOf('<h2>CompletableFuture</h2>');
const end = html.indexOf('<h2>', start + 10);
const section = html.slice(start, end < 0 ? undefined : end);
const decode = value => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
const snippets = [...section.matchAll(/<pre><code>([\s\S]*?)<\/code><\/pre>/g)].map(match => decode(match[1]));
assert.equal(snippets.length, 5, 'CompletableFuture question count changed unexpectedly');
const expectedOutputs = new Map([
  [0, 'message = Hello (5)'],
  [1, 'combined = Hi, Maya!\nchained = Hi again'],
  [2, 'all = alpha,beta\nfirst = fast'],
  [3, 'observed = true\nrecovered = fallback\nhandled = OK'],
  [4, 'fallback = fallback\ntimeout = timed out\ncancelled = true']
]);

const folder = mkdtempSync(join(process.cwd(), '.tmp-completable-future-'));
try {
  snippets.forEach((snippet, index) => {
    const file = join(folder, 'Main.java');
    writeFileSync(file, futureProgram(snippet));
    const result = spawnSync('java', ['--source', '17', file], { encoding: 'utf8', timeout: 30000 });
    assert.equal(result.status, 0, `Question ${index + 1} failed:\n${result.stderr || result.stdout}`);
    if (expectedOutputs.has(index)) assert.equal(result.stdout.replace(/\r\n/g, '\n').trim(), expectedOutputs.get(index), `Question ${index + 1} output changed`);
  });
} finally {
  rmSync(folder, { recursive: true, force: true });
}

console.log(`Validated ${snippets.length} CompletableFuture questions.`);
