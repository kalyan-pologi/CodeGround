import React, { lazy, Suspense, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../practice/src/styles.css';
const CodingPractice = lazy(() => import('../practice/src/components/CodingPractice'));
const McqPractice = lazy(() => import('../practice/src/components/McqPractice'));

function Practice({ project, codingQuestions, debuggingQuestions }) {
  const [mode, setMode] = useState('coding');
  const [visited, setVisited] = useState({ coding: true });
  function selectMode(next) {
    setVisited(previous => ({ ...previous, [next]: true }));
    setMode(next);
  }
  return <main><header><div><p className="eyebrow">CodeGround / {project ? 'ReidyAI Project Tasks' : 'Java Practice Exercises'}</p><h1>{project ? 'Build it. Debug it. Explain it.' : 'Prepare across Java & Spring.'}</h1><p>{project ? 'Practice Java through property management, appraisals, and event processing.' : 'Strengthen your Java and Spring skills with coding challenges, debugging questions, and explained solutions.'}</p></div></header>
    <nav className="tabs" aria-label="Practice mode"><button aria-pressed={mode === 'coding'} onClick={() => selectMode('coding')}>Coding challenges | {codingQuestions.length}</button><button aria-pressed={mode === 'mcq'} onClick={() => selectMode('mcq')}>{project ? 'Project questions' : 'Debugging MCQs'} | {debuggingQuestions.length}</button></nav>
    <div hidden={mode !== 'coding'}><Suspense fallback={<p role="status">Loading coding workspace…</p>}><CodingPractice challenges={codingQuestions} active={mode === 'coding'} /></Suspense></div>
    {visited.mcq && <div hidden={mode !== 'mcq'}><Suspense fallback={<p role="status">Loading questions…</p>}><McqPractice questions={debuggingQuestions} /></Suspense></div>}
    </main>;
}
const root = createRoot(document.getElementById('root'));
root.render(<p role="status">Loading practice…</p>);
async function start() {
  const project = new URLSearchParams(location.search).get('bank') === 'project';
  let codingQuestions, debuggingQuestions;
  if (project) {
    const bank = await import('./project-exercises');
    codingQuestions = bank.projectChallenges;
    debuggingQuestions = bank.projectMcqs;
  } else {
    const [coding, debugging] = await Promise.all([
      import('../practice/src/data/challenges'),
      import('../practice/src/data/mcqs')
    ]);
    codingQuestions = coding.challenges;
    debuggingQuestions = debugging.mcqs;
  }
  root.render(<React.StrictMode><Practice project={project} codingQuestions={codingQuestions} debuggingQuestions={debuggingQuestions} /></React.StrictMode>);
}
start().catch(() => root.render(<main><p role="alert">Practice could not load. Refresh the page to try again.</p></main>));
