import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { streamApproaches } from '../src/features/backend-practice/java-stream/stream-approaches.js';

const model = `import java.util.*;
import java.util.function.*;
import java.util.stream.*;
public class Main {
    record Employee(int id, String first, String last, String department, double salary, int age) {
        int getId() { return id; }
        String getFullName() { return first + " " + last; }
        String getDepartment() { return department; }
        double getSalary() { return salary; }
        int getAge() { return age; }
        String getEmail() { return first.toLowerCase(Locale.ROOT) + "@example.com"; }
    }
    static List<Employee> employees;
    static List<String> names;
    static List<Integer> numbers;
    static String current;
    static void reset() {
        employees = List.of(new Employee(1, "Ada", "One", "IT", 6000, 25),
            new Employee(2, "Bob", "Two", "IT", 9000, 30),
            new Employee(3, "Cara", "Three", "HR", 7000, 35),
            new Employee(4, "Dan", "Four", "HR", 2000, 40),
            new Employee(5, "Eve", "Five", "IT", 9000, 20));
        names = List.of("alice", "apple", "bob", "bat", "apple", "cat");
        numbers = List.of(1, 2, 3, 4, 5, 5, 6, 7, 8, 9, 7, 10);
    }
    static void check(boolean condition) { if (!condition) throw new AssertionError(current); }
`;
const methods = streamApproaches.map((example, index) => {
  assert.ok(example.question && example.title && example.code && example.choose && example.check);
  return `static void example${index}() {\n${example.code}\n${example.check}\n}`;
}).join('\n');
const calls = streamApproaches.map((example, index) =>
  `reset(); current = ${JSON.stringify(example.question + ' / ' + example.title)}; example${index}();`).join('\n');
const source = `${model}\n${methods}\npublic static void main(String[] args) {\n${calls}\nSystem.out.println("Passed ${streamApproaches.length} Stream alternative examples");\n}\n}`;
const directory = mkdtempSync(path.join(tmpdir(), 'codeground-streams-'));
try {
  const file = path.join(directory, 'Main.java'); writeFileSync(file, source);
  const result = spawnSync('java', ['--source', '17', file], { encoding: 'utf8', timeout: 30000, windowsHide: true });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  console.log(result.stdout.trim());
} finally {
  const relative = path.relative(path.resolve(tmpdir()), path.resolve(directory));
  if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) rmSync(directory, { recursive: true, force: true });
}
