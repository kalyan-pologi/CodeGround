#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the backup index.html with all sections
const indexPath = path.join(__dirname, 'index.html.backup');
const html = fs.readFileSync(indexPath, 'utf-8');

// Create notes directory if it doesn't exist
const notesDir = path.join(__dirname, 'notes');
if (!fs.existsSync(notesDir)) {
  fs.mkdirSync(notesDir, { recursive: true });
}

// Extract all <div class="section" id="..."> blocks
const sectionRegex = /<div class="section"[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/div>\s*(?=<div class="section"|<\/main>)/g;

let match;
let count = 0;
const noteIds = [];

while ((match = sectionRegex.exec(html)) !== null) {
  const id = match[1];
  const content = match[2].trim();

  // Write each section to notes/<id>.html
  const notePath = path.join(notesDir, `${id}.html`);
  fs.writeFileSync(notePath, content, 'utf-8');

  noteIds.push(id);
  count++;
  console.log(`✓ Created notes/${id}.html`);
}

console.log(`\n✅ Split ${count} sections into notes/ directory`);
console.log(`Note IDs created: ${noteIds.join(', ')}`);

// Verify: extract all nav data-note attributes
const navRegex = /data-note="([^"]+)"/g;
const navIds = new Set();

while ((match = navRegex.exec(html)) !== null) {
  navIds.add(match[1]);
}

console.log(`\n📋 Verification:`);
console.log(`Total nav items: ${navIds.size}`);

// Check for mismatches
const missingFiles = Array.from(navIds).filter(id => !noteIds.includes(id) && id !== 'home');
const unusedFiles = noteIds.filter(id => !navIds.has(id));

if (missingFiles.length > 0) {
  console.log(`⚠️  Nav items without note files: ${missingFiles.join(', ')}`);
}

if (unusedFiles.length > 0) {
  console.log(`⚠️  Note files without nav items: ${unusedFiles.join(', ')}`);
}

if (missingFiles.length === 0 && unusedFiles.length === 0) {
  console.log(`✅ All nav items have corresponding note files!`);
}
