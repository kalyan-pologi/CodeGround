import './styles.css';
import './navigation.css';
import './modern.css';
import catalog from './catalog.json';
import { fetchText, loadNoteContent } from './note-content.js';

const tabs = ['Home', 'Backend', 'Backend Practice', 'DevOps', 'Web', 'SD', 'GenAI'];
const slugs = ['home', 'backend', 'practice', 'devops', 'web', 'sd', 'genai'];
const groups = {
  backend: [['Java & Spring', ['java-topics', 'spring-topics', 'solid-patterns']], ['Tooling', ['git-commands', 'junit-concepts', 'mongodb']]],
  practice: [['Practice', ['@tasks', '@workspace', '@debugging', 'java-snippets', 'sql-snippets']]],
  devops: [['Commands', ['devops-daily', 'devops-useful']], ['Infrastructure', ['docker', 'kubernetes', 'minikube']], ['Cloud', ['aws', 'azure']]],
  web: [['Fundamentals', ['html', 'css', 'javascript', 'typescript', 'frontend-quickref']], ['Frameworks', ['react', 'redux', 'angular']]],
  home: [['Getting started', ['@overview', 'intro']], ['Project write-ups', ['proj-reidyai', 'proj-citibank', 'proj-accenture']], ['Project stories & questions', ['behavioral-stories', 'behavioral-questions']]]
};
const names = { '@overview': 'Overview', '@tasks': 'ReidyAI Project Tasks', '@workspace': 'Java Practice Exercises', '@debugging': 'Debugging', 'java-snippets': 'Java Stream Code' };
const labels = { backend: 'Java, Spring Boot & design principles', practice: 'Build skills through project work', devops: 'Commands, containers & cloud', web: 'Frontend fundamentals & frameworks', sd: 'Architecture & distributed systems', genai: 'Models, retrieval & AI applications' };
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const noteIndex = new Map(catalog.map(note => [`${note.repo}/${note.id}`, note]));
const getNote = (repo, id) => noteIndex.get(`${repo}/${id}`);
const notesByRepo = catalog.reduce((map, note) => {
  if (!map.has(note.repo)) map.set(note.repo, []);
  map.get(note.repo).push(note); return map;
}, new Map());
const searchIndex = catalog.map(note => ({ note, text: `${note.title} ${note.id} ${note.repo}`.toLowerCase() }));
const libraryNavigation = {};
const navigationRequests = new Map();
const openGroups = new Set();
let openTab = null, closeTimer;
async function loadLibraryNavigation(repo) {
  try {
    const doc = new DOMParser().parseFromString(await fetchText(`library/${repo}/index.html`), 'text/html');
    const sections = [];
    const used = new Set();
    let section;
    const cleanLabel = element => {
      const copy = element.cloneNode(true);
      copy.querySelectorAll('span').forEach(span => span.remove());
      return copy.textContent.replace(/\s+/g, ' ').trim();
    };
    const idsIn = element => [...element.querySelectorAll('[data-note]')].map(link => link.dataset.note).filter(id => {
      if (!getNote(repo, id) || used.has(id)) return false;
      used.add(id); return true;
    });
    for (const element of doc.querySelector('#sidebar').children) {
      if (element.matches('.nav-section,.sidebar-section-label')) {
        section = { title: element.textContent.trim(), items: [] }; sections.push(section);
      } else if (element.matches('.nav-group,.sidebar-group')) {
        const heading = element.querySelector('.nav-group-label,.sidebar-group-header');
        const ids = idsIn(element);
        if (ids.length && section) section.items.push({ title: cleanLabel(heading), ids });
      } else if (element.matches('[data-note]') && section) {
        const id = element.dataset.note;
        if (getNote(repo, id) && !used.has(id)) { used.add(id); section.items.push({ id }); }
      }
    }
    const extra = (notesByRepo.get(repo) || []).filter(note => !used.has(note.id));
    if (extra.length) sections.push({ title: 'More topics', items: [{ title: 'Additional notes', ids: extra.map(note => note.id) }] });
    libraryNavigation[repo] = sections;
  } catch { /* Catalog-based topic links remain available if source navigation cannot load. */ }
}
function tabFor(note) {
  if (note.repo !== 'interview') return note.repo;
  for (const [tab, sections] of Object.entries(groups)) if (sections.some(([, ids]) => ids.includes(note.id))) return tab;
  return 'home';
}
const noteRoute = note => `#${tabFor(note)}/${note.repo}/${note.id}`;
const defaultRoute = tab => tab === 'home' ? '#home' : tab === 'practice' ? '#practice/tasks' : (tab === 'sd' || tab === 'genai') ? `#${tab}/${tab}/home` : `#${tab}/interview/${groups[tab][0][1][0]}`;
let routeVersion = 0;
document.querySelector('#app').innerHTML = `
  <header class="topbar"><div class="brand-group"><a class="brand" href="#home"><span class="brand-icon">&lt;/&gt;</span><span>CodeGround</span></a></div><nav class="tabs" aria-label="Main navigation">${tabs.map((tab, i) => `<button class="nav-tab" data-tab="${slugs[i]}" aria-expanded="false" aria-controls="topic-menu">${tab}<span class="nav-chevron" aria-hidden="true"></span></button>`).join('')}</nav><div class="toplinks"><input class="search" type="search" aria-label="Search all notes" placeholder="Search all notes…"></div></header>
  <section id="topic-menu" class="mega-menu" aria-label="Topic navigation" hidden><div class="mega-header"><button class="mega-close" aria-label="Close topic menu">×</button></div><div class="mega-columns"></div></section><div class="workspace"><main class="main" id="main"></main></div>`;
const main = document.querySelector('#main');
const search = document.querySelector('.search');
const topicMenu = document.querySelector('.mega-menu');
const topicContent = document.querySelector('.mega-columns');
function closeDropdown(restoreFocus = false) {
  clearTimeout(closeTimer);
  const trigger = document.querySelector('[data-tab="' + openTab + '"]');
  document.querySelectorAll('[data-tab]').forEach(button => button.setAttribute('aria-expanded', 'false'));
  topicMenu.hidden = true; openTab = null;
  if (restoreFocus) trigger?.focus();
}
function scheduleClose() { clearTimeout(closeTimer); closeTimer = setTimeout(() => { if (!topicMenu.contains(document.activeElement)) closeDropdown(); }, 220); }
function positionDropdown(tab) {
  const sizes = { home: [680, 3], backend: [560, 2], practice: [310, 1], devops: [640, 3], web: [580, 2], sd: [680, 2], genai: [680, 2] };
  const [preferredWidth, columns] = sizes[tab];
  const width = Math.min(preferredWidth, window.innerWidth - 24);
  const trigger = document.querySelector('[data-tab="' + tab + '"]').getBoundingClientRect();
  topicMenu.style.width = width + 'px';
  topicMenu.style.left = Math.max(12, Math.min(trigger.left - 12, window.innerWidth - width - 12)) + 'px';
  const top = document.querySelector('.topbar').getBoundingClientRect().bottom - 1;
  topicMenu.style.top = top + 'px';
  topicMenu.style.setProperty('--menu-top', top + 'px');
  topicMenu.style.setProperty('--topic-columns', String(window.innerWidth <= 700 ? 1 : columns));
}
function openDropdown(tab) {
  clearTimeout(closeTimer); openTab = tab; positionDropdown(tab);
  document.querySelectorAll('[data-tab]').forEach(button => button.setAttribute('aria-expanded', String(button.dataset.tab === tab)));
  topicMenu.setAttribute('aria-label', tabs[slugs.indexOf(tab)] + ' topics');
  topicContent.classList.toggle('practice-links', tab === 'practice');
  topicMenu.classList.toggle('library-menu', tab === 'sd' || tab === 'genai');
  renderDropdown(tab, currentActive(tab)); topicMenu.hidden = false;
  if ((tab === 'sd' || tab === 'genai') && !libraryNavigation[tab]) {
    if (!navigationRequests.has(tab)) navigationRequests.set(tab, loadLibraryNavigation(tab).finally(() => navigationRequests.delete(tab)));
    navigationRequests.get(tab).then(() => { if (openTab === tab) renderDropdown(tab, currentActive(tab)); });
  }
}
function currentActive(tab) {
  const [path] = location.hash.slice(1).split('?');
  const [selectedTab, repo, id] = path.split('/');
  if (selectedTab !== tab) return '';
  return repo === 'debugging' ? '@debugging' : repo === 'workspace' ? '@workspace' : ['tasks', 'project-coding', 'incidents'].includes(repo) ? '@tasks' : id || '@overview';
}
document.querySelectorAll('[data-tab]').forEach(button => {
  button.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') openDropdown(button.dataset.tab); });
  button.addEventListener('pointerleave', scheduleClose);
  button.addEventListener('click', () => { if (openTab === button.dataset.tab && button.dataset.clicked === 'true') { button.dataset.clicked = ''; closeDropdown(); } else { document.querySelectorAll('[data-tab]').forEach(item => item.dataset.clicked = ''); button.dataset.clicked = 'true'; openDropdown(button.dataset.tab); } });
  button.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); openDropdown(button.dataset.tab); topicContent.querySelector('a')?.focus(); }
    if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault(); const buttons = [...document.querySelectorAll('[data-tab]')], index = buttons.indexOf(button);
      const next = buttons[(index + (event.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length]; next.focus(); if (openTab) openDropdown(next.dataset.tab);
    }
  });
});
topicMenu.addEventListener('pointerenter', () => clearTimeout(closeTimer));
topicMenu.addEventListener('pointerleave', scheduleClose);
topicMenu.querySelector('.mega-close').addEventListener('click', () => closeDropdown(true));
topicMenu.addEventListener('click', event => { if (event.target.closest('a')) closeDropdown(); });
document.addEventListener('pointerdown', event => { if (!topicMenu.contains(event.target) && !event.target.closest('[data-tab]')) closeDropdown(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && openTab) { event.preventDefault(); closeDropdown(true); } });
window.addEventListener('resize', () => closeDropdown());

function sidebarLink(tab, repo, id, activeId) {
  const href = id === '@overview' ? '#home' : id === '@tasks' ? '#practice/tasks' : id === '@workspace' ? '#practice/workspace' : id === '@debugging' ? '#practice/debugging' : noteRoute(getNote(repo, id) || { repo, id });
  return `<a class="side-link ${id === activeId ? 'active' : ''}" href="${href}" ${id === activeId ? 'aria-current="page"' : ''}>${escape(names[id] || getNote(repo, id)?.title || id)}</a>`;
}
function renderDropdown(tab, activeId) {
  const repo = tab === 'sd' || tab === 'genai' ? tab : 'interview';
  const link = id => sidebarLink(tab, repo, id, activeId);
  const subgroup = (title, ids, key) => `<details class="topic-group" data-group="${escape(key)}" ${ids.includes(activeId) || openGroups.has(key) ? 'open' : ''}><summary><span class="group-chevron" aria-hidden="true">›</span><span>${escape(title)}</span><span class="topic-count">${ids.length}</span></summary><div class="topic-list">${ids.map(link).join('')}</div></details>`;
  if (libraryNavigation[tab]) {
    topicContent.innerHTML = libraryNavigation[tab].map((section, index) => `<section class="side-section"><h2 class="side-section-title">${escape(section.title)}</h2><div class="topic-list">${section.items.map((item, itemIndex) => item.id ? link(item.id) : subgroup(item.title, item.ids, `${tab}:${index}:${itemIndex}`)).join('')}</div></section>`).join('');
    topicContent.querySelectorAll('[data-group]').forEach(detail => detail.addEventListener('toggle', () => { detail.open ? openGroups.add(detail.dataset.group) : openGroups.delete(detail.dataset.group); }));
    return;
  }
  let sections = groups[tab];
  if (tab === 'sd' || tab === 'genai') {
    const notes = notesByRepo.get(tab) || [];
    sections = [['Getting started', ['home']], ['Topics', notes.filter(note => note.id !== 'home' && !note.id.startsWith('q-')).map(note => note.id)], ['Design questions', notes.filter(note => note.id.startsWith('q-')).map(note => note.id)]];
  }
  topicContent.innerHTML = (sections || []).filter(([, ids]) => ids.length).map(([title, ids]) => `<section class="side-section"><h2 class="side-section-title">${escape(title)}</h2><div class="topic-list">${ids.map(link).join('')}</div></section>`).join('');
}
function dashboard() {
  main.innerHTML = `<div class="page">
    <div class="cards">${slugs.slice(1).map((slug, i) => {
      return `<a class="card" href="${defaultRoute(slug)}"><div class="card-icon">${['BE', '{ }', '&gt;_', '&lt;/&gt;', 'SD', 'AI'][i]}</div><h3>${tabs[i + 1]}</h3><p>${labels[slug]}</p><div class="card-footer"><span aria-hidden="true">↗</span></div></a>`;
    }).join('')}</div></div>`;
}
async function showNote(repo, id, version) {
  const note = getNote(repo, id);
  if (!note) { main.innerHTML = '<div class="error"><h1>Note not found</h1><a href="#home">Return home</a></div>'; return; }
  main.innerHTML = '<div class="loading" role="status">Loading your notes…</div>';
  try {
    const html = await loadNoteContent(note);
    if (version !== routeVersion) return;
    main.innerHTML = `<div class="reader"><div class="reader-bar"><span>${escape(tabs[slugs.indexOf(tabFor(note))])} / ${escape(note.title)}</span></div><iframe class="note-frame" data-note="${escape(`${repo}/${id}`)}" title="${escape(note.title)}"></iframe></div>`;
    const base = new URL(`${import.meta.env.BASE_URL}library/${repo}/`, location.href).href;
    const frame = main.querySelector('iframe');
    // Keep imported CSS isolated so all three note formats retain their original styling.
    frame.onload = () => {
      const doc = frame.contentDocument;
      doc.addEventListener('pointerdown', () => closeDropdown());
      if (repo === 'interview' && id === 'sql-snippets') {
        import('./sql-runner.js').then(({ mountSqlRunners }) => {
          if (version === routeVersion && frame.contentDocument === doc) mountSqlRunners(doc);
        });
      }
      if (repo === 'interview' && id === 'java-snippets') {
        import('./stream-runner.js').then(({ mountStreamRunners }) => {
          if (version === routeVersion && frame.contentDocument === doc) mountStreamRunners(doc);
        });
      }
      doc.addEventListener('click', event => {
        const link = event.target.closest('a');
        if (!link) return;
        const href = link.getAttribute('href') || '';
        const hash = href.startsWith('#') ? href.slice(1) : '';
        if (hash && getNote(repo, hash)) { event.preventDefault(); location.hash = noteRoute(getNote(repo, hash)); }
        else if (hash) {
          const target = doc.getElementById(hash);
          if (target) { event.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
        } else if (/^https?:/.test(href)) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
      });
    };
    const readerStyles = new URL(`${import.meta.env.BASE_URL}reader.css`, location.href).href;
    frame.srcdoc = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${base}"><link rel="stylesheet" href="assets/style.css"><link rel="stylesheet" href="${readerStyles}"></head><body><main id="main"><div class="section active">${html}</div></main></body></html>`;
  } catch (error) {
    if (version === routeVersion) main.innerHTML = `<div class="error">${escape(error.message)} <a href="#home">Return home</a></div>`;
  }
}
function showWorkspace(project = false, topicTasks = false, scenarioId = '', taskId = '', debugging = false) {
  const params = new URLSearchParams();
  if (debugging) params.set('bank', 'debugging');
  else if (topicTasks) params.set('bank', 'topics');
  else if (project) params.set('bank', 'project');
  if (project && scenarioId) params.set('scenario', scenarioId);
  if (taskId) params.set('task', taskId);
  const query = params.toString();
  main.innerHTML = `<div class="reader"><iframe class="note-frame" title="${debugging ? 'Debugging' : project ? 'ReidyAI Coding Exercises' : 'Java Practice Exercises'}" src="${import.meta.env.BASE_URL}practice.html${query ? '?' + query : ''}"></iframe></div>`;
  const frame = main.querySelector('iframe');
  frame.addEventListener('load', () => frame.contentDocument?.addEventListener('pointerdown', () => closeDropdown()));
}
function showSearch(query) {
  const normalizedQuery = query.toLowerCase();
  const matches = searchIndex.filter(entry => entry.text.includes(normalizedQuery)).map(entry => entry.note);
  main.innerHTML = `<div class="page"><div class="eyebrow">All learning areas</div><h1>Search your library.</h1><p class="muted">${matches.length} topic matches for “${escape(query)}”</p>${matches.map(note => `<a class="result" href="${noteRoute(note)}">${escape(note.title)}<small>${escape(tabs[slugs.indexOf(tabFor(note))])} · ${escape(note.repo)}</small></a>`).join('') || '<p>No matching topics. Try Java, cache, RAG, or Docker.</p>'}</div>`;
}
function router() {
  clearTimeout(searchTimer);
  closeDropdown();
  const version = ++routeVersion;
  const [path, queryString = ''] = location.hash.slice(1).split('?');
  const [requestedTab, repo, id] = path.split('/');
  if (requestedTab === 'search') {
    const query = new URLSearchParams(location.hash.split('?')[1]).get('q') || '';
    search.value = query; showSearch(query); return;
  }
  const tab = slugs.includes(requestedTab) ? requestedTab : 'home';
  search.value = '';
  document.querySelectorAll('[data-tab]').forEach(link => { link.classList.toggle('active', link.dataset.tab === tab); link.setAttribute('aria-current', link.dataset.tab === tab ? 'page' : 'false'); });

  closeDropdown();
  main.scrollTop = 0;
  if (tab === 'home' && !repo) dashboard();
  else if (tab === 'practice' && repo === 'workspace' && id === 'production') location.replace(`#practice/tasks?scenario=${encodeURIComponent(new URLSearchParams(queryString).get('scenario') || 'n-plus-one')}`);
  else if (tab === 'practice' && repo === 'workspace') showWorkspace(false, false, '', new URLSearchParams(queryString).get('task') || '');
  else if (tab === 'practice' && repo === 'debugging') showWorkspace(false, false, '', '', true);
  else if (tab === 'practice' && repo === 'incidents') location.replace(`#practice/tasks?scenario=${encodeURIComponent(id || 'n-plus-one')}`);
  else if (tab === 'practice' && repo === 'project-coding') showWorkspace(true);
  else if (tab === 'practice' && (!repo || repo === 'tasks')) showWorkspace(true, true, new URLSearchParams(queryString).get('scenario') || (id === 'production' ? 'n-plus-one' : ''), new URLSearchParams(queryString).get('task') || '');
  else if (tab === 'practice' && repo === 'task-board') location.replace('#practice/tasks');
  else if (repo && id) showNote(repo, id, version);
  else { location.replace(defaultRoute(tab)); }
}
let searchTimer;
search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const query = search.value.trim();
  closeDropdown();
  if (!query) { router(); return; }
  ++routeVersion;
  searchTimer = setTimeout(() => showSearch(query), 120);
});
search.addEventListener('keydown', event => { if (event.key === 'Enter' && search.value.trim()) location.hash = `search/?q=${encodeURIComponent(search.value.trim())}`; });
window.addEventListener('hashchange', router);
router();