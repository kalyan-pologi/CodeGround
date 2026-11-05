# CodeGround

A local engineering learning workspace combining Interview-Prep-Notes, Java-Practice, System-Design-Notes, and GenAI-Notes.

## Run locally

Requires Node.js 20.16+ and npm.

```powershell
cd C:\Users\kalya\Downloads\Job-Hunt\CodeGround
npm install
npm run dev
```

Open the Local URL printed by Vite, normally http://127.0.0.1:5173. If that port is busy, Vite selects another.

```powershell
npm run check
npm run build
npm run preview
```

## Navigation

- Home: introduction, project write-ups, behavioral stories, and questions.
- Backend: Java, Spring / Spring Boot, SOLID, and design patterns.
- Backend Practice: separate ReidyAI Project Tasks and Java Practice Exercises tabs, plus Git, JUnit, Java snippets, SQL, and MongoDB references. Java Practice Exercises contains all 50 original coding challenges and 100 original MCQs; ReidyAI keeps its own task board and project exercise bank.
- DevOps: daily/useful commands, Docker, Kubernetes, Minikube, AWS, and Azure.
- Web: HTML, CSS, JavaScript, TypeScript, revision, React, Redux, and Angular.
- SD: all imported system design notes.
- GenAI: all imported GenAI notes.

Topic search spans all three note libraries. Note styles are isolated in a same-origin reader to preserve existing formatting. Project task completion and task notes save in browser localStorage. Coding drafts and MCQ answers currently last only while the coding workspace remains mounted.

## Performance and validation

Practice loads only the selected question bank. Coding and MCQ components load separately, keeping the Monaco editor out of the practice entry bundle. The editor remains a large dependency and loads when the coding workspace opens. Switching practice modes preserves answers and drafts while the workspace stays mounted.

Notes and concurrent content requests are cached for the current browser session; failed requests can retry. SD and GenAI navigation loads when its tab is first opened. Topic lookups use an index, search text is normalized once, and typing is debounced. Shared reader styles load with each note document to prevent a second styling pass.

`npm run check:browser` checks navigation, cached note reuse, both question banks, Java editor loading, GenAI scrolling, Stream snippets, AWS relocation, live search, and mobile layout. Start the dev server first. To check the production build instead, run `npm run build` and `npm run preview`, then set `CODEGROUND_URL` to the preview URL before running the browser check. A local Chrome or Edge installation is required.

## What was combined

249 notes and 354 original files were copied without modifying the four original repos. `migration-manifest.json` records a SHA-256 hash for every imported file. `npm run check` checks imported content against those hashes. Git metadata, dependencies, generated builds, and tool configuration folders were excluded. The full original practice banks are visible in Java Practice Exercises. Five project coding exercises and five project MCQs are separately available from the ReidyAI task board. `public/java-streams.html` supplements Java Code Snippets with 12 explicit interview examples without changing the imported original file.

```text
src/                     Combined navigation, dashboard, and ReidyAI exercises
public/library/interview Original interview notes, assets, and documents
public/library/sd        Original system design content
public/library/genai     Original GenAI content
practice/                Original Java Practice source, scripts, and question banks
scripts/verify.mjs       Migration integrity and exercise checks
```

ReidyAI application code is not included. Its separate property, appraisal, and communication services supply the context for the practice tasks. Framework tasks are carried out in that separate project or a standalone exercise.

The Java editor is bundled locally. **Run Code** retains the original integration with external Judge0, which requires internet access and may impose service limits. It is not a local JVM. Spring integration tasks do not run in the browser, and automated grading is not configured. Optional Google fonts also require internet; system font fallbacks are provided.

This is a local merge for review. Nothing has been published, pushed, or deleted. Git history was not merged. The intended future remote is https://github.com/kalyan-pologi/CodeGround.git.

`scripts/import-sources.cjs` is a one-time migration record with the original machine paths. Do not rerun it after editing imported content: it overwrites the imported copies and their manifest.
