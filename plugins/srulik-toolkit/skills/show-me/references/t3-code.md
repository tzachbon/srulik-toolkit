# show-me on T3 Code

T3 Code is an inline-HTML host: every visual shown in a chat reply (`show-me`, `recap`, and `tour`'s chat visual) is rendered inline above the reply via `html_preview` followed by `html_render`. Visuals written into files (plans, PR bodies, `tour`'s temporary Markdown file) stay Markdown.

## Capability mapping

| Capability | T3 Code |
| --- | --- |
| Preview and measure inline HTML | `html_preview` (returns PNG, `contentHeight`, console output; supports `appearance: "dark" \| "light"` and `width`, default 728px desktop / ~390px phone) |
| Display inline HTML in thread | `html_render` (`title`, `height` in `80..2000` CSS px taken from `html_preview`'s `contentHeight`, and inline `html` or absolute `path`) |
| Prohibited display paths | Never start a local HTTP/viewer server; never use `preview_*` tools to display visuals or results; never claim an on-disk screenshot displays the visual |

## Frame and theme rules

1. **Preview before rendering:** Always run `html_preview` first, inspect the rendered PNG and console output (require zero console errors and rendered SVG rather than raw Mermaid source), and pass the reported `contentHeight` (clamped to `80..2000` px) to `html_render`. Write the page once to a collision-safe temporary file and pass that same absolute `path` to both calls rather than sending the HTML inline twice.
2. **Transparent outer surface:** Leave `html`, `body`, and the outer wrapper with no background color, no outer card, no outer border, no banner title, and no side padding. T3 Code renders the frame directly on the thread background with an overridable 8px `html` gutter.
3. **No viewport-height loops:** Never use `vh` units or `height: 100%` on `html` or `body` (rejected or causes resize loops). Give charts fixed pixel heights and let content determine total height.
4. **Use `:root` theme CSS variables:** Style text, surfaces, borders, links, and diagrams with T3's `:root` variables instead of hardcoded colors: `--background`, `--foreground`, `--muted`, `--card`, `--popover`, `--secondary`, `--border`, `--ring`, `--primary`, `--accent`, `--destructive`, `--warning`, `--success`, `--info`, `--code-background` (and their `-foreground` / `-surface` counterparts), `--chart-1` through `--chart-6`, `--radius`, `--font-sans`, and `--font-mono`. Any inner box that needs its own background gets `16px` padding and `var(--radius)` corners.
5. **Mermaid in T3's render frame:** Load the classic pinned SRI build (`mermaid@12.3.0/dist/mermaid.min.js`) with `securityLevel: "antiscript"`, `theme` derived from `prefers-color-scheme: dark`, and `mermaid.run()` — never the ESM module build (`mermaid.esm.min.mjs`).
6. **Reply placement:** `html_render` appears inline above the final reply. Do not announce or restate the rendered visual in prose; for `recap`, open the reply text directly with **Goal**.

## Observed live

Probed live in T3 Code `html_preview` on 2026-11-24:
- `<script type="module">import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@12.3.0/dist/mermaid.esm.min.mjs"` never resolved inside the render frame (raw Mermaid source remained visible).
- Classic `<script src="https://cdn.jsdelivr.net/npm/mermaid@12.3.0/dist/mermaid.min.js" integrity="sha384-HHW54r639fK42Ip0coGF3mz8oSiGn0eEoWNTLs75X7H63pLSDBa0Tqs0RwGmLlXE" crossorigin="anonymous"></script>` + `mermaid.initialize({ startOnLoad: false, securityLevel: "antiscript", theme })` + `mermaid.run()` loaded from jsdelivr (HTTP 200, ~245 ms, no CSP block), rendered SVG cleanly, produced `<a xlink:href>` links for `flowchart` `click ... href` (antiscript drops `target="_blank"`, so the snippet sets `target` and `rel` after `mermaid.run()`), and rendered native `<details>` groups.
- End-to-end recap page rendering on T3 Code (`html_preview` + `html_render`) is verified in `tests/evidence/recap-visual.md`. Other hosts are unverified here and remain governed by `show-me`'s non-inline-HTML branches.
