# EXTEND.md — extend an existing project

Loaded when `to-project` runs in extend mode: folding new input into a project
that already exists. Triggered by an explicit "extend / add to / continue"
intent, or a target path that already holds a project (`AGENTS.md` or `.git`).
Accepts one or more new sources.

## Concurrency first

Another session may be extending the same project at the same time. Decide the
isolation before writing:

- **If concurrent extends may be live**: work in a git worktree or branch off
  main, run the whole procedure there, then merge back, rebase onto the moved
  main, resolve additively, `git merge --ff-only`.
- **If you are the only session touching the project**: edit main directly.

This is the project's own multi-agent contract (see its `AGENTS.md`) applied to
extend. Only the operator knows whether parallel extends are live, so when in
doubt, isolate.

## Procedure

### 1. Orient
Read only the existing contract: `AGENTS.md`, `CONTEXT.md`, `TASKS.md`,
`assets/sources.md`, and the ADR titles under `docs/adr/`. Load the current
model. Do not read the whole repo.

### 2. Grill the delta
Grill the user one question at a time, recommended answer each, on only what the
new input adds or contradicts relative to the loaded model. The existing docs
answer the rest, let them shorten the grill. This is the deliberate inverse of
new mode, where the grill is always full. Write decisions live as they settle:
new or refined terms to `CONTEXT.md`, new hard-to-reverse trade-offs to a new ADR
(formats: CONTEXT-FORMAT.md, ADR-FORMAT.md).

### 3. Apply — append and refine, never clobber
- **`CONTEXT.md`**: append new terms. A term the grill re-settles is updated in
  place, never duplicated.
- **`TASKS.md`**: new goals to Backlog, new questions to Open Questions, strike
  resolved ones. Leave **Now** and **Next** untouched, that is the operator's
  live working state.
- **`docs/adr/`**: a new decision gets the next sequential number. Never rewrite
  an existing ADR, a reversal is a new ADR that supersedes the old one.
- **`assets/` + `sources.md`**: copy each new source in with a dated name, append
  a row to `sources.md`. ADR and CONTEXT entries derived from it cite it.
- **`AGENTS.md`**: update "what this is" or the index only if the project's shape
  changed (a new type-dir, a new related project). Otherwise leave it.
- **Base skills**: if `.agents/skills/` is missing any of `capture-to-project`,
  `tidy-project`, `recap-project` (an older project predating them), copy them
  from to-project's `base-skills/`, stamp `installed`/`source`, ensure
  `.claude/skills` is a relative alias to `../.agents/skills`, and add the Skills
  section to `AGENTS.md`. Do not link to a global or source installation. Skip
  cleanly when already present.
- **memory index** (`docs/memory/MEMORY.md`): append a pointer for any durable
  fact that emerged.

### 4. Commit
Always commit. `git add` only the paths you touched, not `-A`, so unrelated
in-progress work is left alone and the commit reads as a clean unit. Message:
`Extend: <source(s)>`. No AI attribution.

### 5. Tour the changes
After the commit, walk the load-bearing edits in order and flag anything risky or
worth a second look: a new term that narrows an older one, a struck task, the new
ADR. A short narrated walkthrough, not a raw diff. This is the review surface,
git history is the undo.

## Conflict resolution (at merge-back)

Most conflicts are additive and cheap to resolve:
- New ADRs are new files, they never conflict.
- `sources.md`, the `CONTEXT.md` term list, and the `TASKS.md` backlog are append
  regions, keep both sides.
- The only real conflict is two sessions rewording the same existing term
  differently. Keep the sharper definition or merge both into one, and note it.
