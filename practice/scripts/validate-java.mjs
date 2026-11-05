import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { challenges } from '../src/data/challenges.js';
import { assertions, edgeCases } from './java-edge-cases.mjs';

const outputs = {
  1: '20.00', 2: '3145728', 3: '{api=[east]}', 4: '85.00',
  5: '{1=Customer[id=1, revision=1, name=Ada], 2=Customer[id=2, revision=2, name=Lin A]}',
  6: '{x-id=[1, 2]}', 7: '[a, c]', 8: '[1, 2, 3]',
  9: '{Ada=150, Lin=80}', 10: '{a@example.com=2}', 11: '{b=2.50}', 12: '{A=5, B=1}',
  13: '{host=localhost, port=8080, token=a=b}', 14: 'complete report',
  15: '2025-01-15T17:00:00Z', 16: 'true\nfalse\n2', 17: 'loaded',
  18: 'Ada:approved', 19: 'B\nnull', 20: 'event\n0', 21: '[A, B, C]', 22: '[email, name]',
};
const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'java-practice-'));
const h2Directory = path.join(homedir(), '.m2', 'repository', 'com', 'h2database', 'h2');
const h2Version = existsSync(h2Directory) ? readdirSync(h2Directory).filter(version => version.startsWith('2.') && existsSync(path.join(h2Directory, version, `h2-${version}.jar`))).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0] : null;
const h2 = h2Version ? path.join(h2Directory, h2Version, `h2-${h2Version}.jar`) : null;
let compiled = 0;
try {
  for (const question of challenges.filter(question => question.solution.includes('public class Main {'))) {
    const directory = path.join(temporaryRoot, String(question.id));
    mkdirSync(directory);
    const release = question.environment.startsWith('Java 21') ? '21' : '17';
    for (const [name, source] of [['starter', question.starter], ['solution', question.solution]]) {
      const checkedSource = name === 'solution' ? source
        .replace('    public static void main', `${assertions}\n    public static void main`)
        .replace(/\n    }\n}\n$/, `\n${edgeCases[question.id] || ''}\n    }\n}\n`) : source;
      writeFileSync(path.join(directory, 'Main.java'), checkedSource);
      const compile = spawnSync('javac', ['--release', release, 'Main.java'], { cwd: directory, encoding: 'utf8', timeout: 30000 });
      assert.equal(compile.status, 0, `Challenge ${question.id} ${name}: ${compile.error || compile.stderr}`);
      if (name === 'solution') {
        const run = spawnSync('java', ['-Djava.practice.h2=' + Boolean(h2), '-cp', [directory, h2].filter(Boolean).join(path.delimiter), 'Main'], { cwd: directory, encoding: 'utf8', timeout: 15000 });
        assert.equal(run.status, 0, `Challenge ${question.id}: ${run.error || run.stderr}`);
        if (outputs[question.id]) assert.equal(run.stdout.trim().replaceAll('\r\n', '\n'), outputs[question.id], `Output ${question.id}`);
      }
    }
    compiled++;
  }
  console.log(`${compiled} standalone Java starters and solutions compiled; solution outputs and contract edge cases passed. ${h2 ? 'JDBC lookup and transaction/rollback cases passed against cached in-memory H2.' : 'JDBC runtime checks skipped: no cached H2 driver.'} Spring and production database integrations require their documented project context.`);
} finally {
  // Only remove individual files created in this unique temporary directory.
  for (const folder of readdirSync(temporaryRoot)) {
    const directory = path.join(temporaryRoot, folder);
    for (const file of readdirSync(directory)) unlinkSync(path.join(directory, file));
    rmdirSync(directory);
  }
  rmdirSync(temporaryRoot);
}
