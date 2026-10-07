# Loading in Layout

A local typographic canvas that turns published progress updates and tool results into balanced, evolving compositions. Built with HTML, CSS, JavaScript, and Node.js, without third-party dependencies.

## Setup

Use Node.js 22 or later. Clone the repository and add your own Neue Haas Grotesk Display font files before starting:

```sh
git clone https://github.com/Bruce699/loading-in-layout.git
cd loading-in-layout
```

Place `NeueHaasGroteskDisplay-Regular.ttf` in `assets/fonts/`. These required font binaries are not bundled; missing fonts leave the canvas uninitialized.

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

The pure-white canvas is 1920 × 1080 CSS pixels. Fit scales the entire canvas; 100% shows its original size with scrolling. The invisible grid has twelve Stretch columns with automatic widths, five rows, 40 px padding and 20 px gutters. Grid guides and general section rules are hidden. Transparent-background images use a `.transparent-image` wrapper with 24 px top/bottom padding and 1 px horizontal rules above and below.

Tool actions become headings, and public summaries become paragraph content. Neue Haas Grotesk Display uses 55 Regular (400) for titles, body copy, and captions, with 14 px captions, 18 px body copy, and 32/128 px titles. Only the newest three sections influence new placement. Older sections remain as traces until there are more than four text-overlap areas; the oldest involved traces then disappear immediately until the count is at most four. No fades or transitions.

The working renderer recomposes its active group using the rendered text's size, weight and position. Solo sections are optically centered. Pairs use opposing sides, top/bottom or opposite corners. Three sections use one dominant block counterbalanced by a pair. Placement favors balanced visual weight and clear spacing; layout changes happen in one frame. The reference keeps the placement rules saved at the start of the current request.

`npm test` runs the geometry and activity/snapshot checks. Activity history, generated snapshots, preview images, and font binaries are excluded from Git.

## Run a bounded live test

`node scripts/exercise-layout.mjs` executes 24 harmless local functions in a randomized order, publishing their actual results every 2.5 seconds. Entries are labeled **Test activity**. The run finishes in about a minute and schedules nothing afterward. It appends to the current shared session; run `npm run begin-prompt` first only when starting a new prompt or deliberately resetting the comparison.

Pass a count to change the run length: `node scripts/exercise-layout.mjs 48` runs for about two minutes at the same pace.

## Photo and typography stress test

Run `node scripts/exercise-media.mjs` for 24 labeled local test events using all eight original JPEGs in `example/`. The run cycles through one, two, and three paragraphs at 2.4-second intervals, finishes automatically, and only reads the original photos. Image events include `image: { src, alt, width, height }`; `src` must be a JPEG directly inside `/example/`. The renderer reserves image dimensions before layout, preserves aspect ratio, and includes images in collision and visual-weight measurements. The reference snapshot keeps its previous rendering behavior.

## Live demo reel

Run `node scripts/demo-reel.mjs` to show 24 explicitly labeled demo scenes with all eight photos, short editorial sample copy, and varied 1.2–3.2 second cuts. It finishes in about 52 seconds and leaves the final composition visible. It appends to the current feed and does not edit the original photos or reset the reference snapshot.

Occasional oversized question beats use `presentation: "overtext"` on an activity event. Supply a short title with an optional newline (two lines maximum). The foreground text intentionally crops at the canvas edges and clears on the next event. The demo reel includes two 4.2-second example question beats; these are visual samples, not approval requests.

`exports/rapid-layouts-10s.mp4` is a directly rendered 1920×1080, 30 fps, silent ten-second motion study (not a browser recording). Its six compositions cut at 0, 1.4, 2.9, 4.5, 6.2, and 8 seconds. `scripts/render-rapid-demo.swift` preserves full text geometry while revealing graphemes at varied speeds, sequencing titles before body copy, with overlapping photo and oversized-type compositions.

Latest edit: `exports/rapid-layouts-type-third-10s.mp4`. Exactly 100 of 300 frames (one third) are typography only: frames 0–39 and 180–239. The remaining four scenes retain photos and overlapping compositions. Total duration stays ten seconds with six layouts and varied typewriter reveal.

## Demo-derived live presentations

The user's eight-scene demo is documented in [DEMO-LAYOUTS.md](DEMO-LAYOUTS.md), with small reference stills, source timings, and rules for applying it to real content. Four additional explicit `presentation` values are available: `staggered`, `photo-stack`, `type-echo`, and `photo-hero`. Existing `overtext`, `editorial`, and real tool-status rings complete the scene vocabulary. Photo modes use recent published images; they fall back to typography when no image exists. Long copy falls back to ordinary measured layout. No automatic demo content enters the live feed.

Generated movies, original demo photos, and large frame exports remain local; source renderers and compact reference images are included. See [example/README.md](example/README.md) for photo sources and install the expected image files before running a demo. Demo renderers require macOS with Swift/AppKit/AVFoundation and your locally installed font. The browser app itself needs only Node.js 22+ and the font.

If a user asks to preserve the canvas, skip `begin-prompt` and append activity directly. For an explicitly requested reference refresh without a reset, `node scripts/begin-prompt.mjs --preserve-activity` retains the feed.
