import { lazy, Suspense, useRef, useState } from 'react';
import { useExerciseDraft } from '../../../components/cloud-save/exercise-drafts';
import { reactTasks } from './tasks';
import reactRuntime from '../../../../node_modules/react/umd/react.production.min.js?raw';
import reactDomRuntime from '../../../../node_modules/react-dom/umd/react-dom.production.min.js?raw';
import './react-practice.css';

const CodeEditor = lazy(() => import('../../../components/workspace/TaskCodeEditor'));

function previewDocument(source, failedApi) {
  const safeSource = JSON.stringify(source).replace(/</g, '\\u003c');
  const safeReactRuntime = reactRuntime.replace(/<\//g, '<\\/');
  const safeReactDomRuntime = reactDomRuntime.replace(/<\//g, '<\\/');
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    *{box-sizing:border-box}body{margin:0;background:#fff;color:#17212b;font:15px/1.5 system-ui,sans-serif}main{max-width:650px;margin:auto;padding:22px}h1{font-size:24px}button,input{font:inherit;padding:7px 10px;margin:4px;border:1px solid #aab5bf;border-radius:5px}button{cursor:pointer;background:#e6f2ee}input{max-width:100%}label{display:block;margin:8px 0}li{padding:4px}#error{white-space:pre-wrap;color:#a21e25;padding:16px;margin:0}
  </style></head><body><div id="root"></div><pre id="error" role="alert" hidden></pre>
  <script>${safeReactRuntime}</script><script>${safeReactDomRuntime}</script><script>
    let mockFailure = ${failedApi ? 'true' : 'false'};
    let nextEmployeeId = 3;
    let employees = [{ id: 1, name: 'Ada' }, { id: 2, name: 'Ben' }];
    addEventListener('message', event => { if (event.data?.type === 'react-practice-api-failure') mockFailure = event.data.enabled === true; });
    window.fetch = (path, options = {}) => new Promise((resolve, reject) => {
      const requestPath = String(path).startsWith('http') ? new URL(path).pathname : String(path);
      const employeePath = requestPath.startsWith('/api/employees/') && requestPath.split('/').pop().split('').every(character => character >= '0' && character <= '9');
      if (requestPath !== '/api/employees' && !employeePath) { reject(new Error('This preview only mocks /api/employees CRUD routes')); return; }
      if (options.signal?.aborted) { reject(new DOMException('Request aborted', 'AbortError')); return; }
      const method = options.method || 'GET';
      const id = employeePath ? Number(requestPath.split('/').pop()) : null;
      const body = options.body ? JSON.parse(options.body) : {};
      const timer = setTimeout(() => {
        if (mockFailure) { resolve(new Response(JSON.stringify({ message: 'Service unavailable' }), { status: 503 })); return; }
        if (method === 'GET') { resolve(new Response(JSON.stringify(employees), { status: 200 })); return; }
        if (method === 'POST') {
          if (!body.name?.trim()) { resolve(new Response(JSON.stringify({ message: 'Name is required' }), { status: 400 })); return; }
          const employee = { id: nextEmployeeId++, name: body.name.trim() }; employees = [...employees, employee]; resolve(new Response(JSON.stringify(employee), { status: 201 })); return;
        }
        const index = employees.findIndex(employee => String(employee.id) === String(id));
        if (index < 0) { resolve(new Response(JSON.stringify({ message: 'Staff member not found' }), { status: 404 })); return; }
        if (method === 'PUT') { const updated = { ...employees[index], name: body.name?.trim() || employees[index].name }; employees = employees.map(employee => String(employee.id) === String(id) ? updated : employee); resolve(new Response(JSON.stringify(updated), { status: 200 })); return; }
        if (method === 'DELETE') { employees = employees.filter(employee => String(employee.id) !== String(id)); resolve(new Response(null, { status: 204 })); return; }
        resolve(new Response(JSON.stringify({ message: 'Method not supported' }), { status: 405 }));
      }, 350);
      options.signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Request aborted', 'AbortError')); }, { once: true });
    });
    try {
      new Function('React', 'ReactDOM', ${safeSource} + '\\nReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));')(React, ReactDOM);
    } catch (error) { const target = document.getElementById('error'); target.hidden = false; target.textContent = error.message; }
    addEventListener('error', event => { const target = document.getElementById('error'); target.hidden = false; target.textContent = event.message; });
    addEventListener('unhandledrejection', event => { const target = document.getElementById('error'); target.hidden = false; target.textContent = String(event.reason); });
  </script></body></html>`;
}

function ReactTask({ task, onBack, onSelect }) {
  const { code, setCode, saveStatus } = useExerciseDraft(task, 'react');
  const [view, setView] = useState('problem');
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [failedApi, setFailedApi] = useState(false);
  const [codeHeight, setCodeHeight] = useState(420);
  const [editorVersion, setEditorVersion] = useState(0);
  const grid = useRef(null);
  const frame = useRef(null);
  const index = reactTasks.indexOf(task);

  async function runPreview() {
    setRunning(true);
    setError('');
    try {
      if (/^\s*(?:import|export)\s/m.test(code)) throw new Error('Write an App function without import or export statements. React is already available.');
      const ts = await import('typescript');
      const result = ts.transpileModule(code, {
        fileName: 'App.jsx', reportDiagnostics: true,
        compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None }
      });
      const problems = result.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error) || [];
      if (problems.length) throw new Error(problems.map(item => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('\n'));
      setPreview(previewDocument(result.outputText, failedApi));
    } catch (failure) {
      setPreview('');
      setError(failure instanceof Error ? failure.message : 'Preview could not run.');
    } finally { setRunning(false); }
  }
  function toggleFailure(event) {
    const enabled = event.target.checked;
    setFailedApi(enabled);
    frame.current?.contentWindow?.postMessage({ type: 'react-practice-api-failure', enabled }, '*');
  }
  function reset() {
    setCode(task.starter);
    setEditorVersion(version => version + 1);
    setPreview(''); setError('');
  }
  function loadSolution() {
    if (code !== task.solution && !window.confirm('Replace your draft with the solution?')) return;
    setCode(task.solution);
    setEditorVersion(version => version + 1);
    setPreview(''); setError('');
  }
  function resizePreview(event) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = grid.current?.getBoundingClientRect();
    if (!bounds) return;
    const next = event.clientY - bounds.top;
    setCodeHeight(Math.max(220, Math.min(bounds.height - 180, next)));
  }
  return <main className="react-practice react-task">
    <header className="react-task-bar">
      <button onClick={onBack}>← All tasks</button>
      <strong>React Practice</strong>
      <span>{index + 1} / {reactTasks.length}</span>
      <button disabled={index === 0} onClick={() => onSelect(reactTasks[index - 1].id)} aria-label="Previous task">←</button>
      <button disabled={index === reactTasks.length - 1} onClick={() => onSelect(reactTasks[index + 1].id)} aria-label="Next task">→</button>
    </header>
    <div className="react-task-grid" ref={grid} style={{ '--react-code-height': `${codeHeight}px` }}>
      <section className="react-task-panel react-instructions" aria-label="Task instructions">
        <nav aria-label="Task views"><button aria-pressed={view === 'problem'} onClick={() => setView('problem')}>Description</button><button aria-pressed={view === 'hint'} onClick={() => setView('hint')}>Hints</button><button aria-pressed={view === 'solution'} onClick={() => setView('solution')}>Solution</button></nav>
        <div className="react-panel-content">
          {view === 'problem' && <><p className="react-meta">{task.difficulty} · {task.topic}</p><h1>{task.title}</h1><p>{task.statement}</p><h2>Requirements</h2><ol>{task.requirements.map(item => <li key={item}>{item}</li>)}</ol><h2>Try these cases</h2><p>{task.expected}</p><h2>Context</h2><p>{task.notes}</p>{task.followUp && <><h2>{task.followUpTitle}</h2><p>{task.followUp}</p></>}</>}
          {view === 'hint' && <><h1>Hints</h1>{task.hints.map((hint, position) => <details key={hint}><summary>Hint {position + 1}</summary><p>{hint}</p></details>)}</>}
          {view === 'solution' && <><div className="react-solution-heading"><h1>Solution</h1><button onClick={loadSolution}>Load into editor</button></div><pre className="react-solution-code"><code>{task.solution}</code></pre></>}
        </div>
      </section>
      <section className="react-task-panel react-code" aria-label="React code editor">
        <div className="react-pane-heading"><strong>App.jsx</strong><span>{saveStatus}</span><button onClick={reset}>Reset</button><button className="react-primary" onClick={runPreview} disabled={running}>{running ? 'Preparing…' : '▶ Run preview'}</button></div>
        <div className="react-editor"><Suspense fallback={<p>Loading editor…</p>}><CodeEditor key={editorVersion} task={{ id: `react-${task.id}`, language: 'javascript' }} code={code} onChange={setCode} /></Suspense></div>
      </section>
      <div className="react-horizontal-divider" role="separator" aria-label="Resize live preview" aria-orientation="horizontal" aria-valuemin="220" aria-valuemax="900" aria-valuenow={Math.round(codeHeight)} tabIndex="0"
        onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={resizePreview}
        onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
        onKeyDown={event => { if (['ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); setCodeHeight(value => Math.max(220, value + (event.key === 'ArrowUp' ? -24 : 24))); } }}><span /></div>
      <section className="react-task-panel react-output" aria-label="Live preview">
        <div className="react-pane-heading"><strong>Live preview</strong>{task.id === 5 && <label><input type="checkbox" checked={failedApi} onChange={toggleFailure} /> Simulate API failure</label>}</div>
        {error && <p className="react-preview-error" role="alert">{error}</p>}
        {preview ? <iframe ref={frame} title={`${task.title} preview`} sandbox="allow-scripts allow-forms" srcDoc={preview} /> : !error && <p className="react-preview-empty">Click Run preview to try your component.</p>}
      </section>
    </div>
  </main>;
}

export default function ReactPractice({ initialSelectedId }) {
  const [selectedId, setSelectedId] = useState(initialSelectedId || null);
  const task = reactTasks.find(item => item.id === selectedId);
  if (task) return <ReactTask key={task.id} task={task} onBack={() => setSelectedId(null)} onSelect={setSelectedId} />;
  return <main className="react-practice react-task-list">
    <header><div><p className="react-meta">Web / React</p><h1>React coding tasks</h1><p>Five practical lender and trainer exercises covering components, state, routing, API services, and UI performance. Task 5 includes an Angular/RxJS follow-up from the job description.</p></div><span>5 tasks</span></header>
    <ol>{reactTasks.map(item => <li key={item.id}><button onClick={() => setSelectedId(item.id)}><span>{item.id.toString().padStart(2, '0')}</span><strong>{item.title}</strong><small>{item.topic} · {item.difficulty}</small><span aria-hidden="true">→</span></button></li>)}</ol>
  </main>;
}
