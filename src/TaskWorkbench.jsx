import { lazy, Suspense, useMemo, useState } from 'react';
import './task-workbench.css';
const ExerciseWorkspace = lazy(() => import('./ExerciseWorkspace'));

export default function TaskWorkbench({ tasks, initialSelectedId, kind = 'task' }) {
  const plural = kind === 'challenge' ? 'Challenges' : 'Tasks';
  const singular = kind === 'challenge' ? 'Challenge' : 'Task';
  const [selectedId, setSelectedId] = useState(initialSelectedId || null);
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('All');
  const task = useMemo(() => tasks.find(item => item.id === selectedId), [tasks, selectedId]);
  const topics = useMemo(() => [...new Set(tasks.map(item => item.topic))], [tasks]);
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => tasks.filter(item => (topic === 'All' || item.topic === topic)
    && `${item.id} ${item.title} ${item.topic}`.toLowerCase().includes(normalizedQuery)), [normalizedQuery, tasks, topic]);
  const index = task ? tasks.indexOf(task) : -1;
  if (task) return <Suspense fallback={<p role="status">Loading workspace…</p>}><ExerciseWorkspace key={kind + '-' + task.id} task={task} kind={kind} questions={tasks} onSelect={setSelectedId}
    onBack={() => setSelectedId(null)} onPrevious={index > 0 ? () => setSelectedId(tasks[index - 1].id) : undefined}
    onNext={index < tasks.length - 1 ? () => setSelectedId(tasks[index + 1].id) : undefined} /></Suspense>;
  return <main className="task-app task-catalog">
    <header className="task-list-header"><div><p className="task-eyebrow">{kind === 'challenge' ? 'Java Practice Exercises' : 'ReidyAI practice'}</p><h1>{plural}</h1><p>Choose a {kind} to start solving.</p></div><span className="task-total">{tasks.length} {plural.toLowerCase()}</span></header>
    <div className="task-list-filters"><input type="search" aria-label={`Search ${plural.toLowerCase()}`} placeholder="Search by title or topic" value={query} onChange={event => setQuery(event.target.value)} />
      <select aria-label={`Filter ${plural.toLowerCase()} by topic`} value={topic} onChange={event => setTopic(event.target.value)}><option value="All">All topics</option>{topics.map(value => <option key={value}>{value}</option>)}</select><span>{filtered.length} shown</span></div>
    <div className="task-list-columns" aria-hidden="true"><span>#</span><span>{singular}</span><span>Level</span><span>Environment</span></div>
    <ol className="task-title-list">{filtered.map(item => <li key={item.id}><button data-task-id={item.id} onClick={() => setSelectedId(item.id)} aria-label={`Open ${kind} ${item.id}: ${item.title}`}>
      <span className="task-number">{item.id}</span><span className="task-row-title"><strong>{item.title}</strong><small>{item.topic}{item.scenarioId ? ' · Production scenario' : ''}</small></span><span className="task-level">{item.difficulty}</span><span className="task-runtime">{item.runtime === 'project' ? 'Project' : 'Java 17'}</span>
    </button></li>)}</ol>
    {!filtered.length && <div className="task-empty"><p>No {plural.toLowerCase()} match your filters.</p><button onClick={() => { setTopic('All'); setQuery(''); }}>Clear filters</button></div>}
  </main>;
}
