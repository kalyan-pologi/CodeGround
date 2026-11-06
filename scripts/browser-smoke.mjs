import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { streamApproaches } from '../src/stream-approaches.js';
import { projectTopicTasks } from '../src/project-topic-tasks.js';
import { challenges } from '../practice/src/data/challenges.js';
import { javaPracticeTasks } from '../src/java-practice-tasks.js';
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
  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId);
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
  async function taskSearch(value) {
    await evaluate(`(() => { const doc = document.querySelector('iframe').contentDocument; const input = doc.querySelector('input[aria-label="Search tasks"]'); Object.getOwnPropertyDescriptor(doc.defaultView.HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new doc.defaultView.Event('input', { bubbles: true })); })()`);
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
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.task-title-list button').length === 34`);
  assert.ok(await evaluate(`!document.querySelector('iframe').contentDocument.querySelector('.monaco-editor')`), 'List should not load the editor');
  const projectTopics = await evaluate(`Array.from(document.querySelector('iframe').contentDocument.querySelector('select').options).map(option => option.value).filter(value => value !== 'All')`);
  assert.equal(projectTopics.length, 22);
  for (const topic of projectTopics) {
    await evaluate(`(() => { const select = document.querySelector('iframe').contentDocument.querySelector('select'); select.value = ${JSON.stringify(topic)}; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    const count = projectTopicTasks.filter(task => task.topic === topic).length;
    await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.task-title-list button').length === ${count}`);
  }
  await evaluate(`(() => { const doc = document.querySelector('iframe').contentDocument; const select = doc.querySelector('select'); select.value = 'All'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await taskSearch('catalog');
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.task-title-list button').length === 1`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('[data-task-id="3"]').click()`);
  await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('.monaco-editor'))`);
  assert.equal(await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('section[aria-label="Task requirements"] li').length`), 8);
  assert.ok(await evaluate(`(() => { const doc = document.querySelector('iframe').contentDocument; const left = doc.querySelector('.task-question-pane').getBoundingClientRect(); const right = doc.querySelector('.task-code-pane').getBoundingClientRect(); return right.left >= left.right - 1 && Math.abs(left.top - right.top) < 2; })()`), 'Question and editor must be side by side');
  await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('.view-lines .view-line'))`);
  const editorPosition = await evaluate(`(() => { const frame = document.querySelector('iframe'); const outer = frame.getBoundingClientRect(); const inner = frame.contentDocument.querySelector('.view-lines .view-line').getBoundingClientRect(); return { x: outer.left + inner.left + 40, y: outer.top + inner.top + 8 }; })()`);
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', ...editorPosition, button: 'left', clickCount: 1 }, sessionId);
  await command('Input.dispatchMouseEvent', { type: 'mouseReleased', ...editorPosition, button: 'left', clickCount: 1 }, sessionId);
  await command('Input.insertText', { text: '//draftRetentionCheck\n' }, sessionId);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.view-lines')?.textContent.includes('draftRetentionCheck')`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('.task-question-tabs button')[1].click()`);
  assert.equal(await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('section[aria-label="Step-by-step hints"] details').length`), 4);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('.task-question-tabs button')[2].click()`);
  assert.ok(await evaluate(`Boolean(document.querySelector('iframe').contentDocument.querySelector('section[aria-label="Solution explanation"]'))`));
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.back-to-tasks').click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.task-title-list button').length === 1`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('button[data-task-id="3"]').click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.view-lines')?.textContent.includes('draftRetentionCheck')`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.back-to-tasks').click()`);
  await taskSearch('');
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.task-title-list button').length === 34`);
  for (const task of projectTopicTasks) {
    await evaluate(`document.querySelector('iframe').contentDocument.querySelector('button[data-task-id="${task.id}"]').click()`);
    await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.task-detail')?.dataset.taskId === '${task.id}'`);
    assert.equal(await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.task-run').disabled`), task.runtime === 'project');
    await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.back-to-tasks').click()`);
    await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.task-title-list button').length === 34`);
  }
  await evaluate(`location.hash = 'practice/task-board'`);
  await until(`location.hash === '#practice/tasks' && document.querySelector('iframe')?.contentDocument?.querySelectorAll('.task-title-list button').length === 34`);
  assert.equal(await evaluate(`Boolean(document.querySelector('a[href="#practice/task-board"]'))`), false);
  await evaluate(`location.hash = 'practice/workspace'`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.task-title-list button').length === 50`);
  assert.equal(await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.task-list-header h1').textContent`), 'Challenges');
  for (const challenge of javaPracticeTasks(challenges)) {
    await evaluate(`document.querySelector('iframe').contentDocument.querySelector('button[data-task-id="${challenge.id}"]').click()`);
    await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.task-detail')?.dataset.taskId === '${challenge.id}'`);
    assert.equal(await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.task-run').disabled`), challenge.runtime === 'project');
    await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.back-to-tasks').click()`);
    await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.task-title-list button').length === 50`);
  }
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('button[data-task-id="1"]').click()`);
  await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('.monaco-editor'))`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('.task-question-tabs button')[2].click()`);
  await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('.load-solution'))`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.load-solution').click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.task-console')?.textContent.includes('Solution loaded')`);
  if (process.env.CODEGROUND_RUN_JAVA === '1') {
    await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.task-run').click()`);
    await until(`document.querySelector('iframe')?.contentDocument?.querySelector('[aria-label="Execution result"]')?.textContent.includes('Accepted')`, 60000);
    assert.ok(await evaluate(`document.querySelector('iframe').contentDocument.querySelector('[aria-label="Execution result"]').textContent.includes('20.00')`));
  }
  await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('nav[aria-label="Practice mode"] button')[1].click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.body?.textContent?.includes('Overflow before assignment')`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('nav[aria-label="Practice mode"] button')[0].click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.task-detail')?.dataset.taskId === '1'`);
  assert.ok(await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.task-console').textContent.includes('Solution loaded')`));
  await evaluate(`location.hash = 'practice/project-coding'`);
  await until(`document.querySelector('iframe')?.contentDocument?.body?.textContent?.includes('Protect an immutable property snapshot')`);
  await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('.monaco-editor'))`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('nav button')[1].click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.body?.textContent?.includes('A paid appraisal is retried')`);
  await evaluate(`location.hash = 'practice/workspace'`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.task-title-list button').length === 50`);
  assert.equal(await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('nav[aria-label="Practice mode"] button').length`), 2);
  assert.ok(await evaluate(`!document.querySelector('iframe').contentDocument.body.textContent.includes('Production scenarios')`));
  await evaluate(`location.hash = 'practice/tasks?task=23'`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.task-detail')?.dataset.taskId === '23'`);
  assert.equal(await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('section[aria-label="Task question"] li').length > 0`), true);
  assert.ok(await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.task-run').disabled`));
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.back-to-tasks').click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.task-title-list button').length === 34`);
  assert.equal(await evaluate(`Array.from(document.querySelector('iframe').contentDocument.querySelectorAll('.task-row-title small')).filter(element => element.textContent.includes('Production scenario')).length`), 12);
  await evaluate(`location.hash = 'practice/interview/java-snippets'`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('p[data-stream-added-question]').length === 12`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.stream-alternative').length === ${streamApproaches.length}`);
  const originalQuestions = (readFileSync(new URL('../public/library/interview/notes/java-snippets.html', import.meta.url), 'utf8').match(/<p><b>Q:/g) || []).length;
  assert.equal(await evaluate(`Array.from(document.querySelector('iframe').contentDocument.querySelectorAll('p > b')).filter(element => element.textContent.startsWith('Q:')).length`), originalQuestions + 12);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.stream-workspace').length === 60`);
  assert.deepEqual(await evaluate(`Array.from(document.querySelector('iframe').contentDocument.querySelectorAll('h2')).map(element => element.textContent.trim())`), ['Filtering & Sorting', 'Matching & Finding', 'Grouping', 'Partitioning', 'Counting Frequencies', 'Aggregation & Statistics', 'Mapping & Collecting to Map', 'String Operations', 'CompletableFuture']);
  assert.equal(await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('.stream-alternative h3,.stream-alternative h4').length`), 0);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.stream-workspace').length > 0`);
  const streamPrograms = await evaluate(`(() => {
    const doc = document.querySelector('iframe').contentDocument;
    const workspaces = [...doc.querySelectorAll('.stream-workspace')];
    const programs = [];
    for (const workspace of workspaces) {
      if (!workspace.querySelector('.stream-solution').hidden) throw new Error('Solution must start hidden');
      const editor = workspace.querySelector('textarea');
      if (!editor.value.includes('TODO:')) throw new Error('Starter should not reveal the answer');
      programs.push(editor.value);
      const reveal = workspace.querySelector('.stream-reveal'); reveal.click();
      if (workspace.querySelector('.stream-solution').hidden) throw new Error('Reveal failed');
      for (const button of workspace.querySelectorAll('.stream-solution > button')) {
        button.click(); programs.push(editor.value);
      }
      reveal.click();
    }
    return programs;
  })()`);
  assert.ok(streamPrograms.length > 100, 'Every Stream question and important alternative needs runnable code');
  if (process.env.CODEGROUND_RUN_STREAM === '1') {
    await evaluate(`(() => { const workspace = document.querySelector('iframe').contentDocument.querySelector('.stream-workspace'); workspace.querySelector('.stream-solution > button').click(); workspace.querySelector('[data-run]').click(); })()`);
    await until(`!document.querySelector('iframe').contentDocument.querySelector('.stream-workspace [data-run]').disabled`, 60000);
    const output = await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.stream-output').textContent`);
    assert.match(output, /Accepted/);
    assert.match(output, /Ada Lovelace/);
    console.log('Online Java Stream execution passed in the browser.');
  }
  if (process.env.CODEGROUND_CHECK_STREAM_JAVA === '1') {
    const sources = streamPrograms.map((source, index) => source.replace(/^import .*;\n/gm, '').replace('public class Main', `class StreamExample${index}`));
    const driver = `import java.time.*;\nimport java.util.*;\nimport java.util.function.*;\nimport java.util.stream.*;\npublic class Main { public static void main(String[] args) {\n${sources.map((_, index) => `StreamExample${index}.main(args);`).join('\n')}\n} }\n${sources.join('\n')}`;
    const file = path.join(profile, 'Main.java'); writeFileSync(file, driver);
    const result = spawnSync('java', ['--source', '17', file], { encoding: 'utf8', timeout: 60000, windowsHide: true });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    console.log(`Compiled and executed ${streamPrograms.length} Stream starters, solutions and alternatives.`);
  }
  await evaluate(`location.hash = 'practice/interview/sql-snippets'`);
  const sqlCount = (readFileSync(new URL('../public/library/interview/notes/sql-snippets.html', import.meta.url), 'utf8').match(/<p><b>Q:/g) || []).length;
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.sql-workspace').length === ${sqlCount}`);
  assert.equal(await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('.sql-workspace [data-run]:disabled').length`), 1);
  assert.equal(await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('.sql-workspace .stream-solution:not([hidden])').length`), 0);
  for (let index = 0; index < sqlCount - 1; index++) {
    await evaluate(`(() => { const workspace = document.querySelector('iframe').contentDocument.querySelectorAll('.sql-workspace')[${index}]; workspace.querySelector('[data-load]').click(); workspace.querySelector('[data-run]').click(); })()`);
    await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.sql-workspace')[${index}]?.querySelector('[data-run]')?.disabled === false`);
    const output = await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('.sql-workspace')[${index}].querySelector('.sql-results').textContent`);
    assert.match(output, /^Completed\./, `SQL example ${index + 1}: ${output}`);
  }
  await evaluate(`(() => { const workspace = document.querySelector('iframe').contentDocument.querySelector('.sql-workspace'); workspace.querySelector('textarea').value = 'SELECT * FROM missing_table;'; workspace.querySelector('[data-run]').click(); })()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.sql-results')?.textContent.includes('SQL error:')`);
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
  await evaluate(`location.hash = 'practice/incidents/failed-deployment'`);
  await until(`location.hash.includes('#practice/tasks?scenario=failed-deployment') && document.querySelector('iframe')?.contentDocument?.querySelector('.task-detail')?.dataset.taskId === '34'`);
  assert.ok(await evaluate(`document.querySelector('iframe').contentDocument.documentElement.scrollWidth <= document.querySelector('iframe').contentWindow.innerWidth`), 'Mobile task workspace overflows');
  assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), 'Mobile incident page overflows');
  await evaluate(`location.hash = 'practice/workspace'`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.task-title-list button').length === 50`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('button[data-task-id="1"]').click()`);
  await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('.monaco-editor'))`);
  assert.ok(await evaluate(`document.querySelector('iframe').contentDocument.documentElement.scrollWidth <= document.querySelector('iframe').contentWindow.innerWidth`), 'Mobile Java challenge overflows');
  await evaluate(`location.hash = 'practice/interview/sql-snippets'`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.sql-workspace').length === ${sqlCount}`);
  await evaluate(`(() => { const workspace = document.querySelector('iframe').contentDocument.querySelector('.sql-workspace'); workspace.querySelector('[data-load]').click(); workspace.querySelector('[data-run]').click(); })()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.sql-results')?.textContent.includes('Completed.')`);
  assert.ok(await evaluate(`document.querySelector('iframe').contentDocument.documentElement.scrollWidth <= document.querySelector('iframe').contentWindow.innerWidth`), 'Mobile SQL workspace overflows');
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
