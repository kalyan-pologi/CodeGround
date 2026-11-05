import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const executable = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(executable, 'A local Chromium browser is required for this smoke check.');
const url = process.env.CODEGROUND_URL || 'http://127.0.0.1:5173/';
assert.equal((await fetch(url)).status, 200);
const profile = mkdtempSync(path.join(tmpdir(), 'codeground-browser-'));
const browser = spawn(executable, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--disable-sync', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; !existsSync(portFile) && i < 150; i++) await pause(100);
  const [port, endpoint] = readFileSync(portFile, 'utf8').trim().split(/\r?\n/);
  socket = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const requests = new Map();
  const errors = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    const request = requests.get(message.id);
    if (!request) return;
    requests.delete(message.id); clearTimeout(request.timer);
    message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
  };
  function command(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 20000);
      requests.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  const { targetId } = await command('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
  await command('Runtime.enable', {}, sessionId);
  await command('Page.enable', {}, sessionId);
  await command('Page.navigate', { url }, sessionId);
  async function evaluate(expression) {
    const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    assert.ok(!result.exceptionDetails, result.exceptionDetails?.exception?.description);
    return result.result.value;
  }
  async function until(expression) {
    for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await pause(100); }
    throw new Error(`Browser condition failed: ${expression}`);
  }
  await until(`document.querySelectorAll('[data-tab]').length === 7`);
  assert.equal(await evaluate(`document.querySelectorAll('.card').length`), 6);
  for (const route of ['backend/interview/java-topics', 'devops/interview/docker', 'web/interview/react', 'sd/sd/home', 'genai/genai/home', 'home/interview/behavioral-stories']) {
    await evaluate(`location.hash = ${JSON.stringify(route)}`);
    const noteKey = route.split('/').slice(1).join('/');
    await until(`document.querySelector('iframe')?.dataset.note === ${JSON.stringify(noteKey)} && Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('h1,h2'))`);
    assert.ok(await evaluate(`document.querySelector('iframe').contentDocument.querySelector('h1,h2') !== null`), route);
  }
  await evaluate(`location.hash = 'backend/interview/java-topics'`);
  await until(`document.querySelector('iframe')?.dataset.note === 'interview/java-topics' && Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('h1'))`);
  assert.equal(await evaluate(`performance.getEntriesByType('resource').filter(entry => new URL(entry.name).pathname.endsWith('/library/interview/notes/java-topics.html')).length`), 1, 'Revisiting a note should reuse its cached response');
  await evaluate(`location.hash = 'genai/genai/llm'`);
  await until(`document.querySelector('.reader-bar')?.textContent.includes('LLMs') && Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('link[href$="reader.css"]')?.sheet)`);
  await until(`(() => { const frame = document.querySelector('iframe'); if (!frame?.contentWindow || !frame.contentDocument?.scrollingElement) return false; frame.contentWindow.scrollTo(0, 500); return frame.contentDocument.scrollingElement.scrollTop > 0; })()`);
  await until(`document.querySelectorAll('.sidebar .topic-group').length > 3`);
  await evaluate(`document.querySelectorAll('.sidebar details').forEach(group => group.open = true)`);
  assert.ok(await evaluate(`(() => { const sidebar = document.querySelector('.sidebar'); sidebar.scrollTop = 500; return sidebar.scrollTop > 0; })()`), 'GenAI sidebar must scroll independently');
  await evaluate(`location.hash = 'practice/tasks'`);
  await until(`document.querySelectorAll('.task').length === 4`);
  await evaluate(`location.hash = 'practice/workspace'`);
  await until(`document.querySelector('iframe')?.contentDocument?.body?.textContent?.includes('Calculate invoice totals without floating-point drift')`);
  await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('.monaco-editor'))`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('nav button')[1].click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.body?.textContent?.includes('Overflow before assignment')`);
  await evaluate(`location.hash = 'practice/project-coding'`);
  await until(`document.querySelector('iframe')?.contentDocument?.body?.textContent?.includes('Protect an immutable property snapshot')`);
  await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('.monaco-editor'))`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('nav button')[1].click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.body?.textContent?.includes('A paid appraisal is retried')`);
  await evaluate(`location.hash = 'practice/interview/java-snippets'`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('#stream-interview-additions h3').length === 12`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('#stream-alternatives h3').length === 8`);
  await evaluate(`location.hash = 'home/interview/proj-accenture'`);
  await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('a[href="#aws"]')) && document.querySelector('.reader-bar')?.textContent.includes('Accenture')`);
  assert.equal(await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('img[src$="aws-services-for-spring-boot-table.png"]').length`), 0);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('a[href="#aws"]').click()`);
  await until(`location.hash === '#devops/interview/aws' && document.querySelector('iframe')?.contentDocument?.querySelector('img')?.naturalWidth > 0`);
  await evaluate(`document.querySelector('.search').value = 'java'; document.querySelector('.search').dispatchEvent(new Event('input'))`);
  await until(`document.querySelectorAll('.result').length > 0`);
  await evaluate(`location.hash = 'search/?q=java'`);
  await until(`document.querySelectorAll('.result').length > 0`);
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
  await evaluate(`location.hash = 'home'`);
  await until(`document.querySelectorAll('.card').length === 6`);
  assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), 'Mobile page overflows');
  await evaluate(`document.querySelector('.mobile-menu').click()`);
  assert.ok(await evaluate(`document.querySelector('.sidebar').classList.contains('open')`));
  assert.deepEqual(errors, []);
  console.log('Browser smoke checks passed: seven tabs, six note areas, project tasks, Java editor, MCQs, search, mobile layout, and no JavaScript exceptions.');
} finally {
  socket?.close(); browser.kill();
}
