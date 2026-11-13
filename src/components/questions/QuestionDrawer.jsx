import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import './question-drawer.css';

export default forwardRef(function QuestionDrawer({ title, questions, selectedId, onSelect, triggerRef, statusFor }, ref) {
  const dialog=useRef(null), search=useRef(null);
  const [query,setQuery]=useState('');
  useImperativeHandle(ref,() => ({open() { dialog.current.showModal(); search.current.focus(); }}),[]);
  const filtered=questions.filter(question => (question.id+' '+question.title+' '+question.topic).toLowerCase().includes(query.trim().toLowerCase()));
  const topics=[...new Set(filtered.map(question => question.topic))];
  return <dialog className="question-drawer" ref={dialog} aria-label={title+' questions'} onClose={() => triggerRef?.current?.focus()} onClick={event => { if(event.target === event.currentTarget) dialog.current.close(); }}>
    <div className="question-drawer-inner"><header><h2>{title}</h2><button aria-label="Close question list" onClick={() => dialog.current.close()}>×</button></header>
      <label className="question-drawer-search"><span className="drawer-sr-only">Search questions</span><input ref={search} type="search" placeholder="Search questions or topics" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <div className="question-drawer-list">{topics.map(topic => <section key={topic}><h3>{topic}</h3>{filtered.filter(question => question.topic === topic).map(question => { const status=statusFor?.(question); return <button className={'question-drawer-item '+(status || '')} data-question-id={question.id} key={question.id} aria-current={selectedId === question.id ? 'page' : undefined} onClick={() => { dialog.current.close(); onSelect(question.id); }}><span className="question-drawer-dot" aria-hidden="true">{status === 'correct' ? '✓' : status === 'incorrect' ? '×' : ''}</span><span>{question.id}. {question.title}</span><small>{status || question.difficulty}</small></button>; })}</section>)}{!filtered.length && <p>No questions match your search.</p>}</div>
    </div>
  </dialog>;
});
