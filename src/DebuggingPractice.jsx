import { useRef, useState } from 'react';
import QuestionDrawer from './QuestionDrawer';
import { readPreference, writePreference } from './exercise-drafts';
import './debugging.css';

export default function DebuggingPractice({ questions }) {
  const [progress,setProgress]=useState(() => readPreference('debugging:progress:v1',{current:questions[0].id,choices:{},answers:{}},value => {
    if(!value || !questions.some(question => question.id === value.current) || !value.choices || !value.answers) return false;
    return [value.choices,value.answers].every(records => typeof records === 'object' && !Array.isArray(records) && Object.entries(records).every(([id,answer]) => { const question=questions.find(item => String(item.id) === id); return question && Number.isInteger(answer) && answer >= 0 && answer < question.options.length; }));
  }));
  const [topic,setTopic]=useState('All'), [review,setReview]=useState(false), [saved,setSaved]=useState('');
  const drawer=useRef(null), trigger=useRef(null);
  const incorrect=questions.filter(question => progress.answers[question.id] !== undefined && progress.answers[question.id] !== question.answer);
  const filtered=questions.filter(question => (topic === 'All' || question.topic === topic) && (!review || incorrect.includes(question)));
  const question=filtered.find(item => item.id === progress.current) || filtered[0], index=filtered.indexOf(question);
  const answered=Object.keys(progress.answers).length, correct=questions.filter(item => progress.answers[item.id] === item.answer).length;
  const selected=question && progress.choices[question.id], submitted=question && progress.answers[question.id] !== undefined;
  function update(patch) { const next={...progress,...patch}; setProgress(next); setSaved(writePreference('debugging:progress:v1',next) ? 'Progress saved locally' : 'Progress could not be saved'); }
  function reset() { const choices={...progress.choices}, answers={...progress.answers}; delete choices[question.id]; delete answers[question.id]; update({choices,answers,current:question.id}); setReview(false); }
  return <main className="debugging-app">
    <header className="debugging-header"><button className="debugging-menu" ref={trigger} aria-label="Open debugging question list" aria-haspopup="dialog" onClick={() => drawer.current.open()}>☰</button><div><h1>Debugging</h1><p>{questions.length} questions across Java and Spring.</p></div><span className="debugging-score" aria-live="polite">{correct} correct <span>/ {answered} answered</span></span></header>
    <div className="debugging-toolbar"><label>Topic<select aria-label="Filter debugging by topic" value={topic} onChange={event => setTopic(event.target.value)}><option>All</option>{[...new Set(questions.map(item => item.topic))].map(item => <option key={item}>{item}</option>)}</select></label><button className="debugging-review" aria-pressed={review} onClick={() => setReview(value => !value)}>Review incorrect <span>{incorrect.length}</span></button><span className="debugging-saved" role="status">{saved}</span></div>
    <QuestionDrawer ref={drawer} title="Debugging" questions={filtered} selectedId={question?.id} onSelect={current => update({current})} triggerRef={trigger} statusFor={item => progress.answers[item.id] === undefined ? '' : progress.answers[item.id] === item.answer ? 'correct' : 'incorrect'} />
    {question ? <div className="debugging-grid">
      <section className="debugging-code-panel" aria-label="Code to debug"><header><span><span className="debugging-java-badge">J</span> Java snippet</span><small>Read only</small></header><div className="debugging-code"><pre><code>{question.code}</code></pre></div><footer>Read the code, predict the behavior, then choose an answer.</footer></section>
      <article className="debugging-question" data-question-id={question.id}><div className="debugging-question-scroll"><div className="debugging-meta"><span>Question {question.id}</span><span>{question.topic}</span><span>{question.difficulty}</span></div><h2>{question.title}</h2><p className="debugging-prompt">{question.prompt}</p>
        <fieldset className="debugging-options" disabled={submitted}><legend>Choose one answer</legend>{question.options.map((option,choice) => <label key={choice} className={'debugging-option'+(selected === choice ? ' selected' : '')+(submitted && choice === question.answer ? ' correct' : '')+(submitted && selected === choice && choice !== question.answer ? ' incorrect' : '')}><input type="radio" name={'debugging-'+question.id} checked={selected === choice} onChange={() => update({choices:{...progress.choices,[question.id]:choice}})} /><span className="debugging-option-letter">{String.fromCharCode(65+choice)}</span><span>{option}</span>{submitted && choice === question.answer && <span className="debugging-option-check">✓</span>}</label>)}</fieldset>
        <div className="debugging-actions"><button className="debugging-submit" disabled={submitted || selected === undefined} onClick={() => update({answers:{...progress.answers,[question.id]:selected}})}>{submitted ? 'Answer checked' : 'Check answer'}</button>{submitted && <button onClick={reset}>Try again</button>}</div>
        {submitted && <section className={'debugging-feedback '+(progress.answers[question.id] === question.answer ? 'correct' : 'incorrect')} role="status"><h3>{progress.answers[question.id] === question.answer ? 'Correct answer' : 'Not quite'}</h3><p className="debugging-correct-answer">Answer {String.fromCharCode(65+question.answer)} · {question.options[question.answer]}</p><h4>Why</h4><p>{question.explanation}</p></section>}
      </div><footer className="debugging-pagination"><button aria-label="Previous debugging question" disabled={index === 0} onClick={() => update({current:filtered[index-1].id})}>← Previous</button><span>{index+1} of {filtered.length}</span><button aria-label="Next debugging question" disabled={index === filtered.length-1} onClick={() => update({current:filtered[index+1].id})}>Next →</button></footer></article>
    </div> : <section className="debugging-empty"><h2>No questions to review</h2><p>No incorrect answers match these filters.</p><button onClick={() => {setTopic('All');setReview(false);}}>Show all questions</button></section>}
  </main>;
}
