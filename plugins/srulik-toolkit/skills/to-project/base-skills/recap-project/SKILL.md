---
name: recap-project
description: Use when re-entering a project cold and you need fast orientation on where things stand and what to do next. Triggers include "recap", "catch me up on this project", "where are we", or starting a fresh session on an existing project.
---

# recap-project

Read-only orientation. Pull the project's steering, board, recent history, and
glossary, then print a short brief. Write nothing.

**Core principle:** answer two questions in under a screen, "where are we" and
"what is next", from what the repo already records. No exploration beyond the
files below unless they point you somewhere.

## Read (in order)
1. `AGENTS.md` — what the project is, its norms, the directory map.
2. `TASKS.md` — Now, Next, then open questions. This is the source of truth for
   what is in flight.
3. Recent git history — `git log --oneline -15` and `git status` for uncommitted
   work in progress.
4. `CONTEXT.md` — the canonical terms, so you speak the project's language.

## Print
A brief, in this shape:
- **What this is** — one line.
- **Where we are** — current focus (TASKS Now), recent commits in plain words.
- **What is next** — TASKS Next, plus any uncommitted WIP that needs landing.
- **Open questions** — unresolved decisions that may block progress.

Keep it tight. Cite files by path so the reader can jump in. If `TASKS.md` Now and
Next are both empty, say the project is idle and surface the top Backlog items
instead.

## Do not
- Write or commit anything. This skill only reads.
- Re-derive what the docs already state. Report them, do not reinvestigate.
