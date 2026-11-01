---
name: video-creation
description: Build a product, demo, feature, walkthrough, launch, or PM video from code. Use when the user wants a video that shows a product or feature working. Captures real footage without changing data, builds scenes in one HTML page rendered frame by frame, adds original synthesized music timed to the cuts, and reviews a contact sheet. For a single diagram or still visual, use `show-me`.
---

# Video creation

The video is a web page that can be frozen at any time `t`. A script steps `t` frame by
frame, screenshots each frame, and ffmpeg joins them, so every rebuild is identical and
no video editor is needed.

Copy the [starter template](assets/template/README.md) into the user's project; never
edit the bundled copy. It needs Node, ffmpeg, and `playwright-core` with Chromium. If one
is missing, name it and stop before capture. Read [pipeline detail](references/pipeline.md)
for each step and [match the brand](references/brand-feel.md) for the look.

## Steps

1. **Story.** Write the scene list before code: one job and a duration per scene.
   Write a source for every on-screen number; a number without a source stays off
   screen. Edit on-screen copy with `stop-slop`.
2. **Safe capture.** Drive the real app with browser automation and save a screenshot
   loop with per-frame timestamps and named marks. The capture changes no data: abort
   every request that is not a read, answer event and analytics posts locally, cancel
   dialogs instead of confirming them, and blur people's names and customer data. Ask
   the user for sign-in state; read secrets from the environment and never print them.
3. **Scenes.** One scene section per scene on a 1920x1080 stage. Take fonts, palette,
   logo, type scale, margins and motion from the brand's own sources as tokens.
4. **Timeline.** Scene durations compute the start times. `seek(t)` sets every element
   from time alone, with no CSS transitions or timers. Key footage cuts to named marks,
   not seconds.
5. **Stills while editing.** Render and inspect single frames before a full render.
6. **Render.** 30 fps, H.264 in `yuv420p` with faststart, plus a poster frame.
7. **Music timed to cuts.** Synthesize an original bed whose bar lines land on the
   scene cuts, from the rendered duration. Update the cut map after any timing change.
8. **Mux.** Add the music as AAC, trimmed to the video.
9. **Contact sheet review.** Check a frame every 5 s for pacing and broken frames, watch
   once with sound, and check every number and quote against its source. Show the
   user the contact sheet and stills before calling the video done.

## Trust rules

- **Real footage only.** Never mock up a screen that does not exist.
- **Verbatim quotes.** Quoted text matches its source word for word; trims are marked.
- **Sourced numbers.** Every number on screen has a written source.
- **Capture changes no data.** A take that wrote real data is discarded and reported.
- **Original music only.** No samples or third-party tracks. Use brand fonts and logos
  only with the user's right to use them, and keep them out of shared repositories.

## Handoffs

- A single diagram, still, or slide: `show-me`.
- On-screen copy, titles, and captions: `stop-slop`.
- A UI defect seen in the footage, or a flow to review before filming: `ui-ux-review`.

## Completion evidence

Report the video path and duration, the `ffprobe` streams (`h264` and `aac` at
1920x1080), the contact sheet path, the number-to-source table, the capture's
blocked-request log, and anything unverified.
