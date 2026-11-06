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
  async function reloadPage() {
    await evaluate("document.documentElement.dataset.smokeReload = 'pending'");
    await command('Page.reload', {}, sessionId);
    await until("document.documentElement.dataset.smokeReload !== 'pending' && document.readyState === 'complete' && Boolean(document.querySelector('#app .workspace'))");
  }
  async function taskSearch(value) {
    await evaluate(`(() => { const doc = document.querySelector('iframe').contentDocument; const input = doc.querySelector('input[aria-label="Search tasks"]'); Object.getOwnPropertyDescriptor(doc.defaultView.HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new doc.defaultView.Event('input', { bubbles: true })); })()`);
  }
  await until(`document.querySelectorAll('[data-tab]').length === 7`);
  assert.equal(await evaluate(`document.querySelectorAll('.card').length`), 6);

  assert.equal(await evaluate(`document.querySelectorAll('.sidebar').length`), 0);
  assert.ok(await evaluate(`document.querySelector('.main').getBoundingClientRect().width >= innerWidth - 1`), 'Content should use the sidebar space');
  const practicePosition = await evaluate(`(() => { const box=document.querySelector('[data-tab="practice"]').getBoundingClientRect(); return {x:box.left+box.width/2,y:box.top+box.height/2}; })()`);
  await command('Input.dispatchMouseEvent', {type:'mouseMoved',...practicePosition}, sessionId);
  await until(`!document.querySelector('.mega-menu').hidden && document.querySelector('[data-tab="practice"]').getAttribute('aria-expanded') === 'true'`);
  assert.equal(await evaluate(`document.querySelectorAll('.mega-menu .side-link').length`), 5);
  await command('Input.dispatchKeyEvent', {type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27}, sessionId);
  await until(`document.querySelector('.mega-menu').hidden`);
  await evaluate(`document.querySelector('[data-tab="backend"]').focus()`);
  await command('Input.dispatchKeyEvent', {type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40}, sessionId);
  await until(`!document.querySelector('.mega-menu').hidden && document.querySelector('.mega-menu').contains(document.activeElement)`);
  assert.equal(await evaluate(`document.querySelectorAll('.mega-header h2').length`), 0);
  const backendLinks = await evaluate(`Array.from(document.querySelectorAll('.mega-menu .side-link')).map(link => link.hash)`);
  for (const id of ['git-commands', 'junit-concepts', 'mongodb']) assert.ok(backendLinks.includes('#backend/interview/' + id));
  await command('Input.dispatchKeyEvent', {type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27}, sessionId);
  await until(`document.querySelector('.mega-menu').hidden && document.activeElement.dataset.tab === 'backend'`);

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

  await evaluate(`document.querySelector('[data-tab="genai"]').click()`);
  await until(`document.querySelectorAll('.mega-menu .topic-group').length > 3`);
  await evaluate(`document.querySelectorAll('.mega-menu details').forEach(group => group.open = true)`);
  assert.ok(await evaluate(`(() => { const menu = document.querySelector('.mega-menu'); menu.scrollTop = 500; return menu.scrollTop > 0; })()`), 'GenAI topic menu must scroll independently');
  await evaluate(`document.querySelector('.mega-close').click()`);

  await evaluate(`location.hash = 'practice/tasks'`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.task-title-list button').length === 34`);
  await evaluate(`document.querySelector('[data-tab="practice"]').click()`);
  await until(`!document.querySelector('.mega-menu').hidden`);
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.mega-menu .side-link')).map(link => link.hash)`), ['#practice/tasks', '#practice/workspace', '#practice/debugging', '#practice/interview/java-snippets', '#practice/interview/sql-snippets']);
  assert.ok(await evaluate(`!Array.from(document.querySelectorAll('.side-section-title')).some(title => title.textContent.trim() === 'Reference')`));
  await evaluate(`document.querySelector('.mega-close').click()`);
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
  assert.equal(await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('.sample-requirements li').length`), 8);
  assert.ok(await evaluate(`(() => { const doc = document.querySelector('iframe').contentDocument; const left = doc.querySelector('.sample-info-pane').getBoundingClientRect(); const right = doc.querySelector('.sample-code-pane').getBoundingClientRect(); return right.left >= left.right - 1 && Math.abs(left.top - right.top) < 2; })()`), 'Question and editor must be side by side');
  await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('.view-lines .view-line'))`);
  const editorPosition = await evaluate(`(() => { const frame = document.querySelector('iframe'); const outer = frame.getBoundingClientRect(); const inner = frame.contentDocument.querySelector('.view-lines .view-line').getBoundingClientRect(); return { x: outer.left + inner.left + 40, y: outer.top + inner.top + 8 }; })()`);
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', ...editorPosition, button: 'left', clickCount: 1 }, sessionId);
  await command('Input.dispatchMouseEvent', { type: 'mouseReleased', ...editorPosition, button: 'left', clickCount: 1 }, sessionId);
  await command('Input.insertText', { text: '//draftRetentionCheck\n' }, sessionId);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.view-lines')?.textContent.includes('draftRetentionCheck')`);
  await reloadPage();
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.task-title-list button').length === 34`);
  await taskSearch('catalog');
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.task-title-list button').length === 1`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('[data-task-id="3"]').click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.view-lines')?.textContent.includes('draftRetentionCheck')`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('.sample-views button')[1].click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.sample-info-content details').length === 4`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('.sample-views button')[2].click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.sample-info-content')?.textContent.includes('Why this approach')`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.back-to-tasks').click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.task-title-list button').length === 1`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('button[data-task-id="3"]').click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.view-lines')?.textContent.includes('draftRetentionCheck')`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.back-to-tasks').click()`);
  await taskSearch('');
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.task-title-list button').length === 34`);
  for (const task of projectTopicTasks) {
    await evaluate(`document.querySelector('iframe').contentDocument.querySelector('button[data-task-id="${task.id}"]').click()`);
    await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.exercise-workspace')?.dataset.taskId === '${task.id}'`);
    assert.equal(await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.sample-run').disabled`), task.runtime === 'project');
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
    await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.exercise-workspace')?.dataset.taskId === '${challenge.id}'`);
    assert.equal(await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.sample-run').disabled`), challenge.runtime === 'project');
    await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.back-to-tasks').click()`);
    await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.task-title-list button').length === 50`);
  }
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('button[data-task-id="1"]').click()`);
  await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('.monaco-editor'))`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('.sample-views button')[2].click()`);
  await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('.sample-load'))`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.sample-load').click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.sample-info-content')?.textContent.includes('Solution loaded')`);
  if (process.env.CODEGROUND_RUN_JAVA === '1') {
    await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.sample-checks').click()`);
    await until(`document.querySelector('iframe')?.contentDocument?.querySelector('[aria-label="Execution result"]')?.textContent.includes('1/1 sample checks passed')`);
    assert.ok(await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.sample-check-result.passed').textContent.includes('20.00')`));
    assert.ok(await evaluate(`JSON.parse(localStorage.getItem('codeground:draft:v1:reidy:3')).code.includes('draftRetentionCheck') && JSON.parse(localStorage.getItem('codeground:draft:v1:java:1')).code.includes('invoiceTotal')`));
    await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('.sample-files button')[1].click()`);
    await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('textarea[aria-label="Sample input"]'))`);
    await evaluate(`document.querySelector('iframe').contentDocument.querySelector('textarea[aria-label="Sample input"]').focus()`);
    await command('Input.insertText', {text:'saved custom input'}, sessionId);
    await until(`JSON.parse(localStorage.getItem('codeground:draft:v1:java:1')).stdin === 'saved custom input'`);
    await reloadPage();
    await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.task-title-list button').length === 50`);
    await evaluate(`document.querySelector('iframe').contentDocument.querySelector('[data-task-id="1"]').click()`);
    await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('.monaco-editor'))`);
    await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('.sample-files button')[1].click()`);
    await until(`document.querySelector('iframe')?.contentDocument?.querySelector('textarea[aria-label="Sample input"]')?.value === 'saved custom input'`);
    await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('.sample-files button')[0].click()`);
    await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('.view-lines .view-line'))`);
    const position = await evaluate(`(() => { const frame = document.querySelector('iframe'); const a = frame.getBoundingClientRect(), b = frame.contentDocument.querySelector('.view-lines .view-line').getBoundingClientRect(); return {x:a.left+b.left+40, y:a.top+b.top+8}; })()`);
    await command('Input.dispatchMouseEvent', {type:'mousePressed',...position,button:'left',clickCount:1}, sessionId);
    await command('Input.dispatchMouseEvent', {type:'mouseReleased',...position,button:'left',clickCount:1}, sessionId);
    await command('Input.dispatchKeyEvent', {type:'keyDown',key:'a',code:'KeyA',modifiers:2,windowsVirtualKeyCode:65}, sessionId);
    await command('Input.dispatchKeyEvent', {type:'keyUp',key:'a',code:'KeyA',modifiers:2,windowsVirtualKeyCode:65}, sessionId);
    await command('Input.insertText', {text:'public class Main { public static void main(String[] args) { System.out.println("wrong result"); } }'}, sessionId);
    await until(`JSON.parse(localStorage.getItem('codeground:draft:v1:java:1')).code.includes('wrong result')`);
    await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.sample-checks').click()`);
    await until(`document.querySelector('iframe')?.contentDocument?.querySelector('[aria-label="Execution result"]')?.textContent.includes('0/1 sample checks passed')`);
    assert.ok(await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.sample-check-result.failed').textContent.includes('wrong result')`));
    // Restore a normal solution and its view for the MCQ switching check below.
    await evaluate(`localStorage.removeItem('codeground:draft:v1:java:1'); document.querySelector('iframe').contentDocument.querySelector('.back-to-tasks').click()`);
    await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.task-title-list button').length === 50`);
    await evaluate(`document.querySelector('iframe').contentDocument.querySelector('[data-task-id="1"]').click()`);
    await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('.sample-views'))`);
    await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('.sample-views button')[2].click()`);
    await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('.sample-load'))`);
    await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.sample-load').click()`);
    await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.sample-info-content')?.textContent.includes('Solution loaded')`);
    console.log('Verified online sample pass/fail, autosaved input after refresh, and separate drafts for both banks.');
  }
  // Coding panels have independent scroll areas and a searchable question drawer.
  assert.ok(await evaluate(`(() => {const d=document.querySelector('iframe').contentDocument;return d.querySelector('.sample-info-pane').getBoundingClientRect().left < d.querySelector('.sample-code-pane').getBoundingClientRect().left && !!d.querySelector('.sample-results-pane') && !d.querySelector('.sample-explorer');})()`));
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.sample-questions-toggle').click()`);
  await until(`document.querySelector('iframe').contentDocument.querySelector('.question-drawer').open`);
  assert.equal(await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('.question-drawer-item').length`),50);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.question-drawer-item[data-question-id="2"]').click()`);
  await until(`document.querySelector('iframe').contentDocument.querySelector('.exercise-workspace')?.dataset.taskId === '2'`);
  await evaluate(`location.hash = 'practice/workspace?task=3'`);
  await until(`document.querySelector('iframe').contentDocument.querySelector('.exercise-workspace')?.dataset.taskId === '3'`);
  assert.ok(await evaluate(`(() => {const d=document.querySelector('iframe').contentDocument;return !!(d.querySelector('.sample-info-pane').compareDocumentPosition(d.querySelector('.sample-code-pane')) & Node.DOCUMENT_POSITION_FOLLOWING);})()`),'Keyboard order must follow visual panel order');
  await evaluate(`location.hash = 'practice/debugging'`);
  await until(`document.querySelector('iframe')?.contentDocument?.body?.textContent?.includes('Overflow before assignment')`);
  assert.equal(await evaluate(`document.querySelector('iframe').contentDocument.querySelector('h1').textContent`), 'Debugging');
  assert.ok(await evaluate(`document.querySelector('iframe').contentDocument.querySelector('header').textContent.includes('100 questions')`));
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.debugging-menu').click()`);
  await until(`document.querySelector('iframe').contentDocument.querySelector('.question-drawer').open`);
  assert.equal(await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('.question-drawer-item').length`),100);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.question-drawer-item').click()`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.debugging-option input').click()`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.debugging-submit').click()`);
  await until(`Boolean(document.querySelector('iframe').contentDocument.querySelector('.debugging-feedback'))`);
  assert.ok(await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.debugging-feedback').textContent.includes('Why')`));
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.debugging-actions button:nth-child(2)').click()`);
  await until(`!document.querySelector('iframe').contentDocument.querySelector('.debugging-feedback')`);
  await evaluate(`location.hash = 'practice/workspace'`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.task-title-list button').length === 50`);
  assert.equal(await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('nav[aria-label="Practice mode"]').length`), 0);
  await evaluate(`location.hash = 'practice/project-coding'`);
  await until(`document.querySelector('iframe')?.contentDocument?.body?.textContent?.includes('Protect an immutable property snapshot')`);
  await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('.monaco-editor'))`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('nav button')[1].click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.body?.textContent?.includes('A paid appraisal is retried')`);
  await evaluate(`location.hash = 'practice/workspace'`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.task-title-list button').length === 50`);
  assert.equal(await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('nav[aria-label="Practice mode"] button').length`), 0);
  assert.ok(await evaluate(`!document.querySelector('iframe').contentDocument.body.textContent.includes('Production scenarios')`));
  await evaluate(`location.hash = 'practice/tasks?task=23'`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.exercise-workspace')?.dataset.taskId === '23'`);
  assert.equal(await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('.sample-info-content li').length > 0`), true);
  assert.ok(await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.sample-run').disabled`));
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.back-to-tasks').click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.task-title-list button').length === 34`);
  assert.equal(await evaluate(`Array.from(document.querySelector('iframe').contentDocument.querySelectorAll('.task-row-title small')).filter(element => element.textContent.includes('Production scenario')).length`), 12);

  await evaluate(`location.hash = 'practice/interview/java-snippets'`);
  await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('.stream-lab-grid'))`);
  const originalQuestions = (readFileSync(new URL('../public/library/interview/notes/java-snippets.html', import.meta.url),'utf8').match(/<p><b>Q:/g) || []).length;
  const streamCount = originalQuestions + 12;
  assert.equal(await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('.stream-question-button').length`), streamCount);
  const streamPrograms = []; let runnableStreams = 0, streamAlternatives = 0;
  for (let id=1; id<=streamCount; id++) {
    await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.stream-lab-menu').click()`);
    await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.stream-question-drawer')?.open`);
    await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.stream-question-button[data-question-id="${id}"]').click()`);
    await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.stream-lab-grid')?.dataset.questionId === '${id}'`);
    const runnable = await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.stream-lab-grid').dataset.runnable === 'true'`);
    assert.equal(await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.stream-run-button').disabled`), !runnable);
    if (!runnable) continue;
    runnableStreams++;
    streamPrograms.push(await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.stream-lab-code').value`));
    await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('.stream-question-tabs button')[2].click()`);
    await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('.stream-load-solution'))`);
    const count = await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('.stream-load-solution').length`);
    streamAlternatives += count-1;
    for(let index=0;index<count;index++) {
      const oldCode = await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.stream-lab-code').value`);
      await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('.stream-load-solution')[${index}].click()`);
      await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.stream-lab-code')?.value !== ${JSON.stringify(oldCode)}`);
      streamPrograms.push(await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.stream-lab-code').value`));
    }
  }
  assert.equal(runnableStreams,60); assert.equal(streamAlternatives,streamApproaches.length);
  assert.equal(streamPrograms.length,152);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.stream-lab-menu').click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.stream-question-drawer')?.open`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.stream-question-button[data-question-id="1"]').click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.stream-lab-grid')?.dataset.questionId === '1'`);
  assert.ok(await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.stream-lab-code').value.includes('sortedIT')`), 'Stream solution draft should survive switching questions');
  if(process.env.CODEGROUND_RUN_STREAM === '1') {
    await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('.stream-question-tabs button')[2].click()`);
    await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('.stream-load-solution'))`);
    await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.stream-load-solution').click()`);
    await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.stream-run-button').click()`);
    await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.stream-output-scroll h2')?.textContent === 'Accepted'`);
    assert.ok(await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.stream-output-scroll').textContent.includes('Ada Lovelace')`));
    console.log('Stream split workspace: online Java execution passed.');
  }
  if(process.env.CODEGROUND_CHECK_STREAM_JAVA === '1') {
    const sources = streamPrograms.map((source,index) => source.replace(/^import .*;\n/gm,'').replace('public class Main',`class StreamExample${index}`));
    const driver = `import java.time.*;\nimport java.util.*;\nimport java.util.function.*;\nimport java.util.stream.*;\npublic class Main { public static void main(String[] args) {\n${sources.map((_,index) => `StreamExample${index}.main(args);`).join('\n')}\n} }\n${sources.join('\n')}`;
    const file = path.join(profile,'Main.java'); writeFileSync(file,driver);
    const result=spawnSync('java',['--source','17',file],{encoding:'utf8',timeout:60000,windowsHide:true});
    assert.equal(result.status,0,result.stderr || result.error?.message);
    console.log(`Compiled and executed ${streamPrograms.length} Stream starters, solutions and alternatives.`);
  }

  await evaluate(`location.hash = 'practice/interview/sql-snippets'`);
  const sqlCount = (readFileSync(new URL('../public/library/interview/notes/sql-snippets.html', import.meta.url), 'utf8').match(/<p><b>Q:/g) || []).length - 1;
  await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('.sql-lab-grid'))`);
  assert.equal(await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('.sql-question-button').length`), sqlCount);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.sql-lab-menu').click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.sql-question-drawer')?.open`);
  await evaluate(`(() => { const doc=document.querySelector('iframe').contentDocument, input=doc.querySelector('input[type="search"]'); Object.getOwnPropertyDescriptor(doc.defaultView.HTMLInputElement.prototype,'value').set.call(input,'salary'); input.dispatchEvent(new doc.defaultView.Event('input',{bubbles:true})); })()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.sql-question-button').length > 0 && document.querySelector('iframe').contentDocument.querySelectorAll('.sql-question-button').length < ${sqlCount}`);
  await evaluate(`(() => { const doc=document.querySelector('iframe').contentDocument, input=doc.querySelector('input[type="search"]'); Object.getOwnPropertyDescriptor(doc.defaultView.HTMLInputElement.prototype,'value').set.call(input,''); input.dispatchEvent(new doc.defaultView.Event('input',{bubbles:true})); })()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.sql-question-button').length === ${sqlCount}`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('[aria-label="Close SQL questions"]').click()`);
  for (let id = 1; id <= sqlCount; id++) {
    await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.sql-lab-menu').click()`);
    await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.sql-question-drawer')?.open`);
    await evaluate(`document.querySelector('iframe').contentDocument.querySelector('[data-question-id="${id}"].sql-question-button').click()`);
    await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.sql-lab-grid')?.dataset.questionId === '${id}' && !document.querySelector('iframe').contentDocument.querySelector('.sql-question-drawer').open`);
    await evaluate(`document.querySelector('iframe').contentDocument.querySelectorAll('nav[aria-label="SQL question views"] button')[1].click()`);
    await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('.sql-load-solution'))`);
    await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.sql-load-solution').click()`);
    await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.sql-run-button').click()`);
    await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.sql-output-scroll h2')?.textContent === 'Query completed' || document.querySelector('iframe')?.contentDocument?.querySelector('.sql-output-scroll h2')?.textContent === 'SQL Error'`);
    assert.equal(await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.sql-output-scroll h2').textContent`), 'Query completed', 'SQL question ' + id);
  }
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.sql-lab-menu').click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.sql-question-drawer')?.open`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('[data-question-id="6"].sql-question-button').click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.sql-lab-grid')?.dataset.questionId === '6'`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.sql-check-button').click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.sql-output-scroll h2')?.textContent === 'Sample Passed'`);
  await evaluate(`(() => { const doc=document.querySelector('iframe').contentDocument, input=doc.querySelector('.sql-lab-code'); Object.getOwnPropertyDescriptor(doc.defaultView.HTMLTextAreaElement.prototype,'value').set.call(input,'SELECT 1 AS wrong;'); input.dispatchEvent(new doc.defaultView.Event('input',{bubbles:true})); })()`);
  await until(`JSON.parse(localStorage.getItem('codeground:draft:v1:sql:6')).code.includes('wrong')`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.sql-check-button').click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.sql-output-scroll h2')?.textContent === 'Wrong Answer'`);
  await evaluate(`(() => { const doc=document.querySelector('iframe').contentDocument, input=doc.querySelector('.sql-lab-code'); Object.getOwnPropertyDescriptor(doc.defaultView.HTMLTextAreaElement.prototype,'value').set.call(input,'SELECT * FROM missing_table;'); input.dispatchEvent(new doc.defaultView.Event('input',{bubbles:true})); })()`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.sql-run-button').click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.sql-output-scroll h2')?.textContent === 'SQL Error'`);
  console.log('SQL Lab passed: drawer search, all 57 solutions, sample pass/fail, autosave, and error reporting.');

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
  await until(`location.hash.includes('#practice/tasks?scenario=failed-deployment') && document.querySelector('iframe')?.contentDocument?.querySelector('.exercise-workspace')?.dataset.taskId === '34'`);
  assert.ok(await evaluate(`document.querySelector('iframe').contentDocument.documentElement.scrollWidth <= document.querySelector('iframe').contentWindow.innerWidth`), 'Mobile task workspace overflows');
  assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), 'Mobile incident page overflows');
  await evaluate(`location.hash = 'practice/workspace'`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelectorAll('.task-title-list button').length === 50`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('button[data-task-id="1"]').click()`);
  await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('.monaco-editor'))`);
  assert.ok(await evaluate(`document.querySelector('iframe').contentDocument.documentElement.scrollWidth <= document.querySelector('iframe').contentWindow.innerWidth`), 'Mobile Java challenge overflows');

  await evaluate(`location.hash = 'practice/interview/sql-snippets'`);
  await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('.sql-lab-grid'))`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.sql-lab-menu').click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.sql-question-drawer')?.open`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('[data-question-id="7"].sql-question-button').click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.sql-lab-grid')?.dataset.questionId === '7'`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.sql-run-button').click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.sql-output-scroll h2')?.textContent === 'Query completed'`);

  assert.ok(await evaluate(`document.querySelector('iframe').contentDocument.documentElement.scrollWidth <= document.querySelector('iframe').contentWindow.innerWidth`), 'Mobile SQL workspace overflows');

  await evaluate(`location.hash = 'practice/interview/java-snippets'`);
  await until(`Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('.stream-lab-grid'))`);
  assert.ok(await evaluate(`document.querySelector('iframe').contentDocument.documentElement.scrollWidth <= document.querySelector('iframe').contentWindow.innerWidth`),'Mobile Stream workspace overflows');
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.stream-lab-menu').click()`);
  await until(`document.querySelector('iframe')?.contentDocument?.querySelector('.stream-question-drawer')?.open`);
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('[aria-label="Close Stream questions"]').click()`);

  await evaluate(`location.hash = 'home'`);
  await until(`document.querySelectorAll('.card').length === 6`);
  assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), 'Mobile page overflows');

  await evaluate(`document.querySelector('[data-tab="practice"]').click()`);
  await until(`!document.querySelector('.mega-menu').hidden`);
  assert.ok(await evaluate(`document.querySelector('.mega-menu').getBoundingClientRect().right <= innerWidth`));
  await command('Input.dispatchKeyEvent', {type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27}, sessionId);
  await until(`document.querySelector('.mega-menu').hidden`);

  assert.deepEqual(errors, []);
  console.log('Browser smoke checks passed: seven tabs, six note areas, project tasks, Java editor, MCQs, search, mobile layout, and no JavaScript exceptions.');
} finally {
  socket?.close(); browser.kill();
}