# Workflow for this live layout project

These instructions record the user's requested working/reference workflow.

At the start of each new user request about this project, before changing implementation files:

1. Run `npm run begin-prompt`. This copies the current working renderer into the reference snapshot and starts a fresh activity session. Do this once per new request, not again for a clarification that arrives during the same request.
2. Keep the reference renderer fixed for the rest of that request. Edit the working files only. Both versions must receive the same current activity feed.
3. Publish visible progress messages and factual tool activity as work happens. Run `node scripts/activity.mjs` with a JSON object on stdin containing `kind` (`tool` or `progress`), `title`, and `summary`. Tool actions are section titles; the corresponding public progress update or concise result is the paragraph content. Use safe shell quoting or pass the JSON through a file.
4. Publish real updates only. Do not add timer-generated filler, rotating sample notes, invented tool actions, or private internal reasoning. This is a manually published public activity feed, not an automatic mirror of hidden model analysis or the Codex UI.
5. Leave both sites available: working at `http://127.0.0.1:4173/`, reference at `http://127.0.0.1:4174/`.

Keep the white canvas at 1920 × 1080, its underlying 12-column / 5-row layout, 24 px inset and 16 px gaps. Use local TWK Lausanne only, three sizes of 14, 32, and 128 px and two weights (400/600). The guide overlays and divider rules are removed. Newest three sections guide placement; more than four text-overlap regions triggers immediate removal of older involved sections. No appearance/disappearance transitions.

Compose the latest three sections with balanced visual weight. Favor optically centered solo sections, opposing left/right or top/bottom pairs, opposite corners, and a dominant section counterbalanced by two smaller sections. Reconsider the current group's positions when content arrives; do not return to arbitrary empty-cell placement. Use rendered text measurements to account for different title sizes and paragraph lengths.
