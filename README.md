# Loading in Layout

A local typographic canvas that turns published progress updates and tool results into balanced, evolving compositions. Built with HTML, CSS, JavaScript, and Node.js, without third-party dependencies.

## Setup

Use Node.js 22 or later. Clone the repository and add your own TWK Lausanne font files before starting:

```sh
git clone https://github.com/Bruce699/loading-in-layout.git
cd loading-in-layout
```

Place `TWKLausanne-400.otf` and `TWKLausanne-600.otf` in `assets/fonts/`. These required font binaries are not bundled; missing fonts leave the canvas uninitialized.

```sh
npm run begin-prompt
npm run dev
```

No dependency installation or build step is required. `begin-prompt` creates the local activity session and reference snapshot. One local process then hosts two versions:

- Working: http://127.0.0.1:4173/ — current renderer files, reloaded when edited.
- Reference: http://127.0.0.1:4174/ — a saved renderer snapshot, unaffected by working-file changes.

Both render the same current public activity feed. The reference is static in its layout code, not in the content it receives.

## Each new prompt

Run `npm run begin-prompt` before making implementation changes. This copies `index.html`, `styles.css`, `app.js`, and `layout-engine.js` from the working version to the reference, then starts a fresh activity session. Keep that reference snapshot fixed until the next prompt. This is an explicit agent workflow, recorded in `AGENTS.md`; the server cannot detect chat prompts by itself.

Publish an actual tool action and its public progress/result summary with:

```sh
node scripts/activity.mjs <<'JSON'
{"kind":"tool","title":"Read project files","summary":"The visible progress update or a concise factual result goes here."}
JSON
```

This app displays deliberately published public activity. It has no access to private model analysis or the Codex UI's internal event stream. It generates no filler and has no automatic text timer. Every event has a stable ID, and both versions receive the same history after reconnecting.

## Layout

The pure-white canvas is 1920 × 1080 CSS pixels. Fit scales the entire canvas; 100% shows its original size with scrolling. The invisible grid has twelve columns, five rows, 24 px padding and 16 px gaps. Grid guides and section rules are removed.

Tool actions become headings, and public summaries become paragraph content. TWK Lausanne uses weights 400/600 and sizes 14/32/128 px. Only the newest three sections influence new placement. Older sections remain as traces until there are more than four text-overlap areas; the oldest involved traces then disappear immediately until the count is at most four. No fades or transitions.

The working renderer recomposes its active group using the rendered text's size, weight and position. Solo sections are optically centered. Pairs use opposing sides, top/bottom or opposite corners. Three sections use one dominant block counterbalanced by a pair. Placement favors balanced visual weight and clear spacing; layout changes happen in one frame. The reference keeps the placement rules saved at the start of the current request.

`npm test` runs the geometry and activity/snapshot checks. Activity history, generated snapshots, preview images, and font binaries are excluded from Git.

## Run a bounded live test

`node scripts/exercise-layout.mjs` executes 24 harmless local functions in a randomized order, publishing their actual results every 2.5 seconds. Entries are labeled **Test activity**. The run finishes in about a minute and schedules nothing afterward. It appends to the current shared session; run `npm run begin-prompt` first only when starting a new prompt or deliberately resetting the comparison.

Pass a count to change the run length: `node scripts/exercise-layout.mjs 48` runs for about two minutes at the same pace.
