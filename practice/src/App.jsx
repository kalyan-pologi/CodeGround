import { useState } from 'react';
import { mcqs } from './data/mcqs';
import { challenges } from './data/challenges';
import McqPractice from './components/McqPractice';
import CodingPractice from './components/CodingPractice';

export default function App() {
  const [mode, setMode] = useState('mcq');
  return <main>
    <header><p className="eyebrow">Java practice.</p></header>
    <nav className="tabs" aria-label="Practice mode">
      <button aria-pressed={mode === 'mcq'} onClick={() => setMode('mcq')}>Debugging MCQs | {mcqs.length}</button>
      <button aria-pressed={mode === 'coding'} onClick={() => setMode('coding')}>Coding challenges | {challenges.length}</button>
    </nav>
    <div hidden={mode !== 'mcq'}><McqPractice questions={mcqs} /></div>
    <div hidden={mode !== 'coding'}><CodingPractice challenges={challenges} active={mode === 'coding'} /></div>
  </main>;
}
