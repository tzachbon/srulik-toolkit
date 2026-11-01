# Match the brand

Read this when choosing the look of a video. Take every value from the brand's own public
sources: its website, design system, brand guidelines or press kit, and the product UI
itself. Never invent a brand value. Brand fonts and logos stay in the user's project, added
by the user with the right to use them; none ship with this skill. When a source is
missing, keep the template's neutral tokens and say which value is unsourced.

## Tokens

- **Fonts:** a display face for headlines and a text face for everything else, both from
  the brand's site or design system, loaded with `@font-face` from local files. Use
  weights 400, 500 and 700 only. Fall back to `system-ui`.
- **Palette:** one background, one ink, one muted ink for labels and footnotes, one rule
  gray, and **one accent**. Use the accent only for the punchline line, the key number and
  the active step. If the brand has several accents, pick one per video.
- **Logo:** the official file in the version that contrasts with the background. On
  content scenes, place it bottom right at the safe margin, about 240 px wide at 1920.
  Keep the clear space the guidelines ask for, or at least the logo's own height. The
  end card shows the logo or lockup alone, centered.

Put these in the CSS variables at the top of `index.html`.

## Type scale at 1920x1080

| Role | Size / line height | Weight |
| --- | --- | --- |
| Hero line | 136 / 136 | 700, -0.01em |
| Headline | 88 / 96 | 700 |
| Payoff line | 72 / 80 | 700, accent |
| Step title | 52 / 56 | 700 |
| Body | 36-40 / 48 | 400 |
| Label | 32 / 40 | 500, muted |
| Footnote | 24 / 32 | 400, muted |
| Stat number | 240 / 232 | 700, -0.02em |

Scale these by the brand's own ratio when its design system defines one.

## Layout

- **Safe margin** of 96 px on every side (5% of the width). Nothing but full-bleed
  footage crosses it.
- A label sits top left at the margin, the headline below it, a footnote at the bottom
  margin.
- Grid: two halves (columns at 96 and 1008 px) or three 528 px columns with 72 px gutters
  (96, 696 and 1296 px). Text is left aligned.
- Lists are numbered rows (01, 02, ...) separated by 1 px rules.

## Footage framing

- Capture at 1440x900 with a device scale factor of 2, so zooming stays sharp.
- Show footage inside a card: 32 px radius, 1 px outline in the rule color, black behind.
- **Zoom into the region that matters** with a camera move between named regions
  (`frameCard` and `camera` in the template) instead of showing a whole page small.
- Put the explanation in a text rail beside the card, never over the footage.
- A footnote says what is real, for example "Real footage. Waiting time shortened."

## Motion vocabulary

- Entrances fade in and **rise 24 px** (32 px for headlines) with a **cubic ease-out**
  over 0.7 to 0.8 s.
- **Stagger** related elements by 0.2 to 0.6 s, in reading order.
- Rules **draw** from the left with an ease-in-out over 0.8 s.
- Camera moves ease in and out over 0.9 to 1.3 s.
- Scenes fade in over 0.5 s and out over 1.0 s.
- **No bounce**, spin, overshoot or slide-in from off screen, and no move faster than 0.4 s.

## Pacing and structure

One idea per scene. Each piece of text must be **readable in about 2 s**: hold text
about one second per 11 words, at least 0.8 s. Aim for 60 to 120 s in total.

| Scene | Job | Length |
| --- | --- | --- |
| Title | Product name and one line | 4 to 5 s |
| Problem | What hurts today, as numbered rows | 6 to 9 s |
| Demo | The main flow in real footage | 20 to 30 s |
| Second demo | Another surface, such as the admin side | 15 to 30 s |
| Stat | One or two measured numbers with their source | 5 to 7 s |
| How it works | Three columns or a simple diagram | 6 to 8 s |
| Next steps | The ask or the plan | 6 to 8 s |
| End | Logo alone | 3 to 5 s |

Drop scenes the story does not need. The template ships title, demo, stat and end.

## Music as a supporting bed

The music supports the pictures and never competes with them. No vocals and no
recognizable melodies. Layers build with the sections, one accent lands on the cut into
the main demo, and a held chord resolves under the end card. Normalize the peak to about
-1 dBFS; around -16 LUFS integrated suits a shared video.

## Check

Put a still next to a page of the brand's site. The fonts, accent, spacing and logo
clear space should match. Fix the tokens, not individual scenes.
