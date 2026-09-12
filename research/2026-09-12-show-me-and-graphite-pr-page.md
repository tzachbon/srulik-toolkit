# HumanLayer `show-me` provenance and Graphite PR-page hierarchy

## Conclusion

The planned import has a precise upstream source: HumanLayer's `show-me` skill at commit `3c2629142c5d437428269b1b722b08c0b87f574d`. The pinned file declares the skill name `show-me`, describes concise visual explanations, and directs the agent to choose the smallest useful representation. It offers pseudocode, call trees, component and file trees, Mermaid, diffs, code blocks, and a focused HTML artifact as progressively richer options ([pinned `SKILL.md`](https://github.com/humanlayer/skills/blob/3c2629142c5d437428269b1b722b08c0b87f574d/plugins/show-me/skills/show-me/SKILL.md)).

HumanLayer distributes that source under MIT. A redistributed copy must retain the copyright and permission notice; keeping the pinned root license beside the copied skill satisfies the license's stated notice condition ([pinned license](https://github.com/humanlayer/skills/blob/3c2629142c5d437428269b1b722b08c0b87f574d/LICENSE)).

Graphite's first-party PR-page presentation supports only a narrow design inference for `$tour`: lead with a compact status-and-context overview, then expose detailed evidence and actions. It does not establish a historical-tour format and should not be treated as source material for Graphite branding, copy, or visual styling ([Graphite PR page](https://graphite.com/features/pr-page)).

## Pinned HumanLayer source

The exact raw source URLs are:

- [`show-me/SKILL.md`](https://raw.githubusercontent.com/humanlayer/skills/3c2629142c5d437428269b1b722b08c0b87f574d/plugins/show-me/skills/show-me/SKILL.md)
- [repository `LICENSE`](https://raw.githubusercontent.com/humanlayer/skills/3c2629142c5d437428269b1b722b08c0b87f574d/LICENSE)

Local retrieval on 2026-09-12 produced these fingerprints:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `SKILL.md` | 3,297 | `bea6da70a58096730b9aeb0bae293ddf4726103a98efc9ce13c481619942a810` |
| `LICENSE` | 1,067 | `5f13c18ea00ea5c1384f41745feeca774079164f7f59a92e4ac0899ad217b26f` |

These hashes provide a byte-for-byte acceptance check for the vendored files. The skill's frontmatter is:

```yaml
---
name: show-me
description: Help the user understand the current topic visually with concise diagrams, code-shape sketches, and focused HTML artifacts.
---
```

The behavioral invariant is explicit: skip preamble, keep prose brief, and choose the smallest view that makes the key point clear. The file then supplies concrete shapes for logic, runtime flow, UI structure, file responsibility, interaction/data flow, changes, copyable code, and dense visual concepts. Its closing guidance says to place visuals beside their supporting text, include only information needed for the current question, and avoid overwhelming the user ([pinned `SKILL.md`](https://github.com/humanlayer/skills/blob/3c2629142c5d437428269b1b722b08c0b87f574d/plugins/show-me/skills/show-me/SKILL.md)).

One portability issue is part of the verbatim source: the HTML example says `Bash(open path/to/show-me-{description}.html)`. Because the implementation plan requires an exact copy, this should remain unchanged in the imported file; portability behavior can be handled by `$tour` choosing inline Mermaid or text when appropriate, not by altering the attributed source.

## License requirements

The pinned license states `MIT License` and `Copyright (c) 2026 HumanLayer`. It grants use, copying, modification, publication, distribution, sublicensing, and sale, conditioned on including the copyright and permission notice in copies or substantial portions. It also contains the standard warranty and liability disclaimer ([pinned license](https://github.com/humanlayer/skills/blob/3c2629142c5d437428269b1b722b08c0b87f574d/LICENSE)).

Implementation consequences:

1. Copy the pinned license verbatim to `plugins/srulik-toolkit/skills/show-me/LICENSE`.
2. Preserve `Copyright (c) 2026 HumanLayer`.
3. Record the upstream repository, pinned commit, copied path, and retained local license path in `NOTICE.md` for auditable provenance.
4. Compare the vendored files against the hashes above after copying.

## Graphite information hierarchy

Graphite introduces the page as “Focused. Fast. Powerful.” and later names its primary hierarchy “Everything you need, at a glance.” The first-party page says the focused layout surfaces PR status, checks, reviewers, and key details where needed ([Graphite PR page](https://graphite.com/features/pr-page)). Its illustrated page presents information in this practical order:

1. PR identity and compact metadata: title, author, branch direction, files changed, additions/deletions, update time, and stack position.
2. Description with an initial summary and a short list of included changes.
3. Discussion and the continuous file diff, with comments located beside the relevant lines.
4. A context-aware action/status area covering review actions, merge state, blockers, checks, reviewers, labels, and assignees.
5. Optional assistance embedded in context: Graphite Chat for explanations, fixes, and failed checks.

Graphite separately highlights action cards that expose blockers, rich text for clear descriptions and comments, built-in AI assistance, and one uninterrupted diff view ([Graphite PR page](https://graphite.com/features/pr-page)). The implementation-relevant abstraction is therefore:

```text
at-a-glance orientation
  -> central narrative or change summary
  -> detailed evidence in context
  -> present status, blockers, and next actions
  -> deeper supporting material
```

For `$tour`, this supports putting `At a glance` first, keeping the focused visual adjacent to the point it explains, and leaving citations and deeper evidence available in the full artifact. The rest of the planned historical structure—origin, chronology, current flow, tradeoffs, uncertainty, and references—comes from the `$tour` requirements, not from a claim that Graphite uses those chapters.

## Implementation checklist

- Vendor the two pinned HumanLayer files exactly and verify their SHA-256 hashes.
- Do not rewrite `show-me` to resolve the platform-specific `Bash(open ...)` example; exact attribution and copying take precedence.
- Make `$tour` ask `$show-me` for the smallest useful visual rather than defaulting to HTML.
- Borrow Graphite's progressive disclosure only: summary first, evidence and state after it.
- Do not copy Graphite wording, branding, components, or PR-specific behavior.
