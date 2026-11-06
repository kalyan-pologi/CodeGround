import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { executeJava } from '../practice/src/services/compiler';
import './task-workbench.css';

const TaskCodeEditor = lazy(() => import('./TaskCodeEditor'));

export default function TaskWorkbench({ tasks, initialSelectedId, kind = 'task' }) {
  const plural = kind === 'challenge' ? 'Challenges' : 'Tasks';
  const singular = kind === 'challenge' ? 'Challenge' : 'Task';
  const [selectedId, setSelectedId] = useState(initialSelectedId || null);
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('All');
  const [tab, setTab] = useState('description');
  const [drafts, setDrafts] = useState({});
  const [inputs, setInputs] = useState({});
  const [runs, setRuns] = useState({});
  const [runningId, setRunningId] = useState(null);
  const [notice, setNotice] = useState('');
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  const task = tasks.find(item => item.id === selectedId);
  const topics = [...new Set(tasks.map(item => item.topic))];
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = tasks.filter(item => (topic === 'All' || item.topic === topic)
    && `${item.id} ${item.title} ${item.topic}`.toLowerCase().includes(normalizedQuery));
  const code = task ? drafts[task.id] ?? task.starter : '';
  const input = task ? inputs[task.id] || '' : '';
  const run = task && runs[task.id];
  const index = task ? tasks.indexOf(task) : -1;
  function open(id) { setSelectedId(id); setTab('description'); setNotice(''); }
  function back() { setSelectedId(null); setNotice(''); }
  function reset() {
    if (code !== task.starter && !window.confirm('Reset this task to its starter code?')) return;
    setDrafts(previous => ({ ...previous, [task.id]: task.starter }));
    setNotice('Starter code restored.');
  }
  async function copy() {
    try { await navigator.clipboard.writeText(code); setNotice('Code copied.'); }
    catch { setNotice('Select the code in the editor to copy it.'); }
  }
  async function runCode() {
    if (!task || task.runtime === 'project' || request.current || !code.trim()) return;
    const id = task.id, source = code, stdin = input;
    const controller = new AbortController(); request.current = controller; setRunningId(id);
    setRuns(previous => ({ ...previous, [id]: { source, stdin, loading: true, status: 'Submitting…' } }));
    try {
      const result = await executeJava(source, stdin, {
        signal: controller.signal,
        onStatus: status => setRuns(previous => ({ ...previous, [id]: { ...previous[id], status: status.description || 'Running…' } }))
      });
      if (!controller.signal.aborted) setRuns(previous => ({ ...previous, [id]: { source, stdin, result } }));
    } catch (error) {
      if (!controller.signal.aborted) setRuns(previous => ({ ...previous, [id]: { source, stdin, error: error.message } }));
    } finally {
      if (!controller.signal.aborted) setRunningId(null);
      if (request.current === controller) request.current = null;
    }
  }

  if (!task) return <main className="task-app task-catalog">
    <header className="task-list-header"><div><p className="task-eyebrow">{kind === 'challenge' ? 'Java Practice Exercises' : 'ReidyAI practice'}</p><h1>{plural}</h1><p>Choose a {kind} to start solving.</p></div><span className="task-total">{tasks.length} {plural.toLowerCase()}</span></header>
    <div className="task-list-filters"><input type="search" aria-label={`Search ${plural.toLowerCase()}`} placeholder="Search by title or topic" value={query} onChange={event => setQuery(event.target.value)} />
      <select aria-label={`Filter ${plural.toLowerCase()} by topic`} value={topic} onChange={event => setTopic(event.target.value)}><option value="All">All topics</option>{topics.map(value => <option key={value}>{value}</option>)}</select>
      <span>{filtered.length} shown</span></div>
    <div className="task-list-columns" aria-hidden="true"><span>#</span><span>{singular}</span><span>Level</span><span>Environment</span></div>
    <ol className="task-title-list">{filtered.map(item => <li key={item.id}><button data-task-id={item.id} onClick={() => open(item.id)} aria-label={`Open ${kind} ${item.id}: ${item.title}`}>
      <span className="task-number">{item.id}</span><span className="task-row-title"><strong>{item.title}</strong><small>{item.topic}{item.scenarioId ? ' · Production scenario' : ''}</small></span>
      <span className="task-level">{item.difficulty}</span><span className="task-runtime">{item.runtime === 'project' ? 'Project' : 'Java 17'}</span>
    </button></li>)}</ol>
    {!filtered.length && <div className="task-empty"><p>No {plural.toLowerCase()} match your filters.</p><button onClick={() => { setTopic('All'); setQuery(''); }}>Clear filters</button></div>}
  </main>;

  return <main className="task-app task-detail" data-task-id={task.id}>
    <header className="task-detail-toolbar"><button className="back-to-tasks" onClick={back}>← {plural}</button><span>{singular} {task.id} of {tasks.length}</span><div><button aria-label={`Previous ${kind}`} disabled={index === 0} onClick={() => open(tasks[index - 1].id)}>←</button><button aria-label={`Next ${kind}`} disabled={index === tasks.length - 1} onClick={() => open(tasks[index + 1].id)}>→</button></div></header>
    <div className="task-split">
      <section className="task-question-pane" aria-label="Task question">
        <nav className="task-question-tabs" aria-label="Question views">{['description', 'hints', 'solution'].map(value => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</nav>
        <div className="task-question-content"><div className="task-question-meta"><span className="task-level">{task.difficulty}</span><span>{task.topic}</span></div><h1>{task.id}. {task.title}</h1>
          {tab === 'description' && <><p>{task.statement}</p>
            {task.incident && <><h2>Symptoms</h2><ul>{task.incident.symptoms.map(value => <li key={value}>{value}</li>)}</ul><h2>Investigate</h2><ol>{task.incident.investigate.map(value => <li key={value}>{value}</li>)}</ol></>}
            {task.requirements && <section aria-label="Task requirements"><h2>Requirements</h2><ol>{task.requirements.map(value => <li key={value}>{value}</li>)}</ol></section>}
            <h2>Expected output / acceptance checks</h2><pre><code>{task.expected}</code></pre><h2>Checks and context</h2><p>{task.notes}</p>
          </>}
          {tab === 'hints' && <><p>Open one hint at a time.</p><section aria-label="Step-by-step hints">{(task.hintSteps || [task.pseudocode]).map((hint, hintIndex) => <details key={`${task.id}-${hintIndex}`}><summary>Hint {hintIndex + 1}</summary><p>{hint}</p></details>)}</section><h2>Suggested approach</h2><p>{task.pseudocode}</p></>}
          {tab === 'solution' && <><button className="load-solution" onClick={() => {
            if (code !== task.starter && code !== task.solution && !window.confirm('Replace your current draft with the solution?')) return;
            setDrafts(previous => ({ ...previous, [task.id]: task.solution })); setNotice('Solution loaded into editor.');
          }}>Load solution into editor</button><pre><code>{task.solution}</code></pre>{task.explanation && <section aria-label="Solution explanation"><h2>Why this approach</h2>{task.explanation.map(value => <p key={value}>{value}</p>)}</section>}</>}
        </div>
      </section>
      <section className="task-code-pane" aria-label="Task code workspace">
        <div className="task-code-toolbar"><span>{(task.language || 'java').toUpperCase()}</span><div><button onClick={copy}>Copy</button><button onClick={reset}>Reset</button><button className="task-run" onClick={runCode} disabled={task.runtime === 'project' || runningId !== null || !code.trim()}>{task.runtime === 'project' ? 'Run in project' : runningId === task.id ? 'Running…' : 'Run Code'}</button></div></div>
        <div className="task-editor" aria-label="Code editor"><Suspense fallback={<p role="status">Loading editor…</p>}><TaskCodeEditor task={task} code={code} onChange={value => setDrafts(previous => ({ ...previous, [task.id]: value }))} /></Suspense></div>
        <div className="task-console"><details><summary>Standard input</summary><textarea aria-label="Standard input" rows="3" value={input} onChange={event => setInputs(previous => ({ ...previous, [task.id]: event.target.value }))} placeholder="Optional input for System.in" /></details>
          <p className="task-execution-note">{task.executionNote || (task.runtime === 'project' ? task.environment + '. Run this task with its required project dependencies.' : 'Runs Java 17 through Judge0. A single Main class is supported.')}</p>
          {notice && <p role="status">{notice}</p>}
          {run && <section aria-label="Execution result" aria-busy={Boolean(run.loading)}><h2>Execution result</h2>{(run.source !== code || run.stdin !== input) && <p>Code or input has changed since this run.</p>}{run.loading && <p role="status">{run.status}</p>}{run.error && <p role="alert">{run.error}</p>}{run.result && <><p role="status">{run.result.status.description || 'Completed'}</p><pre><code>{[run.result.stdout || '(no stdout)', run.result.stderr, run.result.compile_output, run.result.message].filter(Boolean).join('\n')}</code></pre></>}</section>}
        </div>
      </section>
    </div>
  </main>;
}
