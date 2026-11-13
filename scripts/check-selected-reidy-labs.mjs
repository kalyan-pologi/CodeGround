import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { projectTopicTasks } from '../src/features/backend-practice/reidy/project-topic-tasks.js';

const labs = [
  { id: 5, test: 'CacheInsertCollisionAcceptanceTest', exclude: ['src/SqlServerRentalCacheRepository.java'] },
  { id: 6, test: 'CacheAsideAcceptanceTest', exclude: ['src/RentalCacheWiring.java'] },
  { id: 7, test: 'CacheOperationsAcceptanceTest', exclude: ['src/RentalTransportConfig.java'] },
  { id: 11, test: 'BillingIdempotencyAcceptanceTest', exclude: ['src/SpringPaidHistoryWriter.java'] },
  { id: 12, test: 'AppraisalDeliveryAcceptanceTest', exclude: ['src/PdfDeliveryConfiguration.java'] },
  { id: 14, test: 'TemplateInvalidationAcceptanceTest', exclude: ['src/JdbcTemplateStore.java', 'src/TemplateInvalidationRedisConfig.java'] }
];

const directory = mkdtempSync(path.join(tmpdir(), 'codeground-reidy-labs-'));
try {
  for (const lab of labs) {
    const task = projectTopicTasks.find(item => item.id === lab.id);
    assert.ok(task, `Missing Task ${lab.id}`);
    assert.equal(task.runtime, 'project', `Task ${lab.id} needs project mode for its Spring and SQL files`);
    assert.ok(task.files.every(file => task.fileSolutions?.[file.path]), `Task ${lab.id} needs all solution files`);
    assert.ok(task.files.filter(file => !file.readOnly).every(file =>
      task.fileSolutions[file.path] !== file.starter), `Task ${lab.id} has an unfinished editable solution`);
    const sources = task.files.filter(file => file.language === 'java' && !lab.exclude.includes(file.path));
    const sourcePaths = sources.map(file => {
      const target = path.join(directory, `${lab.id}-${path.basename(file.path)}`);
      writeFileSync(target, task.fileSolutions[file.path]);
      return target;
    });
    // javac requires the filename of a public class to match; these samples use package-private classes.
    const main = path.join(directory, `Main${lab.id}.java`);
    writeFileSync(main, `class Main${lab.id} { public static void main(String[] args) throws Exception { ${lab.test}.run(); } }`);
    const compile = spawnSync('javac', ['--release', '17', '-d', directory, ...sourcePaths, main], {
      encoding: 'utf8', windowsHide: true
    });
    assert.equal(compile.status, 0, `Task ${lab.id}: ${compile.stderr || compile.error?.message}`);
    const run = spawnSync('java', ['-cp', directory, `Main${lab.id}`], { encoding: 'utf8', windowsHide: true });
    assert.equal(run.status, 0, `Task ${lab.id}: ${run.stderr || run.error?.message}`);
    assert.match(run.stdout, new RegExp(`Task ${lab.id} .* passed`));
    console.log(run.stdout.trim());
  }
} finally {
  assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep));
  rmSync(directory, { recursive: true, force: true });
}
