import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { sampleTasks } from '../src/project-sample.js';

const directory = mkdtempSync(path.join(tmpdir(), 'codeground-sample-'));
try {
  const sample = sampleTasks[0];
  const file = path.join(directory, 'Main.java');
  writeFileSync(file, sample.solution);
  const result = spawnSync('java', [file], { encoding: 'utf8', timeout: 30000, windowsHide: true });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.replaceAll('\r\n', '\n').trim(), sample.expected.trim());
  console.log('ReidyAI sample solution passed its Java checks and matches the expected output.');
} finally {
  const relative = path.relative(path.resolve(tmpdir()), path.resolve(directory));
  if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) rmSync(directory, { recursive: true, force: true });
}
