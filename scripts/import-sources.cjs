const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const sources = {
  interview: 'C:/Users/kalya/Downloads/Job-Hunt/Interview-Prep-Notes',
  sd: 'C:/Users/kalya/Downloads/SDE/System Design/System-Design-Notes/System-Design-Notes',
  genai: 'C:/Users/kalya/Downloads/SDE/GenAI/GenAI-Notes/GenAI-Notes',
  practice: 'C:/Users/kalya/Downloads/Job-Hunt/Java-Practice'
};
const ignored = new Set(['.git', 'node_modules', 'dist', '.claude', '.codex', '.agents', '.github', 'CodeGround']);
const manifest = [];
function copyTree(source, destination, repo) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (ignored.has(entry.name) || entry.isSymbolicLink()) continue;
    const from = path.join(source, entry.name), to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyTree(from, to, repo);
    else {
      fs.copyFileSync(from, to);
      manifest.push({ repo, file: path.relative(root, to).replaceAll('\\', '/'), sha256: crypto.createHash('sha256').update(fs.readFileSync(from)).digest('hex') });
    }
  }
}
const catalog = [];
for (const [repo, source] of Object.entries(sources)) {
  copyTree(source, path.join(root, repo === 'practice' ? 'practice' : `public/library/${repo}`), repo);
  if (repo === 'practice') continue;
  const index = fs.readFileSync(path.join(source, 'index.html'), 'utf8');
  const clean = text => text.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const labels = new Map();
  for (const match of index.matchAll(/<(?:a|div)\b[^>]*data-note="([^"]+)"[^>]*>([\s\S]*?)<\/(?:a|div)>/g)) labels.set(match[1], clean(match[2]));
  for (const file of fs.readdirSync(path.join(source, 'notes'))) {
    if (!file.endsWith('.html')) continue;
    const id = file.slice(0, -5);
    const text = fs.readFileSync(path.join(source, 'notes', file), 'utf8');
    const heading = text.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || text.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    catalog.push({ repo, id, title: labels.get(id) || (heading ? clean(heading[1]) : id), file: `library/${repo}/notes/${file}` });
  }
}
fs.mkdirSync(path.join(root, 'src'), { recursive: true });
fs.writeFileSync(path.join(root, 'src/catalog.json'), JSON.stringify(catalog, null, 2));
fs.writeFileSync(path.join(root, 'migration-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Copied ${manifest.length} files; indexed ${catalog.length} notes. Original repositories were not modified.`);
