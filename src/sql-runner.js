import { sqlExercise } from './sql-exercises.js';

export function mountSqlRunners(doc) {
  const body = doc.querySelector('.note-body');
  if (!body || body.dataset.sqlRunners) return;
  body.dataset.sqlRunners = 'true';
  const style = doc.createElement('link'); style.rel = 'stylesheet';
  style.href = new URL('stream-runner.css', new URL(import.meta.env.BASE_URL, location.href)).href; doc.head.append(style);
  const extra = doc.createElement('link'); extra.rel = 'stylesheet';
  extra.href = new URL('sql-runner.css', new URL(import.meta.env.BASE_URL, location.href)).href; doc.head.append(extra);
  doc.querySelector('.section-header > p')?.remove();
  for (const question of [...body.querySelectorAll(':scope > p')].filter(node => node.querySelector('b')?.textContent.trim().startsWith('Q:'))) {
    let snippet = question.nextElementSibling;
    while (snippet && snippet.tagName !== 'PRE' && !/^H[1-3]$/.test(snippet.tagName)) snippet = snippet.nextElementSibling;
    if (!snippet || snippet.tagName !== 'PRE') continue;
    const exercise = sqlExercise(snippet.textContent), title = question.textContent.replace(/^Q:\s*/, '').replace(/\s+/g, ' ').trim();
    const workspace = doc.createElement('section'); workspace.className = 'stream-workspace sql-workspace'; workspace.setAttribute('aria-label', `SQL workspace: ${title}`);
    workspace.innerHTML = '<div class="stream-toolbar"><span>SQLite</span><button type="button" data-reset>Reset</button><button type="button" data-run>Run SQL</button></div><details class="sql-data"><summary>Sample schema and data</summary><pre><code></code></pre></details><textarea class="stream-code" spellcheck="false" wrap="off"></textarea><p class="stream-service"></p><div class="sql-results" role="status" hidden></div><button type="button" class="stream-reveal" aria-expanded="false">Reveal solution</button><div class="stream-solution" hidden><button type="button" data-load>Load solution into editor</button><p class="sql-note"></p><pre><code></code></pre></div>';
    question.after(workspace);
    const editor = workspace.querySelector('textarea'), run = workspace.querySelector('[data-run]'), results = workspace.querySelector('.sql-results');
    const starter = '-- Write your SQL here.\n-- Open Sample schema and data to see the available tables.\n';
    editor.value = starter; editor.setAttribute('aria-label', `SQL code: ${title}`);
    workspace.querySelector('.sql-data code').textContent = exercise.setup;
    workspace.querySelector('.stream-service').textContent = exercise.runnable ? 'Runs in your browser. Each run starts with fresh sample data.' : 'MySQL stored procedure: run this example in MySQL. SQLite does not support stored procedures.';
    run.disabled = !exercise.runnable;
    if (!exercise.runnable) workspace.querySelector('.stream-toolbar > span').textContent = 'MySQL · Reference';
    const solution = workspace.querySelector('.stream-solution');
    solution.querySelector('code').textContent = exercise.solution;
    solution.querySelector('.sql-note').textContent = exercise.note;
    if (exercise.solution !== exercise.original.trim()) {
      const label = doc.createElement('p'); label.textContent = 'Original snippet';
      const pre = doc.createElement('pre'), code = doc.createElement('code'); code.textContent = exercise.original; pre.append(code); solution.append(label, pre);
    }
    snippet.remove();
    workspace.querySelector('[data-load]').addEventListener('click', () => {
      if (editor.value !== starter && editor.value !== exercise.solution && !doc.defaultView.confirm('Replace your current query with the solution?')) return;
      editor.value = exercise.solution; editor.focus();
    });
    const reveal = workspace.querySelector('.stream-reveal');
    reveal.addEventListener('click', () => { solution.hidden = !solution.hidden; reveal.setAttribute('aria-expanded', String(!solution.hidden)); reveal.textContent = solution.hidden ? 'Reveal solution' : 'Hide solution'; });
    workspace.querySelector('[data-reset]').addEventListener('click', () => {
      if (editor.value !== starter && !doc.defaultView.confirm('Reset your query?')) return;
      editor.value = starter; results.hidden = true;
    });
    editor.addEventListener('keydown', event => { if (event.key === 'Tab') { event.preventDefault(); editor.setRangeText('    ', editor.selectionStart, editor.selectionEnd, 'end'); } });
    run.addEventListener('click', () => {
      if (!editor.value.replace(/--[^\n]*/g, '').trim()) { results.hidden = false; results.textContent = 'Write a SQL query before running.'; return; }
      run.disabled = true; results.hidden = false; results.textContent = 'Running…';
      const worker = new Worker(new URL('./sql-worker.js', import.meta.url), { type: 'module' });
      const stop = () => { clearTimeout(timer); worker.terminate(); run.disabled = false; doc.defaultView?.removeEventListener('pagehide', stop); };
      const timer = setTimeout(() => { results.textContent = 'Query timed out. Simplify your query and try again.'; stop(); }, 10000);
      doc.defaultView.addEventListener('pagehide', stop, { once: true });
      worker.onerror = event => { event.preventDefault(); results.textContent = 'SQL engine could not load. Refresh and try again.'; stop(); };
      worker.onmessage = ({ data }) => {
        stop(); results.replaceChildren();
        const status = doc.createElement('p'); status.textContent = data.error ? `SQL error: ${data.error}` : `Completed. ${data.changed} row changes.`; results.append(status);
        for (const [index, result] of (data.results || []).entries()) {
          const caption = doc.createElement('p'); caption.textContent = `Result ${index + 1}: ${result.values.length} rows${result.truncated ? ' (limited to 500)' : ''}`; results.append(caption);
          const scroll = doc.createElement('div'); scroll.className = 'sql-table-scroll';
          const table = doc.createElement('table'), head = doc.createElement('thead'), row = doc.createElement('tr');
          for (const column of result.columns) { const cell = doc.createElement('th'); cell.scope = 'col'; cell.textContent = column; row.append(cell); }
          head.append(row); table.append(head); const tbody = doc.createElement('tbody');
          for (const values of result.values) { const row = doc.createElement('tr'); for (const value of values) { const cell = doc.createElement('td'); cell.textContent = value === null ? 'NULL' : String(value); row.append(cell); } tbody.append(row); }
          table.append(tbody); scroll.append(table); results.append(scroll);
        }
      };
      worker.postMessage({ setup: exercise.setup, code: editor.value, preview: exercise.preview });
    });
  }
}
