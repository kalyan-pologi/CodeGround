import { useEffect, useRef, useState } from 'react';
import { useExerciseDraft, readPreference, writePreference } from './exercise-drafts';
import CloudSaveControls from './CloudSaveControls';

function sqlJob(data, signal) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./sql-worker.js', import.meta.url), { type: 'module' });
    const cleanup = () => { clearTimeout(timer); worker.terminate(); signal?.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Query timed out. Simplify your query and try again.')); }, 10000);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    worker.onmessage = ({ data }) => { cleanup(); resolve(data); };
    worker.onerror = event => { event.preventDefault(); cleanup(); reject(new Error('SQL engine could not load. Refresh and try again.')); };
    worker.postMessage(data);
  });
}
function ResultTable({ result, label }) {
  if (!result?.columns) return null;
  return <div className="sql-table-wrap"><table><caption>{label}</caption><thead><tr>{result.columns.map((column, index) => <th key={index} scope="col">{column}</th>)}</tr></thead><tbody>{result.values.map((values, row) => <tr key={row}>{values.map((value, column) => <td key={column}>{value === null ? <span className="sql-null">NULL</span> : String(value)}</td>)}</tr>)}</tbody></table>{!result.values.length && <p className="sql-muted">No rows returned.</p>}{result.truncated && <p className="sql-muted">Showing the first 500 rows.</p>}</div>;
}
const hints = {
  'DDL Basics': 'Define the table or column structure with CREATE TABLE, ALTER TABLE, or DROP TABLE. Match the requested constraints.',
  'Basic CRUD': 'Choose SELECT, INSERT, UPDATE, or DELETE for the requested action. Use WHERE to restrict affected rows.',
  'Foreign Keys': 'Define the foreign key on the child table. ON DELETE controls what happens to child rows.',
  'Aggregates': 'Use an aggregate function and GROUP BY when the result is required for each department.',
  'UNION vs. UNION ALL': 'UNION removes duplicate result rows; UNION ALL preserves them. Align the selected columns.',
  'Joins': 'Match the related IDs in an ON clause. An outer join preserves unmatched rows from the requested side.',
  'Subqueries': 'Use an inner query to compute the set or value needed by the outer query. Consider NULL behavior.',
  'Nth Highest Salary': 'Decide how ties affect the rank. DISTINCT, RANK, DENSE_RANK and ROW_NUMBER produce different rankings.',
  'Duplicate Rows': 'Group by the columns that define a duplicate, then identify one row to retain per group.',
  'CASE Statement': 'Use CASE WHEN to express the conditions in order and ELSE for the remaining rows.',
  'String Functions': 'SQLite provides upper, substr, replace and instr. Check whether the requested position is from the start or end.',
  'Date Functions': 'Use SQLite date functions and ISO YYYY-MM-DD dates. Test the boundary conditions.',
  'Miscellaneous Queries': 'Break the task into the required columns, source tables, conditions, and ordering.'
};

export default function SqlLab({ questions }) {
  const [selected, setSelected] = useState(() => readPreference('sql-lab:selected', questions[0].id, id => questions.some(question => question.id === id)));
  const [query, setQuery] = useState('');
  const drawer = useRef(null), search = useRef(null), menu = useRef(null);
  const current = questions.find(question => question.id === selected) || questions[0];
  const index = questions.indexOf(current);
  const draft = useExerciseDraft(current, 'sql');
  const runAction = useRef(() => {}), checkAction = useRef(() => {});
  const filtered = questions.filter(question => (question.title + ' ' + question.category).toLowerCase().includes(query.trim().toLowerCase()));
  const categories = [...new Set(filtered.map(question => question.category))];
  function select(id) { setSelected(id); writePreference('sql-lab:selected', id); drawer.current?.close(); }
  function showQuestions() { drawer.current.showModal(); search.current.focus(); }
  return <main className="sql-lab">
    <header className="sql-lab-header">
      <button className="sql-lab-menu" onClick={showQuestions} ref={menu} aria-haspopup="dialog" aria-controls="sql-question-drawer"><span aria-hidden="true">☰</span> SQL Lab</button>
      <button aria-label="Previous SQL question" disabled={index === 0} onClick={() => select(questions[index - 1].id)}>‹</button>
      <button aria-label="Next SQL question" disabled={index === questions.length - 1} onClick={() => select(questions[index + 1].id)}>›</button>
      <span className="sql-question-count">{current.id} / {questions.length}</span><div className="sql-header-actions"><button className="sql-run-button" disabled={!current.runnable || !draft.code.trim()} onClick={() => runAction.current()}>▶ Run</button><CloudSaveControls compact draft={draft} onSubmit={draft.saveToCloud} /></div>
    </header>
    {current.canCheck && <button className="sql-check-button" disabled={!current.runnable || !draft.code.trim()} onClick={() => checkAction.current()}>Check sample</button>}
    <SqlQuestion key={current.id} question={current} draft={draft} runAction={runAction} checkAction={checkAction} />
    <dialog id="sql-question-drawer" className="sql-question-drawer" ref={drawer} aria-label="SQL Lab questions" onClose={() => menu.current?.focus()} onClick={event => { if (event.target === event.currentTarget) drawer.current.close(); }}>
      <div className="sql-drawer-inner"><div className="sql-drawer-header"><h2>SQL Lab</h2><button aria-label="Close SQL questions" onClick={() => drawer.current.close()}>×</button></div>
        <label className="sql-search-label"><span className="sql-sr-only">Search SQL questions</span><input ref={search} type="search" placeholder="Search questions" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div className="sql-question-list">{categories.map(category => <section key={category}><h3>{category}</h3>{filtered.filter(question => question.category === category).map(question => <button key={question.id} className="sql-question-button" data-question-id={question.id} aria-current={current.id === question.id ? 'page' : undefined} onClick={() => select(question.id)}><span className="sql-question-dot" /><span>{question.id}. {question.title}</span><small>{question.runnable ? 'SQLite' : 'MySQL'}</small></button>)}</section>)}{!filtered.length && <p className="sql-muted">No questions match your search.</p>}</div>
      </div>
    </dialog>
  </main>;
}
function SqlQuestion({ question, draft, runAction, checkAction }) {
  const { code, setCode, saveStatus } = draft;
  const [leftTab, setLeftTab] = useState('description');
  const [resultTab, setResultTab] = useState('testcase');
  const [schema, setSchema] = useState(null);
  const [output, setOutput] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [snapshot, setSnapshot] = useState(null);
  const [notes, setNotes] = useState(() => readPreference('sql-notes:' + question.id, '', value => typeof value === 'string'));
  const [width, setWidth] = useState(48), [height, setHeight] = useState(55), [expanded, setExpanded] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const request = useRef(null), grid = useRef(null), right = useRef(null), gutter = useRef(null), editor = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    sqlJob({ mode: 'inspect', setup: question.setup, reference: question.runnable ? question.solution : '', preview: question.preview }, controller.signal).then(setSchema).catch(error => { if (error.name !== 'AbortError') setSchema({ error: error.message }); });
    return () => { controller.abort(); request.current?.abort(); };
  }, [question]);
  async function run(mode = 'run') {
    if (!question.runnable || request.current) return;
    if (!code.replace(/--[^\n]*/g, '').trim()) { setResultTab('result'); setOutput({ error: 'Write a query before running.' }); return; }
    const controller = new AbortController(); request.current = controller; setBusy(true); setResultTab('result'); setOutput(null); setSnapshot(code);
    const started = performance.now();
    try {
      const result = await sqlJob({ mode, setup: question.setup, code, preview: question.preview, reference: question.solution,
        ordered: /sort|order|first record|last record|top \d|top N|first N/i.test(question.title) }, controller.signal);
      if (!controller.signal.aborted) setOutput({ ...result, runtime: Math.round(performance.now() - started), mode });
    } catch (error) { if (!controller.signal.aborted) setOutput({ error: error.message }); }
    finally { if (!controller.signal.aborted) setBusy(false); request.current = null; }
  }
  runAction.current = () => run();
  checkAction.current = () => run('check');
  function loadSolution() {
    if (code !== question.starter && code !== question.solution && !window.confirm('Replace your query with the solution?')) return;
    setCode(question.solution); setNotice('Solution loaded into the editor.');
  }
  function reset() {
    if (code !== question.starter && !window.confirm('Reset your query to the starter?')) return;
    setCode(question.starter); setOutput(null); setSnapshot(null); setNotice('');
  }
  function resize(event, axis) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const box = (axis === 'x' ? grid : right).current.getBoundingClientRect();
    if (axis === 'x') setWidth(Math.max(28, Math.min(65, (event.clientX - box.left) / box.width * 100)));
    else setHeight(Math.max(28, Math.min(75, (event.clientY - box.top) / box.height * 100)));
  }
  const resizeEvents = axis => ({ onPointerDown: event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); },
    onPointerMove: event => resize(event, axis), onPointerUp: event => event.currentTarget.releasePointerCapture(event.pointerId),
    onKeyDown: event => { const down = axis === 'x' ? 'ArrowLeft' : 'ArrowUp', up = axis === 'x' ? 'ArrowRight' : 'ArrowDown'; if (![down, up].includes(event.key)) return; event.preventDefault(); (axis === 'x' ? setWidth : setHeight)(value => Math.max(28, Math.min(axis === 'x' ? 65 : 75, value + (event.key === up ? 2 : -2)))); } });
  return <section className={'sql-lab-grid' + (expanded ? ' editor-expanded' : '')} ref={grid} data-question-id={question.id} style={{ '--description-width': width + '%', '--code-height': height + '%' }}>
    <section className="sql-description-panel" aria-label="SQL question">
      <nav className="sql-panel-tabs" aria-label="SQL question views">{[['description','Description'],['solution','Solution'],['notes','Notes']].map(([id,label]) => <button key={id} aria-pressed={leftTab === id} onClick={() => setLeftTab(id)}>{label}</button>)}</nav>
      <div className="sql-description-scroll">
        {leftTab === 'description' && <><h1>{question.id}. {question.title}</h1><div className="sql-tags"><span>{question.category}</span><span>{question.runnable ? 'SQLite' : 'MySQL · Reference'}</span></div>{question.description && <p>{question.description}</p>}<p>{question.runnable ? 'Write a query that satisfies the question. Use the sample tables below.' : 'This stored procedure requires MySQL. It cannot run in the SQLite lab.'}</p>
          <h2>Tables</h2>{!schema && <p className="sql-muted">Loading sample data…</p>}{schema?.error && <p className="sql-error">{schema.error}</p>}{schema?.tables?.length === 0 && <p className="sql-muted">This question starts with an empty database.</p>}
          {schema?.tables?.map(table => <section key={table.name} className="sql-schema"><h3>{table.name}</h3><ResultTable label={table.name + ' columns'} result={table.schema && { columns: ['Column name', 'Type', 'Constraints'], values: table.schema.values.map(row => [row[1], row[2], [row[5] ? 'PRIMARY KEY' : '', row[3] ? 'NOT NULL' : ''].filter(Boolean).join(', ') || '—']) }} /><ResultTable label={table.name + ' sample rows'} result={table.data} /></section>)}
          <h2>Expected sample output</h2>{question.canCheck ? schema?.expected?.results?.map((result,index) => <ResultTable key={index} result={result} label={'Output ' + (index + 1)} />) : <p>Run the statement and inspect its effect on the database schema below.</p>}{schema?.expected && !schema.expected.results?.length && <p>The statement executes successfully. Use Run to inspect its effects.</p>}<p className="sql-muted">{question.canCheck ? 'Check sample compares column names and rows using the provided data. Each run starts with fresh data.' : question.runnable ? 'DDL changes can be explored with Run. Review the resulting schema and constraints.' : 'Read the solution and run it in a MySQL environment.'}</p>
          <details className="sql-hint"><summary>Hint 1</summary><p>{hints[question.category] || 'Identify the required tables, columns, conditions and output shape first.'}</p></details><details className="sql-hint"><summary>Hint 2</summary><p>Test the sample data, then consider duplicate values, NULLs, and boundary cases. Match the requested output column names.</p></details>
          <details className="sql-setup"><summary>Sample setup SQL</summary><pre>{question.setup}</pre></details>
        </>}
        {leftTab === 'solution' && <><h1>Solution</h1><button className="sql-load-solution" onClick={loadSolution}>Load solution into editor</button>{notice && <p role="status">{notice}</p>}{question.note && <p>{question.note}</p>}<pre>{question.solution}</pre>{question.solution !== question.original.trim() && <><h2>Original snippet</h2><pre>{question.original}</pre></>}</>}
        {leftTab === 'notes' && <><h1>Notes</h1><p className="sql-muted">Saved locally for this question.</p><textarea aria-label="SQL question notes" className="sql-notes" value={notes} onChange={event => { setNotes(event.target.value); setNotice(writePreference('sql-notes:' + question.id, event.target.value) ? 'Notes saved locally.' : 'Notes could not be saved.'); }} placeholder="Your approach, edge cases, and follow-up ideas…" />{notice && <p role="status">{notice}</p>}</>}
      </div>
    </section>
    <div className="sql-divider vertical" role="separator" aria-label="Resize SQL description" aria-orientation="vertical" aria-valuemin={28} aria-valuemax={65} aria-valuenow={Math.round(width)} tabIndex={0} {...resizeEvents('x')} />
    <section className="sql-right-panel" ref={right}>
      <section className="sql-editor-panel" aria-label="SQL code workspace">
        <div className="sql-code-heading"><strong><span aria-hidden="true">〈/〉</span> Code</strong><div><button aria-label="Copy SQL code" onClick={async () => { try { await navigator.clipboard.writeText(code); setNotice('Query copied.'); } catch { setNotice('Select your query to copy it.'); } }}>Copy</button><button aria-label="Expand SQL editor" aria-pressed={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Restore' : 'Expand'}</button><button onClick={reset}>Reset</button></div></div>
        <div className="sql-editor-actions"><span>SQLite</span></div>
        <div className="sql-editor-area"><pre className="sql-line-numbers" ref={gutter} aria-hidden="true">{Array.from({ length: code.split('\n').length }, (_,index) => index + 1).join('\n')}</pre><textarea ref={editor} aria-label="SQL code" className="sql-lab-code" spellCheck="false" wrap="off" value={code} onChange={event => setCode(event.target.value)}
          onSelect={event => { const before = event.target.value.slice(0,event.target.selectionStart); setCursor({ line: before.split('\n').length, column: before.length - before.lastIndexOf('\n') }); }}
          onScroll={event => { gutter.current.scrollTop = event.currentTarget.scrollTop; }}
          onKeyDown={event => { if (event.key !== 'Tab') return; event.preventDefault(); const target = event.currentTarget, start = target.selectionStart, end = target.selectionEnd; setCode(code.slice(0,start) + '    ' + code.slice(end)); requestAnimationFrame(() => target.setSelectionRange(start + 4,start + 4)); }} /></div>
        <footer className="sql-editor-status"><span role="status">{saveStatus}</span><span>Ln {cursor.line}, Col {cursor.column}</span></footer>
      </section>
      <div className="sql-divider horizontal" role="separator" aria-label="Resize SQL results" aria-orientation="horizontal" aria-valuemin={28} aria-valuemax={75} aria-valuenow={Math.round(height)} tabIndex={0} {...resizeEvents('y')} />
      <section className="sql-output-panel" aria-label="SQL results"><nav className="sql-panel-tabs" aria-label="SQL result views"><button aria-pressed={resultTab === 'testcase'} onClick={() => setResultTab('testcase')}>☑ Testcase</button><button aria-pressed={resultTab === 'result'} onClick={() => setResultTab('result')}>Test Result</button></nav>
        <div className="sql-output-scroll" role="status" aria-busy={busy}>
          {resultTab === 'testcase' ? <>{schema?.tables?.map(table => <ResultTable key={table.name} result={table.data} label={table.name} />)}{schema?.tables?.length === 0 && <p className="sql-muted">No initial tables. Write the requested DDL statement.</p>}</> : <>
            {busy && <p>Running query…</p>}{snapshot !== null && snapshot !== code && <p className="sql-stale">Your query changed after this run.</p>}{output?.error && <><h2 className="sql-error">SQL Error</h2><pre>{output.error}</pre></>}
            {output && !output.error && <><h2 className={output.comparison ? output.comparison.passed ? 'sql-success' : 'sql-error' : ''}>{output.comparison ? output.comparison.passed ? 'Sample Passed' : 'Wrong Answer' : 'Query completed'}</h2><p className="sql-muted">Runtime: {output.runtime} ms · {output.changed} row changes</p>{output.comparison && <p className="sql-verdict">{output.comparison.message}</p>}{output.results.map((result,index) => <ResultTable key={index} result={result} label={'Actual output ' + (index + 1)} />)}{output.expected?.map((result,index) => <ResultTable key={index} result={result} label={'Expected output ' + (index + 1)} />)}{!output.results.length && <p className="sql-muted">No result rows. The statement completed.</p>}</>}
            {!busy && !output && <p className="sql-muted">Run a query to see results here.</p>}
          </>}
        </div>
      </section>
    </section>
  </section>;
}
