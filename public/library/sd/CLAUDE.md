# CLAUDE.md

**System Design Notes** - static study site on GitHub Pages
(<https://kalyan-pologi.github.io/System-Design-Notes/>). A multi-file SPA:
one URL, client-side `#hash` navigation. Plain HTML/CSS/vanilla JS, no build step.

## Structure

- `index.html` - shell: sidebar nav + empty `#content`
- `assets/style.css` - all styling · `assets/app.js` - hash router (fetches notes, caches)
- `notes/<id>.html` - one note per file = its inner HTML only

## Add a note

1. `notes/<id>.html` with **only** the note body (no page wrapper / `.section` wrapper /
   `<style>` / `<script>`). Start with a `.section-header` (tag + h1 + summary).
2. Sidebar link in `index.html`: `<a class="nav-sub" href="#<id>" data-note="<id>">Title</a>`.
3. `<id>` must match across filename, `href`, and `data-note`. Prefixes: `q-` questions, `p-` patterns.
4. Write substantial content, not a skeleton. Each of the 9 framework sections below should
   have real depth (multiple concrete points, not one throwaway line) - this is study material
   Kalyan will use to actually prep for interviews, not a placeholder.

## Diagrams & images in a note

To pair prose with a diagram (flowchart, architecture sketch, etc.):

1. Wrap the note body's prose in `.note-body` so text uses the scoped sizes, and place the
   image in a `<figure class="note-figure">`:

   ```html
   <div class="note-body">
     <p>Explain the concept. Use <b>bold</b> for key terms and <code>code</code>.</p>
     <figure class="note-figure">
       <img src="assets/img/<name>.svg" alt="Describe the diagram for accessibility">
       <figcaption>Short caption</figcaption>
     </figure>
   </div>
   ```

2. Put image files in `assets/img/`. SVG is preferred (crisp, tiny). Paths are relative to
   `index.html` (the root) - always `assets/img/...`, never `../assets/...`.
3. If `.note-figure` / `.note-body` styling isn't in `style.css` yet, add it there (cap
   `.note-figure img` at ~520px and center it; never inline styles). Validate an SVG parses:
   `python -c "import xml.dom.minidom as m; m.parse('assets/img/<name>.svg')"`.

## Rules

- Notes are pure fragments; the router owns layout. Reuse existing CSS classes; new CSS
  goes in `style.css` (never inline). Keep paths relative. No CDNs/dependencies.
- Verify over a local server (`fetch` fails on `file://`): `python -m http.server 8000`.
- Commit/push only when asked. `git pull` first - `main` is sometimes edited on GitHub.
- **Never use em dashes (—) or en dashes (–) anywhere** - in notes, in this file, in commit
  messages, in chat responses. Use a comma, a period, "and"/"but", parentheses, or a plain
  hyphen instead.

## Who I am

Kalyan. Preparing for system design interviews. Building this site as personal study notes.

## Learning Framework (use for every concept)

1. What is it
2. Why introduced (problem it solves)
3. How it works (just enough internals)
4. When to use / use cases
5. Trade-offs (what you give up)
6. Failure modes + mitigations
7. When NOT to use
8. Where it fits in system diagram
9. Real world example (Redis, Kafka, Nginx etc.)

## How each session works

1. Kalyan says: "Today's topic: [Topic]. Section ID: [id]"
2. Claude teaches the concept using the framework above, in depth
3. Claude writes the note directly into `notes/<id>.html`, replacing the coming-soon div

## Total scope (approx.)

- Core Concepts: 55 topics x 45-60 min, about 45 hrs
- Key Technologies: 15 topics x 30-45 min, about 10 hrs
- Patterns: 14 topics x 30 min, about 7 hrs
- Question Breakdowns: 29 topics x 60-90 min, about 40 hrs
- **Total: about 100 hrs**
