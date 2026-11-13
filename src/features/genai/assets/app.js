// Cache for loaded notes
const noteCache = new Map();

// Navigate to a note via hash
async function navigateToNote(noteId) {
  // Default to home if no ID or invalid
  if (!noteId) noteId = 'home';

  // Update active nav items
  updateActiveNav(noteId);

  // Load and display the note
  await loadNote(noteId);
}

// Load note content and insert into #content
async function loadNote(noteId) {
  // Check cache first
  if (noteCache.has(noteId)) {
    displayNote(noteCache.get(noteId), noteId);
    return;
  }

  try {
    // Fetch the note HTML file
    const response = await fetch(`notes/${noteId}.html`);

    if (!response.ok) {
      // If note not found, show 404
      displayNotFound(noteId);
      return;
    }

    const html = await response.text();

    // Cache it
    noteCache.set(noteId, html);

    // Display it
    displayNote(html, noteId);
  } catch (error) {
    console.error(`Failed to load note: ${noteId}`, error);
    displayError(noteId);
  }
}

// Display note content
function displayNote(html, noteId) {
  const content = document.getElementById('content');

  // Wrap in section if not already wrapped
  if (!html.trim().startsWith('<div class="section')) {
    content.innerHTML = `<div class="section active" id="${noteId}">${html}</div>`;
  } else {
    content.innerHTML = html;
    const section = content.querySelector('.section');
    if (section) section.classList.add('active');
  }

  // Scroll to top
  document.getElementById('main').scrollTop = 0;
}

// Show 404 message
function displayNotFound(noteId) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="section active">
      <div class="section-header">
        <h1>404 — Note Not Found</h1>
        <p>The note "<code>${noteId}</code>" doesn't exist yet.</p>
      </div>
      <div class="coming-soon">
        <div class="cs-icon">🚧</div>
        <h3>Coming Soon</h3>
        <p>This content hasn't been created yet. Check the sidebar for available notes.</p>
      </div>
    </div>
  `;
}

// Show error message
function displayError(noteId) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="section active">
      <div class="section-header">
        <h1>⚠️ Error Loading Note</h1>
        <p>There was an error loading the note "<code>${noteId}</code>".</p>
      </div>
      <div class="coming-soon">
        <div class="cs-icon">❌</div>
        <h3>Could Not Load</h3>
        <p>Please try refreshing the page or selecting a different note.</p>
      </div>
    </div>
  `;
}

// Update active navigation items
function updateActiveNav(noteId) {
  // Remove active from all nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });

  // Find nav item with matching data-note
  const navItem = document.querySelector(`[data-note="${noteId}"]`);

  if (navItem) {
    navItem.classList.add('active');

    // Auto-open parent group if nested
    const group = navItem.closest('.sidebar-group-items');
    if (group) {
      group.classList.add('open');
      const header = group.previousElementSibling;
      if (header) header.classList.add('open');
    }
  }
}

// Toggle sidebar group
function toggleGroup(header) {
  header.classList.toggle('open');
  const items = header.nextElementSibling;
  if (items) items.classList.toggle('open');
}

// Handle sidebar logo click
function handleLogoClick() {
  window.location.hash = '#home';
}

// Handle hash change
function onHashChange() {
  const hash = window.location.hash.slice(1); // Remove #
  navigateToNote(hash);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Handle hash change events
  window.addEventListener('hashchange', onHashChange);

  // Handle logo click
  const logo = document.querySelector('.sidebar-logo');
  if (logo) {
    logo.addEventListener('click', handleLogoClick);
  }

  // Attach toggle listeners to group headers
  document.querySelectorAll('.sidebar-group-header').forEach(header => {
    header.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleGroup(header);
    });
  });

  // Attach nav item listeners
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const noteId = item.getAttribute('data-note');
      if (noteId) {
        e.preventDefault();
        window.location.hash = `#${noteId}`;
      }
    });
  });

  // Trigger initial navigation
  onHashChange();
});

// Keyboard shortcut: Escape to go home
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.location.hash = '#home';
  }
});
