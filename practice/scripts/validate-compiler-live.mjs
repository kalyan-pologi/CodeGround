import assert from 'node:assert/strict';
import { executeJava } from '../src/services/compiler.js';

// These are real network submissions, never fixture responses.
const cases = [
  { name: 'success with stdin', source: 'public class Main { public static void main(String[] args) { System.out.println("Hello, " + new java.util.Scanner(System.in).nextLine()); } }', stdin: 'Ada\n', status: 3, output: 'Hello, Ada\n' },
  { name: 'compilation error', source: 'public class Main { public static void main(String[] args) { System.out.println("missing semicolon") } }', status: 6 },
  { name: 'runtime exception', source: 'public class Main { public static void main(String[] args) { throw new IllegalStateException("runtime-test"); } }', status: 11 },
];
let passed = 0;
for (const entry of cases) {
  try {
    const result = await executeJava(entry.source, entry.stdin || '', { timeoutMs: 20000 });
    assert.equal(result.status.id, entry.status, JSON.stringify(result));
    if (entry.output) assert.equal(result.stdout, entry.output);
    if (entry.status === 6) assert.ok(result.compile_output?.trim(), 'Missing compiler diagnostics');
    if (entry.status === 11) assert.ok(result.stderr?.includes('IllegalStateException'), 'Missing runtime diagnostics');
    console.log(`PASS: ${entry.name}: ${result.status.description}`);
    passed++;
  } catch (error) { console.error(`NOT VERIFIED: ${entry.name}: ${error.message}`); }
}
if (passed !== cases.length) process.exitCode = 1;
