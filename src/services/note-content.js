const pending = new Map();
const MAX_CACHED_NOTES = 40;
const featureNotes = import.meta.glob('../features/**/*.html', { query: '?raw', import: 'default' });
const featureNoteByName = Object.fromEntries(Object.keys(featureNotes).map(key => [key.split('/').pop(), key]));
const featureAssets = import.meta.glob('../features/**/assets/**/*', { query: '?url', import: 'default', eager: true });
import concurrencyImage from '../features/backend/java-spring/assets/concurrency-concepts.png?url';
const featureAliases = {
  'library/sd/notes/': 'features/system-design/notes/',
  'library/genai/notes/': 'features/genai/notes/'
};

function rewriteAssets(html, repo) {
  const assetRoot = repo === 'sd'
    ? '../features/system-design/assets/'
    : repo === 'genai'
      ? '../features/genai/assets/'
      : '../features/assets/interview/';
  return html.replace(/\b(src|href)=(['"])assets\/([^'"#?]+)([^'"]*)\2/g, (match, attribute, quote, file, suffix) => {
    const url = featureAssets[assetRoot + file];
    return url ? `${attribute}=${quote}${url}${suffix}${quote}` : match;
  });
}

// Share in-flight requests and successful responses; let failed requests retry.
export function fetchText(file) {
  if (!pending.has(file)) {
    const featureFile = Object.entries(featureAliases).reduce((value, [prefix, replacement]) => value.startsWith(prefix) ? replacement + value.slice(prefix.length) : value, file);
    const fileName = file.split('/').pop();
    const scopedKey = file.startsWith('library/sd/')
      ? Object.keys(featureNotes).find(key => key.includes('/system-design/notes/') && key.endsWith('/' + fileName))
      : file.startsWith('library/genai/')
        ? Object.keys(featureNotes).find(key => key.includes('/genai/notes/') && key.endsWith('/' + fileName))
        : null;
    const imported = featureNotes[`../${featureFile}`] || featureNotes[scopedKey] || featureNotes[featureNoteByName[fileName]];
    const request = imported ? imported() : fetch(`${import.meta.env.BASE_URL}${file}`).then(response => {
      if (!response.ok) throw new Error(`Could not load content (${response.status}).`);
      return response.text();
    }).catch(error => {
      if (pending.get(file) === request) pending.delete(file);
      throw error;
    });
    pending.set(file, request);
  }
  const response = pending.get(file);
  // Refresh access order, keeping recently viewed notes without retaining the whole library.
  pending.delete(file);
  pending.set(file, response);
  if (pending.size > MAX_CACHED_NOTES) pending.delete(pending.keys().next().value);
  return response;
}

export async function loadNoteContent(note) {
  const isStreams = note.repo === 'interview' && note.id === 'java-snippets';
  let [original, supplement, approaches] = await Promise.all([
    fetchText(note.file),
    isStreams ? fetchText('features/backend-practice/java-stream/java-streams.html') : '',
    isStreams ? import('../features/backend-practice/java-stream/stream-approaches.js') : null
  ]);
  if (note.repo === 'interview' && ['java-topics', 'spring-topics', 'solid-patterns'].includes(note.id)) {
    const doc = new DOMParser().parseFromString(original, 'text/html');
    const heading = [...doc.querySelectorAll('h2')].find(element => element.textContent.trim() === 'From My Own Work');
    if (heading) {
      if (heading.previousElementSibling?.tagName === 'HR') heading.previousElementSibling.remove();
      let current = heading;
      while (current) {
        const next = current.nextElementSibling;
        current.remove();
        if (next?.tagName === 'H2') break;
        current = next;
      }
    }
    original = doc.body.innerHTML;
  }
  original = rewriteAssets(original, note.repo);
  if (isStreams) return approaches.addStreamApproaches(original + supplement);
  if (note.repo === 'interview' && note.id === 'java-topics') {
    const doc = new DOMParser().parseFromString(original, 'text/html');
    const heading = [...doc.querySelectorAll('h3')].find(element => element.textContent.trim() === 'Multithreading');
    if (heading) {
      const imageUrl = concurrencyImage;
      const figure = doc.createElement('figure');
      figure.className = 'concurrency-reference';
      figure.innerHTML = `<a href="${imageUrl}" target="_blank" rel="noopener noreferrer" aria-label="Open concurrency concepts image at full size"><img src="${imageUrl}" alt="20 concurrency concepts: threads, synchronization, locks, deadlocks, thread pools, and concurrent data structures." loading="lazy" decoding="async" width="768" height="959" style="display:block;width:100%;max-width:768px;height:auto;margin:auto;border-radius:8px"></a>`;
      (heading.nextElementSibling?.tagName === 'P' ? heading.nextElementSibling : heading).after(figure);
    }
    return doc.body.innerHTML;
  }
  if (note.repo !== 'interview' || note.id !== 'proj-accenture') return original;

  // Keep the imported source intact while showing the shared AWS reference in DevOps.
  const doc = new DOMParser().parseFromString(original, 'text/html');
  const table = doc.querySelector('img[src$="aws-services-for-spring-boot-table.png"]')?.closest('figure');
  if (table) {
    const reference = doc.createElement('p');
    const link = doc.createElement('a');
    link.href = '#aws';
    link.textContent = 'AWS services reference → DevOps / AWS';
    reference.append(link);
    table.replaceWith(reference);
  }
  return doc.body.innerHTML;
}
