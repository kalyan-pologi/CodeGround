import { useMemo, useState } from 'react';
import Navigator from './Navigator';
import TopicFilter from './TopicFilter';
export default function McqPractice({ questions }) {
  const [topic, setTopic] = useState('All');
  const [review, setReview] = useState(false);
  const [current, setCurrent] = useState(questions[0].id);
  const [choices, setChoices] = useState({});
  const [answers, setAnswers] = useState({});
  const incorrectIds = useMemo(() => new Set(questions.filter(q => answers[q.id] !== undefined && answers[q.id] !== q.answer).map(q => q.id)), [answers, questions]);
  const filtered = useMemo(() => questions.filter(q => (topic === 'All' || q.topic === topic) && (!review || incorrectIds.has(q.id))), [incorrectIds, questions, review, topic]);
  const question = filtered.find(q => q.id === current) || filtered[0];
  const index = filtered.indexOf(question);
  const submitted = question && answers[question.id] !== undefined;
  const correct = questions.filter(q => answers[q.id] === q.answer).length;
  function resetAnswer() {
    const id = question.id;
    setChoices(previous => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
    setAnswers(previous => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
    setCurrent(id);
    setReview(false);
  }
  return <section aria-label="Debugging practice">
    <div className="toolbar"><TopicFilter value={topic} onChange={setTopic} /><label className="check"><input type="checkbox" checked={review} onChange={e => setReview(e.target.checked)} />Review incorrect ({incorrectIds.size})</label><span className="score" aria-live="polite">Score: {correct} / {Object.keys(answers).length} answered | {questions.length} total</span></div>
    <div className="layout"><aside className="panel"><h2>Questions</h2><Navigator key={`${topic}-${review}`} items={filtered} current={question?.id} onSelect={setCurrent} pageSize={20} status={q => answers[q.id] === undefined ? '' : answers[q.id] === q.answer ? 'correct' : 'incorrect'} /><p className="muted">Green: correct | Red: incorrect<br />Outlined: current question</p></aside>
    {question ? <article className="panel"><div className="meta">MCQ {question.id}  |  {question.topic}  |  {question.difficulty}</div><h2>{question.title}</h2><p>{question.prompt}</p><pre><code>{question.code}</code></pre><fieldset disabled={submitted}><legend>Choose one answer</legend>{question.options.map((option, i) => <label className="option" key={i}><input type="radio" name={`mcq-${question.id}`} checked={choices[question.id] === i} onChange={() => setChoices({ ...choices, [question.id]: i })} /><span>{String.fromCharCode(65 + i)}. {option}</span></label>)}</fieldset>
    <div className="toolbar"><button className="primary" disabled={submitted || choices[question.id] === undefined} onClick={() => setAnswers({ ...answers, [question.id]: choices[question.id] })}>{submitted ? 'Submitted' : 'Submit answer'}</button>{submitted && <button onClick={resetAnswer}>Reset answer</button>}</div>
    {submitted && <div className="feedback" role="status"><strong>{answers[question.id] === question.answer ? 'Correct.' : 'Incorrect.'} Answer: {String.fromCharCode(65 + question.answer)}. {question.options[question.answer]}</strong><p>{question.explanation}</p></div>}
    <div className="pagination"><button disabled={index === 0} onClick={() => setCurrent(filtered[index - 1].id)}>Previous</button><span>{index + 1} of {filtered.length}</span><button disabled={index === filtered.length - 1} onClick={() => setCurrent(filtered[index + 1].id)}>Next</button></div></article> : <article className="panel"><h2>No questions to show</h2><p>No incorrect answers match this topic. Submit answers or change the filters.</p></article>}</div>
  </section>;
}
