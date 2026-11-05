import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { mcqs } from '../src/data/mcqs.js';

// Execute representative code questions with only the omitted imports/harness supplied.
// Nondeterministic races and external-service questions are reviewed against their contracts.
const cases = [
  { title: 'Overflow before assignment', answer: 1, after: 'System.out.println(total);', output: '-1794967296' },
  { title: 'Nullable database flag', answer: 3, members: 'static void send() {}', failure: 'NullPointerException' },
  { title: 'Currency precision', answer: 0, output: 'false' },
  { title: 'Aliased array backup', answer: 2, after: 'System.out.println(source[0][0]);', output: '9' },
  { title: 'String builder lookup', answer: 1, output: 'null' },
  { title: 'Hidden static method', answer: 2, output: 'base' },
  { title: 'Constructor dispatch', answer: 3, failure: 'NullPointerException' },
  { title: 'Wrong remove overload', answer: 1, after: 'System.out.println(ids);', output: '[1, 3]' },
  { title: 'Unmodifiable stream result', answer: 3, failure: 'UnsupportedOperationException' },
  { title: 'Null concurrent cache value', answer: 2, failure: 'NullPointerException' },
  { title: 'Mutable record key', answer: 1, after: 'System.out.println(map.get(key));', output: 'null' },
  { title: 'Comparator collapses customers', answer: 3, members: 'record User(int id, String city) {}', after: 'System.out.println(users.size());', output: '1' },
  { title: 'Producer wildcard', answer: 0, compileFailure: 'incompatible types' },
  { title: 'Stream consumed twice', answer: 2, output: '2', failure: 'IllegalStateException' },
  { title: 'Duplicate collector keys', answer: 0, failure: 'IllegalStateException' },
  { title: 'Eager fallback query', answer: 1, members: 'static String loadFromDatabase() { System.out.println("database"); return "loaded"; }', after: 'System.out.println(result);', output: 'database\ncached' },
  { title: 'Forgotten terminal operation', answer: 3, members: 'record Order(boolean paid) {} static String sendReceipt(Order order) { System.out.println("sent"); return "receipt"; }', before: 'var orders = List.of(new Order(true));', replace: code => code.replace('this::sendReceipt', 'Main::sendReceipt'), output: '' },
  { title: 'False concurrent collector', answer: 1, output: '' },
  { title: 'Suppressed close failure', answer: 3,
    members: 'static class Resource implements AutoCloseable { public void close() throws IOException { throw new IOException("close"); } }',
    replace: code => `try { ${code}
 } catch (IOException failure) { System.out.println(failure.getMessage()); System.out.println(failure.getSuppressed()[0].getMessage()); }`, output: 'body\nclose' },
  { title: 'Return hides pending exception', answer: 1, declaration: true, body: 'System.out.println(load());', output: '7' },
  { title: 'Ambiguous audit time', answer: 2, after: 'System.out.println(ZoneId.of("America/New_York").getRules().getValidOffsets(timestamp).size());', output: '2' },
  { title: 'Calendar day versus elapsed time', answer: 1, after: 'System.out.println(Duration.between(start, next).toHours());', output: '23' },
  { title: 'Business date conversion', answer: 0, after: 'System.out.println(date);', output: '2024-12-31' },
  { title: 'Single-worker starvation', answer: 3,
    replace: () => `var pool = Executors.newSingleThreadExecutor();
      try { var outer = pool.submit(() -> pool.submit(() -> "ok").get());
        try { outer.get(200, TimeUnit.MILLISECONDS); throw new AssertionError("Unexpected completion"); }
        catch (TimeoutException expected) { System.out.println("starved"); }
      } finally { pool.shutdownNow(); }`, output: 'starved' },
  { title: 'Sealed hierarchy extension', answer: 2, declaration: true, compileFailure: 'not allowed' },
  { title: 'Non-exhaustive switch expression', answer: 1, declaration: true, compileFailure: 'does not cover all possible' },
  { title: 'Dominated Java 21 pattern', answer: 3, declaration: true, release: '21',
    replace: code => `static String label(Object value) { ${code}\n }`, compileFailure: 'dominated' },
  { title: 'Missing annotation retention', answer: 1, replace: () => 'System.out.println(Service.class.getAnnotation(Audited.class));',
    members: '@interface Audited {} @Audited class Service {}', output: 'null' },
  { title: 'Reflective target failure', answer: 3,
    members: 'public static void fail() { throw new IllegalStateException("target"); }',
    replace: () => 'try { Main.class.getDeclaredMethod("fail").invoke(null); } catch (InvocationTargetException failure) { System.out.println(failure.getCause().getClass().getSimpleName()); }', output: 'IllegalStateException' },
  { title: 'Concrete cast of a JDK proxy', answer: 0,
    members: 'static class MyTask implements Runnable { public void run() {} }',
    before: 'ClassLoader loader = Main.class.getClassLoader(); InvocationHandler handler = (proxy, method, arguments) -> null;', failure: 'ClassCastException' },
];
const root = mkdtempSync(path.join(tmpdir(), 'java-practice-mcqs-'));
try {
  for (const test of cases) {
    const question = mcqs.find(question => question.title === test.title);
    assert.ok(question, `Missing question ${test.title}`);
    assert.equal(question.answer, test.answer, `Answer mismatch: ${test.title}`);
    const directory = path.join(root, String(question.id)); mkdirSync(directory);
    const code = test.replace ? test.replace(question.code) : question.code;
    const members = (test.members || '') + '\n' + (test.declaration ? code : '');
    const body = (test.before || '') + '\n' + (test.declaration ? test.body || '' : code) + '\n' + (test.after || '');
    writeFileSync(path.join(directory, 'Main.java'), `import java.util.*; import java.util.concurrent.*; import java.util.stream.*; import java.io.*; import java.time.*; import java.lang.reflect.*;\npublic class Main { ${members}\n public static void main(String[] args) throws Exception { ${body}\n } }`);
    const compile = spawnSync('javac', ['--release', test.release || '17', 'Main.java'], { cwd: directory, encoding: 'utf8', timeout: 30000 });
    if (test.compileFailure) {
      assert.notEqual(compile.status, 0, `Expected compile failure: ${test.title}`);
      assert.ok(compile.stderr.includes(test.compileFailure), compile.stderr);
      continue;
    }
    assert.equal(compile.status, 0, `${test.title}: ${compile.error || compile.stderr}`);
    const run = spawnSync('java', ['-cp', directory, 'Main'], { cwd: directory, encoding: 'utf8', timeout: 5000 });
    if (test.failure) {
      assert.notEqual(run.status, 0, `Expected runtime failure: ${test.title}`);
      assert.ok(run.stderr.includes(test.failure), run.stderr);
    } else assert.equal(run.status, 0, `${test.title}: ${run.error || run.stderr}`);
    if (test.output !== undefined) assert.equal(run.stdout.trim().replaceAll('\r\n', '\n'), test.output, test.title);
  }
  console.log(`${cases.length} Java MCQ snippet checks passed, including expected compiler errors, output, exceptions, DST behavior, and bounded executor starvation.`);
} finally {
  for (const folder of readdirSync(root)) {
    const directory = path.join(root, folder);
    for (const file of readdirSync(directory)) unlinkSync(path.join(directory, file));
    rmdirSync(directory);
  }
  rmdirSync(root);
}
