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
assert.equal(snippets.length, 20, 'Multithreading question count changed unexpectedly');

const folder = mkdtempSync(join(process.cwd(), '.tmp-multithreading-'));
try {
  snippets.forEach((snippet, index) => {
    const file = join(folder, 'Main.java');
    writeFileSync(file, threadProgram(snippet));
    const result = spawnSync('java', ['--source', '17', file], { encoding: 'utf8', timeout: 30000 });
    assert.equal(result.status, 0, `Question ${index + 1} failed:\n${result.stderr || result.stdout}`);
  });
} finally {
  rmSync(folder, { recursive: true, force: true });
}

console.log(`Validated ${snippets.length} Multithreading questions.`);
