import './styles.css';
import './navigation.css';
import catalog from './catalog.json';
import { fetchText, loadNoteContent } from './note-content.js';

const tabs = ['Home', 'Backend', 'Backend Practice', 'DevOps', 'Web', 'SD', 'GenAI'];
const slugs = ['home', 'backend', 'practice', 'devops', 'web', 'sd', 'genai'];
const groups = {
  backend: [['Java & Spring', ['java-topics', 'spring-topics', 'solid-patterns']]],
  practice: [['Practice', ['@tasks', '@workspace']], ['Reference', ['git-commands', 'junit-concepts', 'java-snippets', 'sql-snippets', 'mongodb']]],
  devops: [['Commands', ['devops-daily', 'devops-useful']], ['Infrastructure', ['docker', 'kubernetes', 'minikube']], ['Cloud', ['aws', 'azure']]],
  web: [['Fundamentals', ['html', 'css', 'javascript', 'typescript', 'frontend-quickref']], ['Frameworks', ['react', 'redux', 'angular']]],
  home: [['Getting started', ['@overview', 'intro']], ['Project write-ups', ['proj-reidyai', 'proj-citibank', 'proj-accenture']], ['Project stories & questions', ['behavioral-stories', 'behavioral-questions']]]
};
const names = { '@overview': 'Overview', '@tasks': 'ReidyAI Project Tasks', '@workspace': 'Java Practice Exercises' };
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
  } catch { /* The catalog-based sidebar remains available if source navigation cannot load. */ }
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
  <header class="topbar"><a class="brand" href="#home"><span class="brand-icon">&lt;/&gt;</span><span>CodeGround<small>LEARN. BUILD. EXPLAIN.</small></span></a><nav class="tabs" aria-label="Main navigation">${tabs.map((tab, i) => `<a data-tab="${slugs[i]}" href="${defaultRoute(slugs[i])}">${tab}</a>`).join('')}</nav><div class="toplinks"><input class="search" type="search" aria-label="Search all notes" placeholder="Search all notes…"><button class="mobile-menu" aria-label="Toggle topic menu" aria-expanded="false">☰</button></div></header>
  <div class="workspace"><aside class="sidebar" aria-label="Topic navigation"></aside><main class="main" id="main"></main></div>`;
const main = document.querySelector('#main');
const sidebar = document.querySelector('.sidebar');
const search = document.querySelector('.search');
const menu = document.querySelector('.mobile-menu');
menu.onclick = () => { sidebar.classList.toggle('open'); menu.setAttribute('aria-expanded', sidebar.classList.contains('open')); };

function sidebarLink(tab, repo, id, activeId) {
  const href = id === '@overview' ? '#home' : id === '@tasks' ? '#practice/tasks' : id === '@workspace' ? '#practice/workspace' : noteRoute(getNote(repo, id) || { repo, id });
  return `<a class="side-link ${id === activeId ? 'active' : ''}" href="${href}" ${id === activeId ? 'aria-current="page"' : ''}>${escape(names[id] || getNote(repo, id)?.title || id)}</a>`;
}
function renderSidebar(tab, activeId) {
  const repo = tab === 'sd' || tab === 'genai' ? tab : 'interview';
  const link = id => sidebarLink(tab, repo, id, activeId);
  const subgroup = (title, ids, key) => `<details class="topic-group" data-group="${escape(key)}" ${ids.includes(activeId) || openGroups.has(key) ? 'open' : ''}><summary><span class="group-chevron" aria-hidden="true">›</span><span>${escape(title)}</span><span class="topic-count">${ids.length}</span></summary><div class="topic-list">${ids.map(link).join('')}</div></details>`;
  if (libraryNavigation[tab]) {
    sidebar.innerHTML = `<div class="side-title">${escape(tabs[slugs.indexOf(tab)])}<span>TOPIC LIBRARY</span></div>` + libraryNavigation[tab].map((section, index) => `<section class="side-section"><h2 class="side-section-title">${escape(section.title)}</h2>${section.items.map((item, itemIndex) => item.id ? link(item.id) : subgroup(item.title, item.ids, `${tab}:${index}:${itemIndex}`)).join('')}</section>`).join('');
    sidebar.querySelectorAll('[data-group]').forEach(detail => detail.addEventListener('toggle', () => { detail.open ? openGroups.add(detail.dataset.group) : openGroups.delete(detail.dataset.group); }));
    return;
  }
  let sections = groups[tab];
  if (tab === 'sd' || tab === 'genai') {
    const notes = notesByRepo.get(tab) || [];
    sections = [['Getting started', ['home']], ['Topics', notes.filter(note => note.id !== 'home' && !note.id.startsWith('q-')).map(note => note.id)], ['Design questions', notes.filter(note => note.id.startsWith('q-')).map(note => note.id)]];
  }
  sidebar.innerHTML = `<div class="side-title">${escape(tabs[slugs.indexOf(tab)] || 'Home')}<span>TOPIC LIBRARY</span></div>` + (sections || []).filter(([, ids]) => ids.length).map(([title, ids]) => `<section class="side-section"><h2 class="side-section-title">${escape(title)}</h2><div class="topic-list">${ids.map(link).join('')}</div></section>`).join('');
}
function dashboard() {
  main.innerHTML = `<div class="page"><div class="intro-line"><div><div class="eyebrow">Your engineering workspace</div><h1>A place to learn.<br>A project to build.</h1><p class="muted">Study core concepts, sharpen your interview skills, and put your knowledge into practice.</p></div></div>
    <div class="section-heading"><h2>Choose your focus</h2><span>Explore your library</span></div><div class="cards">${slugs.slice(1).map((slug, i) => {
      const count = catalog.filter(note => tabFor(note) === slug).length;
      return `<a class="card" href="${defaultRoute(slug)}"><div class="card-icon">${['{ }', '&gt;_', '⌘', '&lt;/&gt;', '◇', '✧'][i]}</div><h3>${tabs[i + 1]}</h3><p>${labels[slug]}</p><div class="card-footer"><span>${slug === 'practice' ? 'Project tasks + coding workspace' : `${count} notes`}</span><span>↗</span></div></a>`;
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
function showWorkspace(project = false, topicTasks = false, scenarioId = '', taskId = '') {
  const params = new URLSearchParams();
  if (topicTasks) params.set('bank', 'topics');
  else if (project) params.set('bank', 'project');
  if (project && scenarioId) params.set('scenario', scenarioId);
  if (project && taskId) params.set('task', taskId);
  const query = params.toString();
  main.innerHTML = `<div class="reader"><iframe class="note-frame" title="${project ? 'ReidyAI Coding Exercises' : 'Java Practice Exercises'}" src="${import.meta.env.BASE_URL}practice.html${query ? '?' + query : ''}"></iframe></div>`;
}
function showSearch(query) {
  const normalizedQuery = query.toLowerCase();
  const matches = searchIndex.filter(entry => entry.text.includes(normalizedQuery)).map(entry => entry.note);
  main.innerHTML = `<div class="page"><div class="eyebrow">All learning areas</div><h1>Search your library.</h1><p class="muted">${matches.length} topic matches for “${escape(query)}”</p>${matches.map(note => `<a class="result" href="${noteRoute(note)}">${escape(note.title)}<small>${escape(tabs[slugs.indexOf(tabFor(note))])} · ${escape(note.repo)}</small></a>`).join('') || '<p>No matching topics. Try Java, cache, RAG, or Docker.</p>'}</div>`;
}
function router() {
  clearTimeout(searchTimer);
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
  renderSidebar(tab, repo === 'workspace' ? '@workspace' : ['tasks', 'project-coding', 'task-board', 'incidents'].includes(repo) ? '@tasks' : id || '@overview');
  if ((tab === 'sd' || tab === 'genai') && !libraryNavigation[tab]) {
    if (!navigationRequests.has(tab)) navigationRequests.set(tab, loadLibraryNavigation(tab).finally(() => navigationRequests.delete(tab)));
    navigationRequests.get(tab).then(() => {
      if (version === routeVersion && libraryNavigation[tab]) renderSidebar(tab, id || 'home');
    });
  }
  sidebar.classList.remove('open'); menu.setAttribute('aria-expanded', 'false');
  main.scrollTop = 0;
  if (tab === 'home' && !repo) dashboard();
  else if (tab === 'practice' && repo === 'workspace' && id === 'production') location.replace(`#practice/tasks?scenario=${encodeURIComponent(new URLSearchParams(queryString).get('scenario') || 'n-plus-one')}`);
  else if (tab === 'practice' && repo === 'workspace') showWorkspace();
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
  if (!query) { router(); return; }
  ++routeVersion;
  searchTimer = setTimeout(() => showSearch(query), 120);
});
search.addEventListener('keydown', event => { if (event.key === 'Enter' && search.value.trim()) location.hash = `search/?q=${encodeURIComponent(search.value.trim())}`; });
window.addEventListener('hashchange', router);
router();
