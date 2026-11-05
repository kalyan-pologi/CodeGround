import test from 'node:test';
import assert from 'node:assert/strict';
import { executeJava, JUDGE0_URL, JAVA_LANGUAGE_ID } from '../src/services/compiler.js';

const response = (data, status = 200, headers) => new Response(JSON.stringify(data), { status, headers });
const source = 'public class Main { public static void main(String[] args) {} }';

test('posts Java 91 and stdin, then polls queued/processing/completed states', async t => {
  const calls = []; const statuses = [];
  const replies = [{ token: 'real-format-token' }, { status: { id: 1, description: 'In Queue' } },
    { status: { id: 2, description: 'Processing' } }, { status: { id: 3, description: 'Accepted' }, stdout: 'Hello, Ada\n' }];
  t.mock.method(globalThis, 'fetch', async (url, options) => { calls.push({ url, options }); return response(replies.shift()); });
  const result = await executeJava(source, 'Ada\n', { pollIntervalMs: 0, onStatus: status => statuses.push(status.description) });
  assert.equal(JAVA_LANGUAGE_ID, 91);
  assert.equal(calls[0].url, `${JUDGE0_URL}/submissions?base64_encoded=false`);
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), { source_code: source, language_id: 91, stdin: 'Ada\n' });
  assert.ok(calls.slice(1).every(call => call.url.startsWith(`${JUDGE0_URL}/submissions/real-format-token?base64_encoded=false`)));
  assert.deepEqual(statuses, ['Submitting...', 'In Queue', 'Processing', 'Accepted']);
  assert.equal(result.stdout, 'Hello, Ada\n');
});

for (const result of [
  { status: { id: 6, description: 'Compilation Error' }, compile_output: 'Main.java: syntax error' },
  { status: { id: 11, description: 'Runtime Error (NZEC)' }, stderr: 'java.lang.IllegalStateException: test', exit_code: 1 },
  { status: { id: 5, description: 'Time Limit Exceeded' }, stdout: null },
]) test(`returns actual result fields for ${result.status.description}`, async t => {
  let call = 0;
  t.mock.method(globalThis, 'fetch', async () => response(++call === 1 ? { token: 'token' } : result));
  assert.deepEqual(await executeJava(source), { ...result, token: 'token' });
});

for (const status of [401, 403, 429, 422, 503]) test(`reports HTTP ${status} without resubmitting`, async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return response({ error: 'provider detail' }, status, { 'Retry-After': '30' }); });
  await assert.rejects(executeJava(source), error => error.status === status && error.message.includes(String(status)) && (status !== 429 || error.message.includes('30')));
  assert.equal(calls, 1);
});

test('reports network/CORS uncertainty honestly', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(executeJava(source), /blocking browser requests \(CORS\)/);
});

test('rejects empty code without sending a submission', async t => {
  const fetch = t.mock.method(globalThis, 'fetch');
  await assert.rejects(executeJava('  '), /Enter Java code/);
  assert.equal(fetch.mock.callCount(), 0);
});

test('rejects missing tokens, invalid JSON, and malformed statuses', async t => {
  for (const replies of [[response({})], [new Response('<html>not JSON</html>')], [response({ token: 'token' }), response({ status: {} })]]) {
    t.mock.method(globalThis, 'fetch', async () => replies.shift());
    await assert.rejects(executeJava(source), /token|invalid JSON|invalid execution status/);
  }
});

test('deadline aborts a hung HTTP request', async t => {
  t.mock.method(globalThis, 'fetch', (_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }));
  await assert.rejects(executeJava(source, '', { timeoutMs: 20 }), /timed out/);
});

test('deadline also bounds polling while a submission stays queued', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => response(++calls === 1 ? { token: 'token' } : { status: { id: 1, description: 'In Queue' } }));
  await assert.rejects(executeJava(source, '', { timeoutMs: 20, pollIntervalMs: 1000 }), /timed out/);
  assert.equal(calls, 2);
});

test('caller cancellation is distinct from a provider timeout', async t => {
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', (_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }));
  const execution = executeJava(source, '', { signal: controller.signal });
  controller.abort();
  await assert.rejects(execution, error => error.name === 'AbortError');
});
