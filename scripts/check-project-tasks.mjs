import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { projectTopicTasks } from '../src/project-topic-tasks.js';
import { jdbcChecks, junitChecks, mvcConfiguration } from './project-task-fixtures.mjs';
const selectedArgument = process.argv.find(argument => argument.startsWith('--task='));
const selectedId = selectedArgument ? Number(selectedArgument.slice('--task='.length)) : null;
if (selectedArgument) assert.ok(projectTopicTasks.some(task => task.id === selectedId), 'Unknown task ID');

const directory = mkdtempSync(path.join(tmpdir(), 'codeground-topics-'));
function jarsIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? jarsIn(file) : entry.name.endsWith('.jar') ? [file] : [];
  });
}
function dependencyClasspath(root) {
  const selected = new Map();
  const versions = new Intl.Collator('en', { numeric: true });
  const conflictingLogging = new Set(['commons-logging', 'slf4j-simple', 'slf4j-nop', 'slf4j-jdk14', 'slf4j-log4j12', 'log4j-slf4j2-impl']);
  for (const file of jarsIn(root)) {
    const version = path.basename(path.dirname(file));
    const artifact = path.basename(path.dirname(path.dirname(file)));
    if (conflictingLogging.has(artifact) || path.basename(file) !== `${artifact}-${version}.jar`) continue;
    const key = path.dirname(path.dirname(file));
    if (!selected.has(key) || versions.compare(version, selected.get(key).version) > 0) selected.set(key, { version, file });
  }
  return [...selected.values()].map(entry => entry.file).join(path.delimiter);
}
const classpath = process.env.CODEGROUND_MAVEN_REPO ? dependencyClasspath(process.env.CODEGROUND_MAVEN_REPO) : '';
let ran = 0, compiled = 0;
try {
  for (const task of projectTopicTasks) {
    if (task.scenarioId) continue; // Contextual incident labs require their infrastructure fixtures.
    if (selectedId !== null && task.id !== selectedId) continue;
    if (process.argv.includes('--fixtures-only') && ![11, 12, 21].includes(task.id)) continue;
    if (process.argv.includes('--project-only') && task.runtime === 'java') continue;
    if (task.runtime === 'project' && !classpath) continue;
    const taskDirectory = path.join(directory, String(task.id));
    mkdirSync(taskDirectory);
    const file = path.join(taskDirectory, task.runtime === 'java' ? 'Main.java' : 'Task.java');
    const packageName = `exercise.task${task.id}`;
    writeFileSync(file, task.runtime === 'java' ? task.solution : `package ${packageName};\n${task.solution}`);
    let result;
    if (task.runtime === 'java') {
      result = spawnSync('java', ['--source', '17', file], { encoding: 'utf8', timeout: 30000, windowsHide: true });
      if (result.error) throw result.error;
      assert.equal(result.status, 0, `${task.topic}: ${result.stderr}`);
      assert.equal(result.stdout.replaceAll('\r\n', '\n').trim(), task.expected.trim(), task.title);
      ran++;
    } else {
      const quote = value => JSON.stringify(value.replaceAll('\\', '/'));
      const argumentFile = path.join(taskDirectory, 'javac.args');
      writeFileSync(argumentFile, ['--release', '17', '-proc:none', '-parameters', '-classpath', quote(classpath), '-d', quote(taskDirectory), quote(file)].join('\n'));
      result = spawnSync('javac', [`@${argumentFile}`], { encoding: 'utf8', timeout: 30000, windowsHide: true });
      if (result.error) throw result.error;
      assert.equal(result.status, 0, `${task.topic}: ${result.stderr}`);
      compiled++;
      if ([11, 12, 21].includes(task.id)) {
        const fixtureName = task.id === 11 ? 'JdbcChecks' : 'JunitChecks';
        const fixtureFile = path.join(taskDirectory, `${fixtureName}.java`);
        writeFileSync(fixtureFile, `package ${packageName};\n${task.id === 11 ? jdbcChecks : junitChecks}`);
        const fixtureSources = [fixtureFile];
        if (task.id === 21) {
          const configurationFile = path.join(taskDirectory, 'ExerciseApplication.java');
          writeFileSync(configurationFile, `package ${packageName};\n${mvcConfiguration}`);
          fixtureSources.push(configurationFile);
        }
        const runtimeClasspath = taskDirectory + path.delimiter + classpath;
        writeFileSync(argumentFile, ['--release', '17', '-proc:none', '-parameters', '-classpath', quote(runtimeClasspath), '-d', quote(taskDirectory), ...fixtureSources.map(quote)].join('\n'));
        const compileFixture = spawnSync('javac', [`@${argumentFile}`], { encoding: 'utf8', timeout: 30000, windowsHide: true });
        if (compileFixture.error) throw compileFixture.error;
        assert.equal(compileFixture.status, 0, compileFixture.stderr);
        const testClass = task.id === 12 ? 'CreditWalletTest' : 'PropertyApiTest';
        const runtimeFile = path.join(taskDirectory, 'java.args');
        writeFileSync(runtimeFile, ['-classpath', quote(runtimeClasspath), `${packageName}.${fixtureName}`,
          ...(task.id === 11 ? [] : [`${packageName}.${testClass}`])].join('\n'));
        const executed = spawnSync('java', [`@${runtimeFile}`], { encoding: 'utf8', timeout: 45000, windowsHide: true });
        if (executed.error) throw executed.error;
        assert.equal(executed.status, 0, `${task.topic}: ${executed.stdout}\n${executed.stderr}`);
        console.log(executed.stdout.trim().split(/\r?\n/).at(-1));
      }
    }
    console.log(`Passed: ${task.topic}`);
  }
  console.log(`Executed ${ran} standalone solutions; compiled ${compiled} project-context solutions.`);
  if (!classpath) console.log('Set CODEGROUND_MAVEN_REPO to an existing Maven cache to compile the JDBC, JUnit, and Spring solutions.');
} finally {
  const relative = path.relative(path.resolve(tmpdir()), path.resolve(directory));
  if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) rmSync(directory, { recursive: true, force: true });
}
