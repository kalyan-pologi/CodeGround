import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { executeJava } from '../practice/src/services/compiler';
import { useExerciseDraft, readPreference, writePreference } from './exercise-drafts';
import { sampleChecksFor, assessSample } from './exercise-samples';
import './exercise-workspace.css';
import QuestionDrawer from './QuestionDrawer';

const Editor = lazy(() => import('./TaskCodeEditor'));

export default function ExerciseWorkspace({ task, kind = 'task', onBack, onPrevious, onNext, questions, onSelect }) {
  const bank = kind === 'challenge' ? 'java' : 'reidy';
  const { code, stdin, setCode, setStdin, saveStatus } = useExerciseDraft(task, bank);
  const project = task.runtime === 'project';
  const samples = useMemo(() => sampleChecksFor(task, kind), [task, kind]);
  const editorTask = useMemo(() => ({ ...task, id: bank + '-' + task.id }), [task, bank]);
  const filename = task.language === 'sql' ? 'query.sql' : task.language === 'yaml' ? 'application.yaml' : project ? 'Exercise.java' : 'Main.java';
  const [checkResults, setCheckResults] = useState([]);
  const [snapshot, setSnapshot] = useState(null);
  const [file, setFile] = useState('code');
  const questionDrawer = useRef(null), questionButton = useRef(null);
  function selectFile(id) { setFile(id); }
  const [view, setView] = useState('problem');
  const [resultTab, setResultTab] = useState('testcase');
  const [height, setHeight] = useState(68);
  const codeSplit = useRef(null);
  const [width, setWidth] = useState(() => readPreference('workspace:problem-width:v2', 43, value => typeof value === 'number' && value >= 28 && value <= 65));
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const split = useRef(null), request = useRef(null);
  useEffect(() => { writePreference('workspace:problem-width:v2', width); }, [width]);

  useEffect(() => () => request.current?.abort(), []);
  function reset() {
    if (code !== task.starter && !window.confirm('Reset your code to the starter?')) return;
    setCode(task.starter); setResult(null); setCheckResults([]); setStatus(''); setNotice('');
  }
  function loadSolution() {
    if (code !== task.starter && code !== task.solution && !window.confirm('Replace your draft with the solution?')) return;
    setCode(task.solution); setFile('code'); setNotice('Solution loaded into ' + filename + '.');
  }
  async function run(mode = 'run') {
    if (project || request.current || !code.trim()) return;
    const source = code, input = stdin;
    const controller = new AbortController(); request.current = controller;
    setResultTab('result'); setBusy(true); setResult(null); setCheckResults([]); setStatus('Submitting…'); setNotice('');
    setSnapshot({ code: source, stdin: input, mode });
    try {
      if (mode === 'checks') {
        const outcomes = [];
        for (const sample of samples) {
          const output = await executeJava(source, sample.stdin, { signal: controller.signal, onStatus: value => setStatus(value.description) });
          if (controller.signal.aborted) return;
          outcomes.push({ ...sample, actual: output.stdout || '', passed: assessSample(output, sample), result: output });
          setCheckResults([...outcomes]); setResult(output);
        }
        setStatus(outcomes.filter(check => check.passed).length + '/' + outcomes.length + ' sample checks passed');
      } else {
        const output = await executeJava(source, input, { signal: controller.signal, onStatus: value => setStatus(value.description) });
        if (!controller.signal.aborted) { setResult(output); setStatus(output.status.description); }
      }
    } catch (error) { if (!controller.signal.aborted) setStatus(error.message); }
    finally { if (!controller.signal.aborted) setBusy(false); request.current = null; }
  }
  function resize(event) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = split.current.getBoundingClientRect();
    setWidth(Math.max(28, Math.min(65, (event.clientX - bounds.left) / bounds.width * 100)));
  }
  return <main className="sample-app exercise-workspace" data-task-id={task.id}>
    <header className="sample-header">
      <button className="sample-explorer-toggle sample-questions-toggle" ref={questionButton} aria-label="Open question list" aria-haspopup="dialog" onClick={() => questionDrawer.current.open()}>☰</button>
      <button className="sample-back back-to-tasks" onClick={onBack}>← {kind === 'challenge' ? 'Challenges' : 'Tasks'}</button>
      <div className="sample-title"><span>{kind === 'challenge' ? 'Java Practice / Challenge' : 'ReidyAI / Task'} {task.id}</span><strong>{task.title}</strong></div>
      <span className="sample-language">{project ? 'Project' : 'Java 17'}</span>
      <button aria-label="Previous exercise" disabled={!onPrevious} onClick={onPrevious}>←</button><button aria-label="Next exercise" disabled={!onNext} onClick={onNext}>→</button>
      <button onClick={reset}>Reset</button><button className="sample-checks" onClick={() => run('checks')} disabled={project || busy || !code.trim() || !samples.length}>Run sample checks</button><button className="sample-run" onClick={() => run()} disabled={project || busy || !code.trim()}>{project ? 'Run in project' : busy ? 'Running…' : '▶ Run code'}</button>
    </header>
    <QuestionDrawer ref={questionDrawer} title={kind === 'challenge' ? 'Java Practice' : 'ReidyAI Tasks'} questions={questions} selectedId={task.id} onSelect={onSelect} triggerRef={questionButton} />
    <div className="sample-body">
    <div className="sample-split" ref={split} style={{ '--editor-width': width + '%' }}>
      <section className="sample-info-pane" aria-label="Problem description">
        <nav className="sample-views" aria-label="Task views">{[['problem', 'Description'], ['hint', 'Hints'], ['solution', 'Solution']].map(([id, label]) => <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}</nav>
        <div className="sample-info-content">
          {view === 'problem' && <><div className="sample-meta"><span>{task.difficulty}</span><span>{task.topic}</span></div><h1>{task.title}</h1><p>{task.statement}</p>{task.incident && <><h2>Symptoms</h2><ul>{task.incident.symptoms.map(item => <li key={item}>{item}</li>)}</ul><h2>Investigate</h2><ol>{task.incident.investigate.map(item => <li key={item}>{item}</li>)}</ol></>}<section className="sample-requirements"><h2>{task.requirements ? 'Requirements' : 'Acceptance criteria'}</h2>{!task.requirements && <p>{task.expected}</p>}<ol>{(task.requirements || []).map(item => <li key={item}>{item}</li>)}</ol></section><h2>Expected behavior</h2><pre>{task.expected}</pre><h2>Checks and context</h2><p>{task.notes}</p></>}
          {view === 'hint' && <><h1>Hints</h1><p>Open one hint at a time.</p>{(task.hintSteps || [task.pseudocode]).map((hint, index) => <details key={hint}><summary>Hint {index + 1}</summary><p>{hint}</p></details>)}</>}
          {view === 'solution' && <><h1>Solution</h1><button className="sample-load" onClick={loadSolution}>Load into editor</button>{notice && <p role="status">{notice}</p>}<pre>{task.solution}</pre>{task.explanation && <><h2>Why this approach</h2>{task.explanation.map(item => <p key={item}>{item}</p>)}</>}</>}
        </div>
      </section>
      <div className="sample-right-column" ref={codeSplit} style={{ '--code-height': height + '%' }}><section className="sample-code-pane" aria-label="Code workspace"><div className="sample-code-heading"><strong><span aria-hidden="true">&lt;/&gt;</span> Code</strong><span>{project ? task.language || 'Java' : 'Java 17'}</span><button onClick={reset} aria-label="Reset code" title="Reset code">↺</button></div>
        <nav className="sample-files" aria-label="Editor files">{[['code', filename], ['input', 'Sample input'], ['expected', 'Expected output']].map(([id, label]) => <button key={id} aria-pressed={file === id} onClick={() => selectFile(id)}>{id === 'code' && <span className="sample-file-icon">J</span>}{label}{id === 'expected' && <span className="sample-lock"> · read only</span>}</button>)}</nav>
        <div className="sample-editor" hidden={file !== 'code'}><Suspense fallback={<p role="status">Loading editor…</p>}><Editor task={editorTask} code={code} onChange={setCode} /></Suspense></div>
        {file === 'input' && <div className="sample-file-content"><h2>Standard input</h2><p>Custom input for Run code. Sample checks use the provided sample input and starter main().</p><textarea aria-label="Sample input" spellCheck="false" value={stdin} onChange={event => setStdin(event.target.value)} placeholder="Optional input for System.in" /></div>}
        {file === 'expected' && <div className="sample-file-content"><h2>{samples.length ? 'Expected sample output' : 'Expected behavior'}</h2><pre>{samples[0]?.expected || task.expected}</pre><p>{samples.length ? 'Sample checks run the starter main() with the sample input. They do not verify every acceptance criterion.' : 'This exercise needs its project dependencies. Follow the expected behavior and checks in your local project.'}</p></div>}
        <footer className="sample-status"><span>{file === 'code' ? 'src/' + filename : file === 'input' ? 'tests/sample.in' : 'tests/sample.out'}</span><span className="draft-save-status" role="status">{saveStatus}</span><span>{code.split('\n').length} lines · {(task.language || 'java').toUpperCase()}</span></footer>
      </section>
      <div className="sample-horizontal-divider" role="separator" aria-label="Resize results panel" aria-orientation="horizontal" aria-valuemin={35} aria-valuemax={85} aria-valuenow={height} tabIndex={0} onPointerDown={event => {event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);}} onPointerMove={event => {if(event.currentTarget.hasPointerCapture(event.pointerId)){const rect=codeSplit.current.getBoundingClientRect();setHeight(Math.max(35,Math.min(85,(event.clientY-rect.top)/rect.height*100)));}}} onPointerUp={event => {if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}} onKeyDown={event => {if(['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();setHeight(value => Math.max(35,Math.min(85,value+(event.key === 'ArrowDown' ? 3 : -3))));}}}><span /></div>
      <section className="sample-results-pane" aria-label="Test cases and results"><nav className="sample-result-tabs"><button aria-pressed={resultTab === 'testcase'} onClick={() => setResultTab('testcase')}>Testcase</button><button aria-pressed={resultTab === 'result'} onClick={() => setResultTab('result')}>Test Result{busy ? ' · Running' : ''}</button></nav><div className="sample-result-content">
        {resultTab === 'testcase' && <><div className="sample-case-label">Case 1</div><label htmlFor="custom-input">Standard input</label><textarea id="custom-input" aria-label="Custom test input" spellCheck="false" value={stdin} onChange={event => setStdin(event.target.value)} placeholder="Sample calls are provided in main()." /><h3>Expected output</h3><pre>{samples[0]?.expected || task.expected}</pre></>}          {resultTab === 'result' && <section aria-label="Execution result" aria-busy={busy}><h1>Output</h1>
            {snapshot && (snapshot.code !== code || (snapshot.mode === 'run' && snapshot.stdin !== stdin)) && <p className="sample-stale">Your code or input changed after this run.</p>}
            {!status && <div className="sample-empty"><span>⌘</span><p>{project ? 'Run this exercise in its project environment.' : 'Run your code or sample checks to see results here.'}</p></div>}
            {status && <p role="status" className={checkResults.length ? checkResults.every(check => check.passed) ? 'sample-success' : 'sample-failure' : result?.status.id === 3 ? 'sample-success' : ''}>{status}</p>}
            {checkResults.map((check, index) => <section className={'sample-check-result ' + (check.passed ? 'passed' : 'failed')} key={index}><h2>{check.passed ? '✓ Passed' : '✕ Failed'} · {check.name}</h2><h3>Input</h3><pre>{check.stdin || '(empty — sample calls are in main())'}</pre><h3>Expected</h3><pre>{check.expected}</pre><h3>Actual</h3><pre>{check.actual || '(no output)'}</pre></section>)}
            {result && <>{!checkResults.length && <><h2>Standard output</h2><pre>{result.stdout || '(no output)'}</pre></>}{result.compile_output && <><h2>Compiler output</h2><pre>{result.compile_output}</pre></>}{result.stderr && <><h2>Standard error</h2><pre>{result.stderr}</pre></>}{result.message && <pre>{result.message}</pre>}</>}
            <p className="sample-runtime-note">{project ? task.executionNote || task.environment + '. Run with the dependencies described under Checks and context.' : 'Runs Java 17 through Judge0. Sample checks cover the provided example, not the full specification.'}</p>
          </section>}
</div></section></div>
      <div className="sample-divider" role="separator" aria-label="Resize editor" aria-orientation="vertical" aria-valuemin={28} aria-valuemax={65} aria-valuenow={Math.round(width)} tabIndex={0}
        onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={resize} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
        onKeyDown={event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); setWidth(value => Math.max(28, Math.min(65, value + (event.key === 'ArrowRight' ? 2 : -2)))); } }}><span /></div>

    </div>
    </div>
  </main>;
}