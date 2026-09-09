# Scaffold templates

File bodies the skill writes in step 6. Replace `{{placeholders}}`. Keep each
file lean: `AGENTS.md` is a map, not a manual.

---

## AGENTS.md

```markdown
# AGENTS.md

Guidance for any agent working in this repo.

## What this is

{{one-paragraph: what the project is, who it's for, what "done" looks like.}}

**Read `TASKS.md` first.** It is the live task board and the source of truth for
what is in flight.

## Working norms

{{project-specific norms inferred during the grill. Examples: build/test commands,
where output goes, review gates.}}

User-level and harness-level instructions still apply when present. Put only
project-specific conventions here so a fresh agent can work without access to
the scaffold author's personal configuration.

Everything stays tracked. Commit your work as you go; never leave the tree dirty
or important state uncommitted. `tidy-project` enforces this.

## You are not alone (multi-agent contract)

Assume other agents and the user work this repo at the same time.

- One **main/orchestrator session** runs the show. **Named side-agents** each take
  a focused sub-task in their own context, often on their own branch or git
  worktree.
- **`TASKS.md` is the coordination surface.** Claim a task before working it; mark
  status as you go.
- **Shared files change under you.** Re-read right before editing, keep edits
  narrow, never revert another writer's work.
- If a write is blocked or risks collision, work in a **worktree and merge back**
  (rebase onto moved main, then `git merge --ff-only`).
- Converging a side session back into the main thread closes the loop; the main
  session stays the source of truth.

## Skills (bundled)

Three skills live in `.agents/skills/`; `.claude/skills` is a relative alias to
that directory. Use them in normal work:

- **`capture-to-project`**: when a decision, term, durable fact, or actionable
  item surfaces, run it to file the point into the right doc (`CONTEXT.md`, an
  ADR, `TASKS.md`, `docs/memory/`, or a `research/` note). It commits.
- **`tidy-project`**: occasionally (session start, or after a batch of changes),
  run it to clear junk, fix stale tasks and index drift, then commit. It auto-fixes
  safe items and proposes anything destructive.
- **`recap-project`**: re-entering cold? run it for a read-only "where we are,
  what is next" brief.

## Index: where things live

`AGENTS.md` is the canonical steering file. `CLAUDE.md` imports it for Claude
Code.

- **`AGENTS.md`** (this file): steering instructions and directory map.
- **`TASKS.md`**: task board. Read first, update as you work.
- **`.agents/skills/`**: bundled project skills (capture/tidy/recap).
  `.claude/skills` is a relative alias for Claude Code; neither path points to a
  global installation.
- **`assets/`**: all provided raw inputs (transcripts, images, scripts, the
  originating dump). Tracked in git; provenance lives here.
  - `assets/sources.md`: index of every provided asset.
  - `assets/origin.md`: the originating idea (only if input was a typed prompt
    with no file).
- **`research/`**: working and generated research the agents produce. Not for
  provided source files (those go in `assets/`).
- **`docs/`**: durable docs.
  - `docs/adr/`: architecture decision records (why a hard-to-reverse choice was
    made). _(Created on the first hard-to-reverse trade-off. May not exist yet
    in a fresh scaffold.)_
  - `docs/memory/MEMORY.md`: repo-local memory index. One line per durable fact;
    facts live in sibling files.
- **`CONTEXT.md`**: glossary of the project's canonical terms. Challenge any
  usage that conflicts with it. _(Created on the first term resolved during the
  grill. May not exist yet in a fresh scaffold.)_

{{type-specific entries, e.g. for a presentation: "slides/: the deck".}}

{{If related projects were identified: "## Related projects\n- path/to/sibling: one-line why"}}
```

---

## TASKS.md

```markdown
# {{Project}}: Task Board

`TASKS.md` is the source of truth for what is in flight. Update it as you work.

## Now
_(empty: set the current focus when work starts)_

## Next
_(empty: queue the next items when priorities are clear)_

## Backlog
{{extracted goals as discrete, actionable items}}

## Open questions
{{questions surfaced during the grill that are not yet resolved}}

## Reference
- Origin and sources: `assets/sources.md`
- Glossary: `CONTEXT.md` _(if present; may not exist yet in a fresh scaffold)_
- Decisions: `docs/adr/` _(if present; may not exist yet in a fresh scaffold)_
```

---

## assets/sources.md

```markdown
# Sources: intake index

One row per source fed into this project. Newest first.

| Date | Source | Path | Notes |
|---|---|---|---|
| {{YYYY-MM-DD}} | {{origin: session / notes / artifact}} | {{assets/<file>}} | {{one line}} |
```

---

## assets/origin.md (typed-only idea, no artifact)

```markdown
# Origin

Captured {{YYYY-MM-DD}}. The idea this project was scaffolded from, verbatim.

{{the user's original idea text}}
```

---

## docs/memory/MEMORY.md

```markdown
# Memory Index

Repo-local durable facts. One line per fact; the fact itself lives in a sibling
file in this directory. Format for each file:

    ---
    name: <kebab-slug>
    description: <one-line summary used to judge relevance>
    ---
    <the fact. Link related facts with [[their-name]].>

Add a pointer here when you write a fact: `- [Title](file.md): hook`.

<!-- no facts yet -->
```

---

## .gitignore by project type

These blocks are examples. Include the common block always, then append the
block closest to the declared type. For free-form types with no exact match,
compose from the common block plus the nearest example.

Always include the common block. Append the type-specific block.

### common
```
.DS_Store
*.log
.env
.env.local
.scratch/
tmp/
```

### presentation (Slidev / node)
```
node_modules/
dist/
.slidev/
*.local
```

### software (node)
```
node_modules/
dist/
build/
coverage/
```

### software (python)
```
__pycache__/
*.pyc
.venv/
venv/
.pytest_cache/
dist/
build/
*.egg-info/
```

### research / docs / ops-runbook
```
# (common block is usually enough; add tool-specific dirs as they appear)
```

---

## Type-specific extensions

The fixed core (AGENTS.md, TASKS.md, assets/, docs/, docs/memory/, research/) is
always created. On top of it, add the extension for the declared type. Keep it
minimal: an empty dir with a `.gitkeep`, not a code skeleton. Omit when unsure and
let structure emerge. For a free-form type with no row, compose from the nearest
match or skip.

| Type | Add | AGENTS.md index entry |
|---|---|---|
| software | `src/`, `tests/` | "src/: source. tests/: tests." |
| presentation | `slides/` | "slides/: the deck." |
| research | (none beyond core) | research/ already covers it |
| docs | (none beyond core) | docs/ already covers it |
| ops-runbook | `runbooks/` | "runbooks/: the procedures." |
| library | `src/`, `tests/`, `examples/` | "src/, tests/, examples/." |
| data-analysis | `data/`, `notebooks/` | "data/: inputs. notebooks/: analysis." |
