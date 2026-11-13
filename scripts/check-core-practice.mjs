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
assert.equal(snippets.length, 7, 'Collections/File Handling/Date & Time question count changed unexpectedly');

const folder = mkdtempSync(join(process.cwd(), '.tmp-core-practice-'));
try {
  snippets.forEach((snippet, index) => {
    const file = join(folder, 'Main.java');
    writeFileSync(file, coreProgram(snippet));
    const result = spawnSync('java', ['--source', '17', file], { encoding: 'utf8', timeout: 30000 });
    assert.equal(result.status, 0, `Question ${index + 94} failed:\n${result.stderr || result.stdout}`);
  });
} finally {
  rmSync(folder, { recursive: true, force: true });
}

console.log(`Validated ${snippets.length} Java Core questions (94-100).`);
