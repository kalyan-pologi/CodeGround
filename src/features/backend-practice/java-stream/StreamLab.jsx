import { useEffect, useRef, useState } from 'react';
import { executeJava } from '../../../services/execution/compiler';
import { useExerciseDraft, readPreference, writePreference } from '../../../components/cloud-save/exercise-drafts';
import CloudSaveControls from '../../../components/cloud-save/CloudSaveControls';

const expectedCache = new Map();
function normalizeOutput(value) { return String(value || '').replace(/\r\n?/g, '\n').trim(); }
function sampleInputFor(question) {
  if (question.category === 'CompletableFuture') return 'No external input. The example uses fixed future values and asynchronous tasks.';
  if (question.category === 'Multithreading') return 'No external input. The example creates its own threads and coordination objects.';
  if (['Collections', 'File Handling', 'Date & Time'].includes(question.category)) return 'No external input. The example creates its own collections, temporary files, or date-time values.';
  const code = question.solutions?.[0]?.code || '';
  const lines = code.split('\n');
  const streamLine = lines.findIndex(line => line.includes('.stream()'));
  if (streamLine < 1) return '';
  return lines.slice(0, streamLine).filter(line => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith('//') && /^(?:List|Set|Map|String|int|long|double|Optional|Future|CompletableFuture)\b/.test(trimmed);
  }).join('\n');
}
async function loadExpected(question, signal) {
  const cached = expectedCache.get(question.id);
  if (cached !== undefined) return cached;
  const output = await executeJava(question.solutions[0].program, '', { signal, timeoutMs: 45000 });
  if (output.status?.id !== 3) throw new Error(output.compile_output || output.stderr || output.status?.description || 'Reference solution did not complete.');
  const value = output.stdout || '(no output)';
  expectedCache.set(question.id, value);
  return value;
}
function streamHintFor(title) {
  const prompt = title.toLowerCase();
  if (prompt.includes('runnable') || prompt.includes('thread')) return 'Create the requested Thread or Runnable, start it, and join it when the main thread must wait for completion.';
  if (prompt.includes('callable') || prompt.includes('executor') || prompt.includes('thread pool')) return 'Submit the task to an ExecutorService, retrieve the Future when needed, and always shut down the executor.';
  if (prompt.includes('synchronized') || prompt.includes('race')) return 'Protect the shared mutable state with the synchronization mechanism named by the question.';
  if (prompt.includes('atomic')) return 'Use the atomic operation that matches the update; atomic variables avoid lost updates without explicit locking.';
  if (prompt.includes('latch')) return 'Count down once per worker and await the latch before printing the completion message.';
  if (prompt.includes('barrier')) return 'Give the barrier the required party count and let every worker await it before continuing.';
  if (prompt.includes('blocking queue') || prompt.includes('producer')) return 'Use a BlockingQueue so producers and consumers coordinate without busy-waiting.';
  if (prompt.includes('collection') || prompt.includes('frequency') || prompt.includes('priority')) return 'Choose the collection that matches the access pattern, preserve ordering only when required, and handle duplicate keys explicitly.';
  if (prompt.includes('file') || prompt.includes('path') || prompt.includes('directory')) return 'Use try-with-resources for streams and java.nio.file APIs for paths; clean up temporary files after the example completes.';
  if (prompt.includes('date') || prompt.includes('time') || prompt.includes('duration') || prompt.includes('zone')) return 'Use java.time types instead of legacy Date/Calendar, and make parsing, formatting, zones, and inclusivity explicit.';
  if (prompt.includes('sorted by salary')) return 'Filter to the requested department first, then sort with Comparator.comparing and reversed salary order.';
  if (prompt.includes('top 2') || prompt.includes('highest paid')) return 'Sort by salary descending, then use limit. Add a tie-breaker when the prompt requires deterministic employee selection.';
  if (prompt.includes('null')) return 'Use filter(Objects::nonNull) before the operation that would dereference or compare each value.';
  if (prompt.includes('any employee') || prompt.includes('whether any')) return 'Use anyMatch with the exact predicate; it short-circuits as soon as a matching employee is found.';
  if (prompt.includes('every')) return 'Filter to the requested group, then use allMatch. Remember that an empty stream makes allMatch true.';
  if (prompt.includes('first employee') || prompt.includes('find the first')) return 'Filter with the requested condition and finish with findFirst, which returns an Optional.';
  if (prompt.includes('group') || prompt.includes('department')) return 'Use groupingBy for the requested key and select the downstream collector that matches the required value or statistics.';
  if (prompt.includes('count') || prompt.includes('frequency')) return 'Use groupingBy with counting, then sort or select the entry required by the question.';
  if (prompt.includes('distinct')) return 'Use distinct when uniqueness is required, and preserve encounter order unless the prompt asks for sorting.';
  if (prompt.includes('sum') || prompt.includes('total') || prompt.includes('average')) return 'Choose the matching numeric terminal operation and use mapToInt or mapToDouble when a primitive summary is appropriate.';
  if (prompt.includes('map')) return 'Use toMap with an explicit merge function when keys can repeat; do not assume duplicate keys are impossible.';
  if (prompt.includes('future') || prompt.includes('async')) return 'Choose thenApply for a value transformation, thenCompose for a dependent future, and allOf/anyOf for coordination.';
  return 'Identify the source, intermediate operations, and terminal operation. Check ordering, duplicates, empty input, and ties.';
}
function taskBriefFor(question) {
  const title = question.title.trim().replace(/[.]$/, '');
  return `Implement this requirement: ${title}. Use the sample values already supplied by the starter, then print the result requested by the question. Do not add keyboard input unless the question explicitly requires it.`;
}
export default function StreamLab({ questions }) {
  const [selected,setSelected] = useState(() => readPreference('streams:selected',questions[0].id,id => questions.some(question => question.id === id)));
  const [completed,setCompleted] = useState(() => {
    const valid = value => Array.isArray(value) && value.every(id => Number.isInteger(id) && questions.some(question => question.id === id));
    const current = readPreference('streams:completed:v2', null, valid);
    if (current) return current;
    return readPreference('streams:completed:v1', [], Array.isArray)
      .filter(id => Number.isInteger(id) && id <= 60 && questions.some(question => question.id === id));
  });
  const [query,setQuery] = useState('');
  const [validation,setValidation] = useState({ id: null, passed: false });
  const drawer=useRef(null), search=useRef(null), menu=useRef(null);
  const question=questions.find(item => item.id === selected) || questions[0], index=questions.indexOf(question);
  const draft=useExerciseDraft(question,'streams');
  const runAction=useRef(() => {});
  const filtered=questions.filter(item => (item.title+' '+item.category).toLowerCase().includes(query.trim().toLowerCase()));
  const categories=[...new Set(filtered.map(item => item.category))];
  function select(id) { setSelected(id); writePreference('streams:selected',id); drawer.current?.close(); }
  async function submitCurrent() {
    if (question.runnable && (validation.id !== question.id || !validation.passed)) return { error: new Error('Run your code and pass the sample before submitting.') };
    const result = await draft.saveToCloud();
    if (!result.error) setCompleted(previous => {
      if (previous.includes(question.id)) return previous;
      const next = [...previous, question.id];
      writePreference('streams:completed:v2', next);
      return next;
    });
    return result;
  }
  return <main className="sql-lab stream-lab"><header className="sql-lab-header"><button className="sql-lab-menu stream-lab-menu" ref={menu} aria-haspopup="dialog" aria-controls="stream-question-drawer" onClick={() => { drawer.current.showModal(); search.current.focus(); }}><span aria-hidden="true">☰</span> Java Core Tasks</button>
    <button aria-label="Previous Java Core task" disabled={index === 0} onClick={() => select(questions[index-1].id)}>‹</button><button aria-label="Next Java Core task" disabled={index === questions.length-1} onClick={() => select(questions[index+1].id)}>›</button><span className="sql-question-count">{question.id} / {questions.length}</span><div className="sql-header-actions"><button className="sql-run-button stream-run-button" disabled={!question.runnable || !draft.code.trim()} onClick={() => runAction.current()}>▶ Run</button><CloudSaveControls compact draft={draft} onSubmit={submitCurrent} /></div></header>
    <StreamQuestion key={question.id} question={question} draft={draft} runAction={runAction} onValidationChange={passed => setValidation({ id: question.id, passed })} />
    <dialog className="sql-question-drawer stream-question-drawer" id="stream-question-drawer" ref={drawer} aria-label="Java Core Tasks" onClose={() => menu.current?.focus()} onClick={event => { if(event.target === event.currentTarget) drawer.current.close(); }}>
      <div className="sql-drawer-inner"><div className="sql-drawer-header"><h2>Java Core Tasks</h2><button aria-label="Close Java Core Tasks" onClick={() => drawer.current.close()}>×</button></div><label className="sql-search-label"><span className="sql-sr-only">Search Java Core Tasks</span><input ref={search} type="search" placeholder="Search questions" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <div className="sql-question-list">{categories.map(category => <section key={category}><h3>{category}</h3>{filtered.filter(item => item.category === category).map(item => { const isCompleted = completed.includes(item.id); return <button key={item.id} className={'sql-question-button stream-question-button' + (isCompleted ? ' completed' : '')} data-question-id={item.id} aria-current={question.id === item.id ? 'page' : undefined} aria-label={`${item.id}. ${item.title}${isCompleted ? ', completed' : ''}`} onClick={() => select(item.id)}><span className="sql-question-dot">{isCompleted ? '✓' : ''}</span><span>{item.id}. {item.title}</span><small>{item.runnable ? 'Java 17' : 'Reference'}</small></button>; })}</section>)}{!filtered.length && <p className="sql-muted">No matching questions.</p>}</div></div>
    </dialog>
  </main>;
}
function StreamQuestion({ question, draft, runAction, onValidationChange }) {
  const {code,stdin,setCode,setStdin,saveStatus}=draft;
  const [tab,setTab]=useState('description'), [resultTab,setResultTab]=useState('output'), [file,setFile]=useState('code');
  const [expected,setExpected]=useState(() => expectedCache.get(question.id) || null), [expectedBusy,setExpectedBusy]=useState(false);
  const [result,setResult]=useState(null), [status,setStatus]=useState(''), [busy,setBusy]=useState(false), [notice,setNotice]=useState('');
  const [snapshot,setSnapshot]=useState(null), [width,setWidth]=useState(45), [height,setHeight]=useState(65);
  const grid=useRef(null), right=useRef(null), gutter=useRef(null), editor=useRef(null), request=useRef(null);
  const sampleInput = sampleInputFor(question);
  useEffect(() => { const area=editor.current; if(area && question.runnable) { area.scrollTop=area.scrollHeight; gutter.current.scrollTop=area.scrollTop; } return () => request.current?.abort(); },[question]);
  useEffect(() => {
    let active = true;
    const cached = expectedCache.get(question.id);
    if (!question.runnable || cached) { setExpected(cached || '(reference-only example)'); return undefined; }
    const controller = new AbortController(); setExpectedBusy(true);
    loadExpected(question, controller.signal).then(value => {
      if (!active) return;
      setExpected(value);
    }).catch(error => { if (active && error.name !== 'AbortError') setExpected(`Expected output unavailable: ${error.message}`); })
      .finally(() => { if (active) setExpectedBusy(false); });
    return () => { active = false; controller.abort(); };
  }, [question]);
  function load(index) {
    const solution=question.solutions[index].program;
    if(code !== question.starter && !question.solutions.some(item => item.program === code) && !window.confirm('Replace your current draft with this solution?')) return;
    setCode(solution); setFile('code'); setNotice('Solution loaded into Main.java.');
  }
  function reset() { if(code !== question.starter && !window.confirm('Reset your code to the starter?')) return; setCode(question.starter); setResult(null); setStatus(''); setNotice(''); }
  async function run() {
    if(!question.runnable || request.current || !code.trim()) return;
    onValidationChange(false);
    const controller=new AbortController(); request.current=controller; setBusy(true); setResult(null); setStatus('Submitting…'); setResultTab('output'); setSnapshot({code,stdin});
    try {
      const output=await executeJava(code,stdin,{signal:controller.signal,onStatus:value => setStatus(value.description)});
      if(!controller.signal.aborted) {
        const expectedOutput = await loadExpected(question, controller.signal);
        const passed = output.status?.id === 3 && normalizeOutput(output.stdout) === normalizeOutput(expectedOutput);
        setResult({ ...output, passed, expectedOutput, status: passed ? output.status : { ...output.status, id: 4 } });
        setStatus(output.status?.id === 3 ? (passed ? 'Accepted' : 'Wrong answer') : output.status.description);
        onValidationChange(passed);
      }
    }
    catch(error) { if(!controller.signal.aborted) setStatus(error.message); }
    finally { if(!controller.signal.aborted) setBusy(false); request.current=null; }
  }
  runAction.current=run;
  const events=axis => ({onPointerDown:event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); },
    onPointerMove:event => { if(!event.currentTarget.hasPointerCapture(event.pointerId)) return; const box=(axis === 'x' ? grid : right).current.getBoundingClientRect(); if(axis === 'x') setWidth(Math.max(28,Math.min(65,(event.clientX-box.left)/box.width*100))); else setHeight(Math.max(28,Math.min(75,(event.clientY-box.top)/box.height*100))); },
    onPointerUp:event => { if(event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); },
    onKeyDown:event => { const before=axis === 'x' ? 'ArrowLeft' : 'ArrowUp', after=axis === 'x' ? 'ArrowRight' : 'ArrowDown'; if(![before,after].includes(event.key)) return; event.preventDefault(); (axis === 'x' ? setWidth : setHeight)(value => Math.max(28,Math.min(axis === 'x' ? 65 : 75,value+(event.key === after ? 2 : -2)))); }});
  return <section className="sql-lab-grid stream-lab-grid" ref={grid} data-question-id={question.id} data-runnable={question.runnable} style={{'--description-width':width+'%','--code-height':height+'%'}}>
    <section className="sql-description-panel" aria-label="Java Core task"><nav className="sql-panel-tabs stream-question-tabs" aria-label="Java Core task views"><button aria-pressed={tab === 'description'} onClick={() => setTab('description')}>Description</button><button aria-pressed={tab === 'solution'} onClick={() => setTab('solution')}>Solution</button></nav><div className="sql-description-scroll">
      {tab === 'description' && <><h1>{question.id}. {question.title}</h1><div className="sql-tags"><span>{question.category}</span><span>Java 17</span></div>{question.id < 61 && question.description && <p>{question.description}</p>}{question.id < 61 ? <p>Implement the requested {question.category === 'CompletableFuture' ? 'asynchronous' : question.category === 'Multithreading' ? 'multithreading' : ['Collections', 'File Handling', 'Date & Time'].includes(question.category) ? 'Java Core' : 'Stream'} operation and print your result. The editor includes the required Java imports and sample data.</p> : <section className="stream-task-brief"><h2>Task</h2><p>{question.task || taskBriefFor(question)}</p><h2>Sample input</h2><p>{sampleInput || 'No external input is required. The starter creates the sample values in Main.java.'}</p></section>}
        {question.runnable && question.id < 61 && <><h2>Sample input</h2>{sampleInput ? <pre>{sampleInput}</pre> : <><div className="sql-table-wrap"><table><caption>Employees used by the starter</caption><thead><tr><th>ID</th><th>Name</th><th>Department</th><th>Salary</th></tr></thead><tbody>{[[1,'John Doe','IT',6000],[2,'Jane Smith','HR',7500],[3,'Ada Lovelace','IT',9500],[4,'John Lee','HR',5000],[5,'Bob Jones','IT',9500]].map(row => <tr key={row[0]}>{row.map((value,index) => <td key={index}>{value}</td>)}</tr>)}</tbody></table></div><p>Numbers: <code>[1, 2, 3, 4, 5, 5, 6, 7, 8, 9, 7, 10]</code></p><p>Names: <code>["alice", "apple", "bob", "bat", "apple", "cat"]</code></p></>}<p className="sql-muted">You can change the sample data in Main.java to test more cases.</p></>}
        <h2>Expected output</h2>{expectedBusy ? <p className="sql-muted">Running the reference solution…</p> : <pre>{expected || '(no output)'}</pre>}<p className="sql-muted">The reference output uses the sample input above.</p><details className="sql-hint"><summary>Hint</summary><p>{streamHintFor(question.title)}</p></details></>}
      {tab === 'solution' && <><h1>Solution</h1>{notice && <p role="status">{notice}</p>}{question.solutions.map((solution,index) => <section className="stream-solution-example" key={index}><h2>{solution.title}</h2>{question.runnable && <button className="stream-load-solution" data-solution-index={index} onClick={() => load(index)}>{index ? 'Load alternative into editor' : 'Load solution into editor'}</button>}<pre>{solution.code}</pre>{solution.choose && <p>{solution.choose}</p>}</section>)}</>}
    </div></section>
    <div className="sql-divider vertical" role="separator" aria-label="Resize Stream description" aria-orientation="vertical" aria-valuemin={28} aria-valuemax={65} aria-valuenow={Math.round(width)} tabIndex={0} {...events('x')} />
    <section className="sql-right-panel" ref={right}><section className="sql-editor-panel" aria-label="Java Core code"><div className="sql-code-heading"><nav className="stream-file-tabs" aria-label="Java Core editor files"><button aria-pressed={file === 'code'} onClick={() => setFile('code')}>{question.runnable ? 'Main.java' : 'Reference.java'}</button><button aria-pressed={file === 'input'} onClick={() => setFile('input')}>Input</button></nav><button disabled={!question.runnable} onClick={reset}>Reset</button></div><div className="sql-editor-actions"><span>{question.runnable ? 'Java 17 · Judge0' : 'Read-only reference'}</span></div>
      <div className="sql-editor-area" hidden={file !== 'code'}><pre className="sql-line-numbers" ref={gutter} aria-hidden="true">{Array.from({length:code.split('\n').length},(_,index) => index+1).join('\n')}</pre><textarea ref={editor} className="sql-lab-code stream-lab-code" aria-label="Java Core code" spellCheck="false" wrap="off" readOnly={!question.runnable} value={code} onChange={event => setCode(event.target.value)} onScroll={event => { gutter.current.scrollTop=event.currentTarget.scrollTop; }}
        onKeyDown={event => { if(event.key !== 'Tab' || !question.runnable) return; event.preventDefault(); const target=event.currentTarget, start=target.selectionStart, end=target.selectionEnd; setCode(code.slice(0,start)+'    '+code.slice(end)); requestAnimationFrame(() => target.setSelectionRange(start+4,start+4)); }} /></div>
      {file === 'input' && <div className="stream-input-pane"><label>Standard input<textarea aria-label="Stream standard input" value={stdin} onChange={event => setStdin(event.target.value)} placeholder="Optional input for System.in" /></label><p>Sample collections are already included in Main.java. Leave input empty unless your code reads System.in.</p></div>}
      <footer className="sql-editor-status"><span role="status">{saveStatus}</span><span>{code.split('\n').length} lines</span></footer></section>
      <div className="sql-divider horizontal" role="separator" aria-label="Resize Java Core output" aria-orientation="horizontal" aria-valuemin={28} aria-valuemax={75} aria-valuenow={Math.round(height)} tabIndex={0} {...events('y')} />
      <section className="sql-output-panel" aria-label="Java Core output"><nav className="sql-panel-tabs" aria-label="Java Core output views"><button aria-pressed="true">Output</button></nav><div className="sql-output-scroll stream-output-scroll" role="status" aria-busy={busy}>
        {resultTab === 'help' ? <p>Run compares your normalized standard output with the reference solution. Submit is enabled only after the sample passes.</p> : <>{snapshot && (snapshot.code !== code || snapshot.stdin !== stdin) && <p className="sql-stale">Code or input changed after this run.</p>}{status ? <h2 className={result?.passed ? 'sql-success' : 'sql-error'}>{status}</h2> : <p className="sql-muted">{question.runnable ? 'Run your code to see output here.' : 'Reference only. This example uses shared CompletableFuture setup.'}</p>}{result && <><h3>Actual output</h3><pre>{result.stdout || '(no output)'}</pre>{result.expectedOutput && <><h3>Expected output</h3><pre>{result.expectedOutput}</pre></>}{result.compile_output && <><h3>Compiler output</h3><pre>{result.compile_output}</pre></>}{result.stderr && <><h3>Standard error</h3><pre>{result.stderr}</pre></>}{result.message && <pre>{result.message}</pre>}</>}</>}
      </div></section>
    </section>
  </section>;
}
