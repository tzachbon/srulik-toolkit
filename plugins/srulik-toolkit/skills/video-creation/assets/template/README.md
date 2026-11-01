# Product video starter

Copy this folder into your project, then edit the scenes. It renders an 18 s placeholder
video (1920x1080, H.264 and AAC) before you change anything.

## Needs

- Node 20 or later and ffmpeg with ffprobe on `PATH`.
- `playwright-core` with a matching Chromium (`npx playwright install chromium`). Set
  `PLAYWRIGHT_CORE` to its folder when it is not resolvable from here.

## Build

```sh
./build.sh
```

This writes `out/video.mp4`, `out/poster.png` and `out/contact-sheet.png`. While editing,
render single frames instead: `node render.mjs --stills 2,8`.

## Capture real footage

Edit `record-example.mjs` for your app and flow, then run `node record-example.mjs`. It
writes `capture/example/` (frames and `meta.js`), and the demo scene plays it in place of
the placeholder. The demo scene's length now follows the capture, so copy the scene starts
that `render.mjs` prints into the `T` map in `music.mjs`, then re-run `./build.sh`.

## Files

| File | Job |
| --- | --- |
| `index.html` | One `section.scene` per scene on a 1920x1080 stage. Brand tokens are CSS variables at the top |
| `timeline.js` | `SCENES` with durations, `window.seek(t)`, and the helpers `appear`, `draw`, `clip`, `frameCard`, `camera` |
| `render.mjs` | Seeks each frame at 30 fps, screenshots it, encodes with ffmpeg, writes the poster or `--stills` |
| `capture-lib.mjs` | The capture session: drawn cursor, eased moves, frame loop with timestamps, named marks |
| `record-example.mjs` | One capture flow. Aborts writes, answers event posts with 204, blurs private fields |
| `music.mjs` | Original synthesized music. Update its `T` map to the scene starts `render.mjs` prints |
| `contact-sheet.mjs` | One frame every 5 s in a grid, for review |
| `build.sh` | Render, music, mux, contact sheet |

Put brand fonts and the logo in an `assets/` folder you add; none ship here.
