import { useEffect, useMemo, useRef, useState } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/basic-languages/java/java.contribution';
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution';
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import Navigator from './Navigator';
import TopicFilter from './TopicFilter';
import { executeJava } from '../services/compiler';
self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

export default function CodingPractice({ challenges, active, initialSelectedId }) {
  const [topic, setTopic] = useState('All');
  const [selected, setSelected] = useState(initialSelectedId || challenges[0].id);
  const [drafts, setDrafts] = useState({});
  const [templates, setTemplates] = useState({});
  const [inputs, setInputs] = useState({});
  const [runs, setRuns] = useState({});
  const [runningId, setRunningId] = useState(null);
  const request = useRef(null);
  useEffect(() => {
    if (!active) request.current?.abort();
    return () => request.current?.abort();
  }, [active]);
  const availableTopics = useMemo(() => [...new Set(challenges.map(challenge => challenge.topic))], [challenges]);
  const filtered = useMemo(() => challenges.filter(question => topic === 'All' || question.topic === topic), [challenges, topic]);
  const question = filtered.find(question => question.id === selected) || filtered[0];
  const current = question?.id;
  const requiresProject = question?.runtime === 'project';
  const index = filtered.indexOf(question);
  const template = templates[current] || 'starter';
  const base = template === 'starter' ? question?.starter : '';
  const code = drafts[current] ?? base;
  const stdin = inputs[current] || '';
  const run = runs[current];
  async function runCode() {
    if (request.current || !code.trim() || requiresProject) return;
    const id = current;
    const controller = new AbortController();
    request.current = controller;
    setRunningId(id);
    const snapshot = { source: code, stdin };
    setRuns(previous => ({ ...previous, [id]: { ...snapshot, loading: true, status: 'Submitting...' } }));
    try {
      const result = await executeJava(code, stdin, {
        signal: controller.signal,
        onStatus: status => setRuns(previous => ({ ...previous, [id]: { ...previous[id], status: status.description || `Status ${status.id}` } })),
      });
      if (!controller.signal.aborted) setRuns(previous => ({ ...previous, [id]: { ...snapshot, result } }));
    } catch (error) {
      if (!controller.signal.aborted) setRuns(previous => ({ ...previous, [id]: { ...snapshot, error: error.message } }));
    } finally {
      if (!controller.signal.aborted) setRunningId(null);
      if (request.current === controller) request.current = null;
    }
  }
  function changeTemplate(value) {
    if (value === template) return;
    if (!window.confirm('Switch code template? This replaces your current draft for this challenge.')) return;
    setTemplates(previous => ({ ...previous, [current]: value }));
    setDrafts(previous => ({ ...previous, [current]: value === 'starter' ? question.starter : '' }));
  }
  function reset() {
    if (window.confirm('Reset this challenge to the selected code template?')) setDrafts(previous => ({ ...previous, [current]: base }));
  }
  return <section aria-label="Coding practice">
    <div className="toolbar"><TopicFilter value={topic} onChange={setTopic} availableTopics={availableTopics} /></div>
    <div className="layout"><aside className="panel"><h2>Challenges</h2><Navigator key={topic} items={filtered} current={current} onSelect={setSelected} pageSize={20} /></aside>
    {question ? <article className="panel"><div className="meta">Challenge {current} | {question.topic} | {question.difficulty}</div><h2>{question.title}</h2><p className="muted">{question.environment}</p><p>{question.statement}</p>
    {question.incident && <><section aria-label="Incident symptoms"><h3>Symptoms</h3><ul>{question.incident.symptoms.map(symptom => <li key={symptom}>{symptom}</li>)}</ul></section><section aria-label="Incident investigation"><h3>Investigate</h3><ol>{question.incident.investigate.map(step => <li key={step}>{step}</li>)}</ol></section></>}
    {question.requirements && <section aria-label="Task requirements"><h3>Requirements</h3><ol>{question.requirements.map(requirement => <li key={requirement}>{requirement}</li>)}</ol></section>}
    <h3>Expected output / behavior</h3><pre><code>{question.expected}</code></pre>
    <div className="toolbar"><label>Code template <select value={template} onChange={event => changeTemplate(event.target.value)}><option value="starter">Starter Code</option><option value="empty">Empty Code</option></select></label><button onClick={reset}>Reset code</button></div>
    <div className="editor" aria-label="Code editor">{active && <Editor height="380px" path={`challenge-${current}.${question.language || 'java'}`} language={question.language || 'java'} theme="vs-dark" value={code} onChange={value => setDrafts(previous => ({ ...previous, [current]: value ?? '' }))} loading={<p>Loading code editor...</p>} options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 4, wordWrap: 'on' }} />}</div>
    <label className="compiler-input">Standard input (optional)<textarea rows="3" value={stdin} onChange={event => setInputs(previous => ({ ...previous, [current]: event.target.value }))} placeholder="Input passed to System.in" /></label>
    <div className="toolbar"><button onClick={runCode} disabled={requiresProject || runningId !== null || !code.trim()} aria-describedby="execution-note">{requiresProject ? 'Run in project' : runningId === current ? 'Running...' : 'Run Code'}</button><button disabled aria-describedby="execution-note">Run Tests</button></div><p id="execution-note" className="muted">{question.executionNote || (requiresProject ? 'Implement and run this task in a Java/Spring exercise project with the dependencies listed under Requirements and checks. The browser runner does not include database, Spring, or JUnit dependencies.' : 'Java 17 (Judge0). Runs a single Main class; Spring/JUnit dependencies and Java 21 features are not provided. Automated tests are not configured.')}</p>
    {run && <section className="execution-result" aria-label="Execution result" aria-busy={Boolean(run.loading)}>
      <h3>Execution result</h3>
      {(run.source !== code || run.stdin !== stdin) && <p className="muted">Code or input has changed since this run.</p>}
      {run.loading && <p role="status">{run.status}</p>}
      {run.error && <p role="alert">{run.error}</p>}
      {run.result && <>
        <p role="status">Status: {run.result.status.description || 'Completed'} ({run.result.status.id}){run.result.exit_code != null && ` | Exit code: ${run.result.exit_code}`}</p>
        <h3>stdout</h3><pre><code>{run.result.stdout || '(no stdout)'}</code></pre>
        {run.result.stderr && <><h3>stderr</h3><pre><code>{run.result.stderr}</code></pre></>}
        {run.result.compile_output && <><h3>Compiler output</h3><pre><code>{run.result.compile_output}</code></pre></>}
        {run.result.message && <><h3>Runtime / provider message</h3><pre><code>{run.result.message}</code></pre></>}
      </>}
    </section>}
    <details key={`context-${current}`}><summary>Requirements and checks</summary><p>{question.notes}</p></details>
    {question.hintSteps && <section aria-label="Step-by-step hints"><h3>Hints</h3>{question.hintSteps.map((hint, index) => <details key={`${current}-${index}`}><summary>Hint {index + 1}</summary><p>{hint}</p></details>)}</section>}
    <details key={`hint-${current}`}><summary>Optional pseudocode</summary><p>{question.pseudocode}</p></details><details key={`solution-${current}`}><summary>Reveal solution</summary><pre><code>{question.solution}</code></pre>{question.explanation && <section aria-label="Solution explanation"><h3>Why this approach</h3>{question.explanation.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</section>}</details>
    <div className="pagination"><button disabled={index === 0} onClick={() => setSelected(filtered[index - 1].id)}>Previous</button><span>{index + 1} of {filtered.length}</span><button disabled={index === filtered.length - 1} onClick={() => setSelected(filtered[index + 1].id)}>Next</button></div>
    </article> : <article className="panel"><h2>No challenges match this topic</h2><p>Select another topic to continue.</p></article>}</div>
  </section>;
}
