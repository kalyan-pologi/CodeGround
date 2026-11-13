import React from 'react';
import { createRoot } from 'react-dom/client';
import { sqlExercise } from './sql-exercises.js';
import SqlLab from './SqlLab';
import sqlLabStyles from '../../../styles/sql-lab.css?inline';

export function mountSqlRunners(doc) {
  const body = doc.querySelector('.note-body');
  if (!body || body.dataset.sqlRunners) return;
  body.dataset.sqlRunners = 'true';
  const style = doc.createElement('style'); style.textContent = sqlLabStyles; doc.head.append(style);
  let category = 'SQL';
  const questions = [];
  for (const node of body.children) {
    if (node.tagName === 'H2') category = node.textContent.trim();
    if (node.tagName !== 'P' || !node.querySelector('b')?.textContent.trim().startsWith('Q:')) continue;
    let snippet = node.nextElementSibling;
    const notes = [];
    while (snippet && snippet.tagName !== 'PRE' && !/^H[1-3]$/.test(snippet.tagName)) { notes.push(snippet.textContent); snippet = snippet.nextElementSibling; }
    if (!snippet || snippet.tagName !== 'PRE') continue;
    const exercise = sqlExercise(snippet.textContent);
    if (!exercise.runnable) continue;
    questions.push({ id: questions.length + 1, title: node.textContent.replace(/^Q:\s*/, '').replace(/\s+/g, ' ').trim(), category, description: notes.join(' '), ...exercise,
      starter: '-- Write your SQLite query below.\n', canCheck: exercise.runnable && !/\b(?:CREATE|ALTER|DROP)\s+TABLE/i.test(exercise.solution) });
  }
  const rootElement = doc.createElement('div'); rootElement.id = 'sql-lab-root';
  doc.body.className = 'sql-lab-page'; doc.body.replaceChildren(rootElement);
  createRoot(rootElement).render(React.createElement(SqlLab, { questions }));
}
