const pending = new Map();

// Share in-flight requests and successful responses; let failed requests retry.
export function fetchText(file) {
  if (!pending.has(file)) {
    pending.set(file, fetch(`${import.meta.env.BASE_URL}${file}`).then(response => {
      if (!response.ok) throw new Error(`Could not load content (${response.status}).`);
      return response.text();
    }).catch(error => {
      pending.delete(file);
      throw error;
    }));
  }
  return pending.get(file);
}

export async function loadNoteContent(note) {
  const isStreams = note.repo === 'interview' && note.id === 'java-snippets';
  const [original, supplement, approaches] = await Promise.all([
    fetchText(note.file),
    isStreams ? fetchText('java-streams.html') : '',
    isStreams ? import('./stream-approaches.js') : null
  ]);
  if (isStreams) return approaches.addStreamApproaches(original + supplement);
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
