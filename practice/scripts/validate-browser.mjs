import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const executable = process.env.JAVA_PRACTICE_BROWSER || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
assert.ok(executable, 'Set JAVA_PRACTICE_BROWSER to a Chromium browser executable.');
const url = process.env.JAVA_PRACTICE_URL || 'http://127.0.0.1:5173/';
assert.equal((await fetch(url)).status, 200, 'Start npm run dev before browser checks.');
const profile = mkdtempSync(path.join(tmpdir(), 'java-practice-browser-'));
const browser = spawn(executable, ['--headless=new', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, '--no-first-run', '--disable-sync', '--disable-background-networking', 'about:blank'],
  { windowsHide: true, stdio: 'ignore' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let attempt = 0; !existsSync(portFile) && attempt < 200; attempt++) await pause(50);
  assert.ok(existsSync(portFile), 'Headless browser did not start.');
  const [port, endpoint] = readFileSync(portFile, 'utf8').trim().split(/\r?\n/);
  socket = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  const pending = new Map();
  const errors = [];
  let sequence = 0;
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text + ': ' + (message.params.exceptionDetails.exception?.description || ''));
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id); clearTimeout(request.timeout);
    if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
  };
  function command(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 75000);
      pending.set(id, { resolve, reject, timeout });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  const { targetId } = await command('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
  await command('Runtime.enable', {}, sessionId);
  await command('Page.enable', {}, sessionId);
  await command('Page.navigate', { url }, sessionId);
  async function evaluate(fn, argument) {
    const result = await command('Runtime.evaluate', { expression: `(${fn.toString()})(${JSON.stringify(argument)})`, awaitPromise: true, returnByValue: true }, sessionId);
    assert.ok(!result.exceptionDetails, result.exceptionDetails?.exception?.description || 'Browser assertion failed');
    return result.result.value;
  }
  await evaluate(async () => {
    window.qa = {
      assert(condition, message) { if (!condition) throw new Error(message); },
      async wait(test, message, attempts = 400) {
        for (let i = 0; i < attempts; i++) { if (test()) return; await new Promise(resolve => setTimeout(resolve, 25)); }
        throw new Error(message);
      },
      button(root, text) { return [...root.querySelectorAll('button')].find(button => button.textContent.trim() === text); },
      section() { return [...document.querySelectorAll('section')].find(section => !section.parentElement.hidden); },
      change(select, value) { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); },
    };
    await qa.wait(() => document.querySelector('fieldset'), 'MCQ UI did not load');
    const section = qa.section();
    qa.assert(!document.body.textContent.includes('Build confidence through practice.'), 'Removed headline returned');
    qa.assert(section.querySelectorAll('.navigator button').length === 20, 'Expected 20 MCQs per page');
    qa.assert(getComputedStyle(section.querySelector('.navigator')).gridTemplateColumns.split(' ').length === 4, 'Expected 4 columns');
    qa.assert(!section.querySelector('.feedback'), 'Answer visible before submission');
    qa.assert(qa.button(section, 'Submit answer').disabled, 'Submission enabled without a choice');
    section.querySelectorAll('input[type=radio]')[0].click();
    await qa.wait(() => !qa.button(section, 'Submit answer').disabled, 'Choice not stored');
    qa.button(section, 'Submit answer').click();
    await qa.wait(() => section.querySelector('.feedback'), 'No submission feedback');
    qa.assert(section.querySelector('.score').textContent.includes('0 / 1'), 'Wrong incorrect score');
    section.querySelector('input[type=checkbox]').click();
    await qa.wait(() => section.querySelectorAll('.navigator button').length === 1, 'Incorrect review not filtered');
    qa.button(section, 'Reset answer').click();
    await qa.wait(() => !section.querySelector('.feedback'), 'Reset did not hide explanation');
    qa.assert(!section.querySelector('input[type=checkbox]').checked, 'Reset should allow retry outside review');
    qa.assert(section.querySelector('.score').textContent.includes('0 / 0'), 'Reset did not update score');
    qa.assert(!section.querySelector('fieldset').disabled, 'Reset did not unlock choices');
    section.querySelectorAll('input[type=radio]')[1].click();
    await qa.wait(() => !qa.button(section, 'Submit answer').disabled, 'Choice unavailable');
    qa.button(section, 'Submit answer').click();
    await qa.wait(() => section.querySelector('.feedback')?.textContent.startsWith('Correct.'), 'Correct answer marked wrong');
    qa.assert(section.querySelector('.score').textContent.includes('1 / 1'), 'Wrong correct score');
    qa.button(section.querySelector('aside'), 'Next').click();
    await qa.wait(() => section.querySelector('.navigator button')?.textContent === '21', 'Second navigator page failed');
    section.querySelector('.navigator button').click();
    await qa.wait(() => section.querySelector('.meta').textContent.startsWith('MCQ 21 '), 'Question 21 not selected');
    qa.button(section.querySelector('article .pagination'), 'Previous').click();
    await qa.wait(() => section.querySelector('.meta').textContent.startsWith('MCQ 20 '), 'Question previous failed');
    await qa.wait(() => section.querySelector('.navigator button')?.textContent === '1', 'Navigator did not follow current question');
    for (const option of [...section.querySelector('select').options].slice(1)) {
      qa.change(section.querySelector('select'), option.value);
      await qa.wait(() => section.querySelector('.meta').textContent.includes(option.value), `MCQ topic failed: ${option.value}`);
      qa.assert(section.querySelectorAll('input[type=radio]').length === 4, 'Question missing four choices');
    }
    qa.change(section.querySelector('select'), 'All');
    await qa.wait(() => section.querySelector('.navigator button')?.textContent === '1', 'All topics not restored');
    section.querySelector('.navigator button').click();
    await qa.wait(() => section.querySelector('.feedback')?.textContent.startsWith('Correct.'), 'MCQ progress lost after filtering');
    document.querySelectorAll('.tabs button')[1].click();
    await qa.wait(() => document.querySelector('.monaco-editor textarea'), 'Monaco did not load');
    qa.assert(qa.section().querySelectorAll('.navigator button').length === 20, 'Expected 20 challenges per page');
    qa.assert([...qa.section().querySelectorAll('details')].every(details => !details.open), 'Solution or hints revealed automatically');
    qa.assert(!qa.button(qa.section(), 'Run Code').disabled, 'Run Code must be enabled for nonempty code');
    qa.assert(qa.button(qa.section(), 'Run Tests').disabled, 'Automated tests must remain disabled');
    window.confirm = () => true;
    document.querySelector('.monaco-editor textarea').focus();
  });
  await command('Input.insertText', { text: '// audit draft\n' }, sessionId);
  await evaluate(async () => {
    const section = qa.section();
    await qa.wait(() => section.querySelector('.view-lines').textContent.replaceAll('\u00a0', ' ').includes('audit draft'), 'Editor typing failed');
    qa.button(section.querySelector('article .pagination'), 'Next').click();
    await qa.wait(() => section.querySelector('.meta').textContent.startsWith('Challenge 2 '), 'Challenge next failed');
    qa.button(section.querySelector('article .pagination'), 'Previous').click();
    await qa.wait(() => section.querySelector('.meta').textContent.startsWith('Challenge 1 '), 'Challenge previous failed');
    await qa.wait(() => section.querySelector('.view-lines').textContent.replaceAll('\u00a0', ' ').includes('audit draft'), 'Draft lost after navigation');
    const template = section.querySelector('article select');
    qa.change(template, 'empty');
    await qa.wait(() => !section.querySelector('.view-lines').textContent.replaceAll('\u00a0', ' ').includes('audit draft'), 'Empty template did not clear draft');
    qa.change(template, 'starter');
    await qa.wait(() => section.querySelector('.view-lines').textContent.includes('import'), 'Starter not restored');
    qa.button(section, 'Reset code').click();
    for (const option of [...section.querySelector('select').options].slice(1)) {
      qa.change(section.querySelector('select'), option.value);
      await qa.wait(() => section.querySelector('.meta').textContent.includes(option.value), `Coding topic failed: ${option.value}`);
      qa.assert([...section.querySelectorAll('details')].every(details => !details.open), 'Reveal state leaked between challenges');
    }
    qa.change(section.querySelector('select'), 'All');
    await qa.wait(() => section.querySelector('.navigator button')?.textContent === '1', 'Challenge all topics failed');
    qa.button(section.querySelector('aside'), 'Next').click();
    await qa.wait(() => section.querySelector('.navigator button')?.textContent === '21', 'Challenge page two failed');
    qa.button(section.querySelector('aside'), 'Next').click();
    await qa.wait(() => section.querySelector('.navigator button')?.textContent === '41', 'Challenge page three failed');
    qa.assert(section.querySelectorAll('.navigator button').length === 10, 'Final challenge page must contain 10 items');
    qa.assert(qa.button(section.querySelector('aside'), 'Next').disabled, 'Final page next must be disabled');
    document.querySelectorAll('.tabs button')[0].click();
    await qa.wait(() => qa.section().querySelector('.feedback')?.textContent.startsWith('Correct.'), 'MCQ progress lost across modes');
  });
  await command('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true }, sessionId);
  await evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    qa.assert(document.documentElement.scrollWidth <= window.innerWidth, 'Horizontal overflow at mobile width');
    qa.assert(getComputedStyle(qa.section().querySelector('.navigator')).gridTemplateColumns.split(' ').length === 4, 'Mobile navigator must retain four columns');
    document.querySelectorAll('.tabs button')[1].click();
    await qa.wait(() => document.querySelector('.monaco-editor'), 'Coding mode did not reopen');
    qa.assert(document.documentElement.scrollWidth <= window.innerWidth, 'Coding layout overflow at mobile width');
  });
  console.log('Headless browser checks passed: submit/reset/score/review, 22 topic filters in both modes, navigator pagination and four-column layout, Monaco editing/draft preservation/templates/reset, hidden solutions, Run Code availability, disabled automated tests, mode persistence, and mobile width.');
  if (process.argv.includes('--compiler-live')) {
    await command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
    const cases = [
      { name: 'success with stdin', source: 'public class Main { public static void main(String[] args) { System.out.println("Hello, " + new java.util.Scanner(System.in).nextLine()); } }', stdin: 'Ada\n', status: 3, field: 'stdout', contains: 'Hello, Ada' },
      { name: 'compilation error', source: 'public class Main { public static void main(String[] args) { System.out.println("missing semicolon") } }', status: 6, field: 'Compiler output', contains: 'error' },
      { name: 'runtime exception', source: 'public class Main { public static void main(String[] args) { throw new IllegalStateException("runtime-test"); } }', status: 11, field: 'stderr', contains: 'IllegalStateException' },
    ];
    const failures = [];
    for (const entry of cases) {
      await evaluate(() => document.querySelector('.monaco-editor textarea').focus());
      await command('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 2, key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65 }, sessionId);
      await command('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 0, key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65 }, sessionId);
      await command('Input.insertText', { text: entry.source }, sessionId);
      const actual = await evaluate(async entry => {
        const section = qa.section();
        const input = section.querySelector('.compiler-input textarea');
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, entry.stdin || '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(resolve => requestAnimationFrame(resolve));
        qa.button(section, 'Run Code').click();
        await qa.wait(() => section.querySelector('.execution-result[aria-busy="true"]'), 'Execution never entered loading state');
        qa.assert(qa.button(section, 'Running...').disabled, 'Run Code should be disabled during execution');
        await qa.wait(() => section.querySelector('.execution-result[aria-busy="false"]'), 'Execution did not complete', 2400);
        const result = section.querySelector('.execution-result');
        const fields = {};
        for (const heading of result.querySelectorAll('h3')) fields[heading.textContent] = heading.nextElementSibling?.textContent;
        return { status: result.querySelector('[role=status]')?.textContent, error: result.querySelector('[role=alert]')?.textContent, fields };
      }, entry);
      if (!actual.error && actual.status?.includes(`(${entry.status})`) && actual.fields[entry.field]?.includes(entry.contains)) {
        console.log(`LIVE BROWSER PASS: ${entry.name}: ${actual.status}`);
      } else {
        failures.push({ name: entry.name, actual });
        console.error(`LIVE BROWSER NOT VERIFIED: ${entry.name}: ${JSON.stringify(actual)}`);
      }
    }
    assert.deepEqual(failures, [], 'Real Judge0 browser execution was blocked or returned unexpected results');
  }
  assert.deepEqual(errors, [], 'Uncaught browser errors');
  await command('Browser.close');
} finally {
  socket?.close();
  if (browser.exitCode === null) browser.kill();
  for (let i = 0; browser.exitCode === null && i < 100; i++) await pause(50);
  const relative = path.relative(path.resolve(tmpdir()), path.resolve(profile));
  assert.ok(!relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(profile).startsWith('java-practice-browser-'));
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  catch { console.warn(`Temporary browser profile could not be removed: ${profile}`); }
}
