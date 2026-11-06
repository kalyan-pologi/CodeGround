import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { challenges } from '../practice/src/data/challenges.js';
import { javaPracticeTasks } from '../src/java-practice-tasks.js';
import { projectTopicTasks } from '../src/project-topic-tasks.js';
import { sampleChecksFor, assessSample } from '../src/exercise-samples.js';

assert.ok(assessSample({ status: { id: 3 }, stdout: 'ok\r\n', exit_code: 0 }, { expected: 'ok' }));
assert.ok(!assessSample({ status: { id: 3 }, stdout: 'wrong\n' }, { expected: 'ok' }));
assert.ok(!assessSample({ status: { id: 6 }, stdout: 'ok' }, { expected: 'ok' }));
assert.ok(!assessSample({ status: { id: 3 }, stdout: ' ok' }, { expected: 'ok' }));
const entries = [...projectTopicTasks.map(task => ({ task, kind: 'task' })), ...javaPracticeTasks(challenges).map(task => ({ task, kind: 'challenge' }))];
const runnable = entries.filter(({ task }) => task.runtime !== 'project');
for (const entry of entries) assert.equal(sampleChecksFor(entry.task, entry.kind).length, entry.task.runtime === 'project' ? 0 : 1);
const imports = new Set(runnable.flatMap(({ task }) => task.solution.match(/^import .+;/gm) || []));
const classes = runnable.map(({ task }, index) => task.solution.replace(/^import .+;\r?\n/gm, '').replace('public class Main', 'class Sample' + index)).join('\n');
const calls = runnable.map(({ task, kind }, index) => {
  const sample = sampleChecksFor(task, kind)[0];
  return `capture.reset(); System.setOut(new java.io.PrintStream(capture)); Sample${index}.main(args); System.setOut(original);
if (!capture.toString(java.nio.charset.StandardCharsets.UTF_8).replace("\\r\\n", "\\n").stripTrailing().equals(${JSON.stringify(sample.expected)})) throw new AssertionError(${JSON.stringify(kind + ' ' + task.id)} + ": " + capture);
`;
}).join('\n');
const source = [...imports].join('\n') + '\npublic class Main { public static void main(String[] args) throws Exception { java.io.PrintStream original = System.out; var capture = new java.io.ByteArrayOutputStream();\n' + calls + '\nSystem.out.println("All reference sample outputs verified."); } }\n' + classes;
const directory = mkdtempSync(path.join(tmpdir(), 'codeground-samples-'));
try {
  const file = path.join(directory, 'Main.java'); writeFileSync(file, source);
  const result = spawnSync('java', ['--source', '17', file], { encoding: 'utf8', timeout: 60000, windowsHide: true });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  console.log(result.stdout.trim());
  console.log('Verified ' + runnable.length + ' runnable sample checks across both banks, with no browser checks offered for project-only exercises.');
} finally {
  const relative = path.relative(path.resolve(tmpdir()), path.resolve(directory));
  if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) rmSync(directory, { recursive: true, force: true });
}
