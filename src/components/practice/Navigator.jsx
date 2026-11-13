import { useEffect, useState } from 'react';

export default function Navigator({ items, current, onSelect, status = () => '', pageSize = items.length || 1 }) {
  const currentIndex = items.findIndex(item => item.id === current);
  const [page, setPage] = useState(() => Math.floor(Math.max(0, currentIndex) / pageSize));
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const visiblePage = Math.min(page, pages - 1);
  const start = visiblePage * pageSize;

  useEffect(() => {
    setPage(Math.floor(Math.max(0, currentIndex) / pageSize));
  }, [current, currentIndex, pageSize]);

  return <>
    <div className="navigator" aria-label="Question navigator">{items.slice(start, start + pageSize).map(item => <button key={item.id} className={status(item)} aria-label={`Question ${item.id}${status(item) ? ', ' + status(item) : ''}`} aria-current={current === item.id ? 'step' : undefined} onClick={() => onSelect(item.id)}>{item.id}</button>)}</div>
    {pages > 1 && <nav className="pagination navigator-pagination" aria-label="Question navigator pages">
      <button disabled={visiblePage === 0} onClick={() => setPage(visiblePage - 1)}>Previous</button>
      <span className="muted">{start + 1}-{Math.min(start + pageSize, items.length)} of {items.length}</span>
      <button disabled={visiblePage === pages - 1} onClick={() => setPage(visiblePage + 1)}>Next</button>
    </nav>}
  </>;
}
