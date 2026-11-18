import { fetchText } from '../../../services/note-content.js';
import questionStyles from '../../../styles/interview-questions.css?inline';

const questions = [
  'React architecture and components',
  'State management and data flow',
  'Hooks and component lifecycle',
  'Forms and user input',
  'Lists, rendering, and reconciliation',
  'Routing and application navigation',
  'REST API integration with Spring Boot',
  'React performance optimization',
  'Error handling, testing, and production quality',
  'Designing a complete React and Spring Boot feature'
];

function addStyle(doc) {
  if (doc.querySelector('[data-react-interview-style]')) return;
  const style = doc.createElement('style');
  style.dataset.reactInterviewStyle = 'true';
  style.textContent = questionStyles;
  doc.head.append(style);
}

function loadSections(doc, html) {
  const template = doc.createElement('template');
  template.innerHTML = html;
  return [...template.content.querySelectorAll('[data-react-question]')];
}

export function mountReactInterviewQuestionDrawer(doc) {
  if (doc.body.dataset.reactInterviewDrawer) return;
  const body = doc.querySelector('.note-body');
  if (!body) return;
  doc.body.dataset.reactInterviewDrawer = 'true';
  addStyle(doc);

  const reader = doc.createElement('main');
  reader.className = 'interview-question-reader';
  body.replaceChildren(reader);
  let sections = [];
  let activeIndex = 0;
  let requestVersion = 0;

  const select = index => {
    if (!sections[index]) return false;
    activeIndex = index;
    const current = ++requestVersion;
    const article = doc.createElement('article');
    article.className = 'interview-question-answer';
    const title = doc.createElement('h1');
    title.textContent = `Question ${index + 1}: ${questions[index]}`;
    article.append(title);
    const status = doc.createElement('p');
    status.setAttribute('role', 'status');
    status.textContent = 'Loading answer…';
    article.append(status);
    reader.replaceChildren(article);
    fetchText('features/web/frameworks/content/react-interview-questions.html').then(html => {
      if (current !== requestVersion || !article.isConnected) return;
      const source = loadSections(doc, html).find(section => section.dataset.reactQuestion === String(index + 1));
      if (!source) { status.textContent = 'Answer not available yet.'; return; }
      const clone = source.cloneNode(true);
      clone.removeAttribute('data-react-question');
      article.replaceChildren(title, clone);
    }).catch(() => {
      if (current === requestVersion && article.isConnected) status.textContent = 'Could not load this answer. Please try again.';
    });
    return true;
  };

  fetchText('features/web/frameworks/content/react-interview-questions.html').then(html => {
    sections = loadSections(doc, html);
    if (sections.length) select(0);
  });

  const toolbar = doc.createElement('div');
  toolbar.className = 'interview-question-toolbar';
  toolbar.innerHTML = `<button class="interview-question-menu" type="button" aria-label="Open React interview questions" aria-haspopup="dialog"><span aria-hidden="true">☰</span></button>
    <strong>React Interview Questions</strong>
    <button class="interview-question-nav" type="button" data-direction="previous" aria-label="Previous question">‹</button>
    <button class="interview-question-nav" type="button" data-direction="next" aria-label="Next question">›</button>
    <span class="interview-question-count" aria-live="polite">1 / 10</span>`;
  doc.body.prepend(toolbar);

  const drawer = doc.createElement('dialog');
  drawer.className = 'interview-question-drawer';
  drawer.setAttribute('aria-label', 'React interview questions');
  drawer.innerHTML = `<div class="interview-question-drawer-inner">
    <header><h2>React Interview Questions</h2><button type="button" aria-label="Close interview questions">×</button></header>
    <label><span class="interview-question-sr-only">Search questions</span><input type="search" placeholder="Search questions"></label>
    <div class="interview-question-list"></div>
  </div>`;
  doc.body.append(drawer);

  const list = drawer.querySelector('.interview-question-list');
  const search = drawer.querySelector('input');
  const render = () => {
    const query = search.value.trim().toLowerCase();
    list.innerHTML = questions.map((title, index) => ({ title, index }))
      .filter(item => item.title.toLowerCase().includes(query))
      .map(item => `<button type="button" data-index="${item.index}"><span class="interview-question-dot" aria-hidden="true"></span><span>${item.index + 1}. ${item.title}</span><small>React</small></button>`)
      .join('') || '<p class="interview-question-empty">No questions match your search.</p>';
  };
  const count = toolbar.querySelector('.interview-question-count');
  const navigate = index => { if (select(index)) count.textContent = `${index + 1} / ${questions.length}`; };
  toolbar.querySelector('.interview-question-menu').addEventListener('click', () => { drawer.showModal(); search.focus(); });
  toolbar.querySelector('[data-direction="previous"]').addEventListener('click', () => navigate(Math.max(0, activeIndex - 1)));
  toolbar.querySelector('[data-direction="next"]').addEventListener('click', () => navigate(Math.min(questions.length - 1, activeIndex + 1)));
  drawer.querySelector('header button').addEventListener('click', () => drawer.close());
  drawer.addEventListener('click', event => { if (event.target === drawer) drawer.close(); });
  search.addEventListener('input', render);
  list.addEventListener('click', event => { const button = event.target.closest('[data-index]'); if (!button) return; navigate(Number(button.dataset.index)); drawer.close(); });
  render();
}
