const pending = new Map();
const MAX_CACHED_NOTES = 40;

// Share in-flight requests and successful responses; let failed requests retry.
export function fetchText(file) {
  if (!pending.has(file)) {
    const request = fetch(`${import.meta.env.BASE_URL}${file}`).then(response => {
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
    isStreams ? fetchText('java-streams.html') : '',
    isStreams ? import('./stream-approaches.js') : null
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
  if (isStreams) return approaches.addStreamApproaches(original + supplement);
  if (note.repo === 'interview' && note.id === 'java-topics') {
    const doc = new DOMParser().parseFromString(original, 'text/html');
    const heading = [...doc.querySelectorAll('h3')].find(element => element.textContent.trim() === 'Multithreading');
    if (heading) {
      const imageUrl = new URL(`${import.meta.env.BASE_URL}images/concurrency-concepts.png`, location.href).href;
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
