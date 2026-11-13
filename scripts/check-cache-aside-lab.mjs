import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { projectTopicTasks } from '../src/features/backend-practice/reidy/project-topic-tasks.js';

const task = projectTopicTasks.find(item => item.id === 6);
assert.equal(task?.title, 'Build a resilient cache-aside service');
assert.ok(task.files.every(file => task.fileSolutions[file.path]), 'Every Task 6 file needs a reference');

const directory = mkdtempSync(path.join(tmpdir(), 'codeground-cache-aside-'));
try {
  const sources = task.files.filter(file => file.language === 'java' && file.path !== 'src/RentalCacheWiring.java');
  const sourcePaths = sources.map(file => {
    const target = path.join(directory, path.basename(file.path));
    writeFileSync(target, task.fileSolutions[file.path]);
    return target;
  });
  writeFileSync(path.join(directory, 'Main.java'), 'class Main { public static void main(String[] args) { CacheAsideAcceptanceTest.run(); } }');
  const compile = spawnSync('javac', ['--release', '17', '-d', directory, ...sourcePaths, path.join(directory, 'Main.java')], {
    encoding: 'utf8', windowsHide: true
  });
  assert.equal(compile.status, 0, compile.stderr || compile.error?.message);
  const run = spawnSync('java', ['-cp', directory, 'Main'], { encoding: 'utf8', windowsHide: true });
  assert.equal(run.status, 0, run.stderr || run.error?.message);
  assert.match(run.stdout, /Task 6 checks passed/);
  console.log(run.stdout.trim());
} finally {
  rmSync(directory, { recursive: true, force: true });
}
