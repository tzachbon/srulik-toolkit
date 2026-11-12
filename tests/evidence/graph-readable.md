# Readable graph output: verification evidence

Plugin version: 1.27.0. Base: 064fb0f. Issue: #95.

## What was checked

- **Contract (C39, `scripts/test-graph-view.js`).** It runs `scripts/graph/render.js` in `vm` against a minimal DOM and compares the element tree:
  - JSON becomes labelled rows, and a multi-line string inside it renders as Markdown.
  - Markdown headings, tables and fences become text nodes.
  - Only `http(s)` links become anchors.
  - The served page inlines `render.js`.
- **Red proof.** Widening the link pattern to accept `javascript:` makes C39 fail. Restoring it passes.
- **Real browser.** I ran `graph-readable/browser-check.mjs` (Playwright, headless Chromium) against `node scripts/graph.js view` serving a fixture run. The fixture has one node: a JSON output whose `notes` holds Markdown, plus a `notes.md` attachment. All 14 checks passed:
  - rows and values
  - heading, list with code and bold, table
  - the http link, and the `javascript:` link left as text
  - Raw collapsed by default, and showing JSON when expanded
  - attachment Markdown
  - Run index table
  - dark theme contrast
  - no horizontal overflow at 390 px
  - no console errors
- `./scripts/validate.sh` passes.

## Screenshots

| | |
| --- | --- |
| Output and Raw, light | ![](graph-readable/panel-light.png) |
| Attachment Markdown | ![](graph-readable/panel-attachment.png) |
| Dark theme | ![](graph-readable/panel-dark.png) |
| Phone width (390 px) | ![](graph-readable/panel-phone.png) |
| Run index | ![](graph-readable/index.png) |

## Not covered

- Nested Markdown lists render flat.
- There is no syntax highlighting.
- I tested only Chromium.
