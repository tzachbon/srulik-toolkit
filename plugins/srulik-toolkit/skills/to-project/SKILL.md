---
name: to-project
description: Use when the user wants to turn an idea, a notes dump, or a session transcript into a complete agent-ready local project, or to fold new input into a project that already exists. Triggers include "turn this into a project", "scaffold a project from this", "make a project out of this session/these notes", "set up a new repo for this", "extend an existing project with this", "add this to my project", "continue the project from these notes".
---

# to-project

Turn raw input (an idea, notes, or a whole session) into a complete, agent-ready
local project: git repo, `AGENTS.md`, `TASKS.md`, docs, research intake, a
glossary, and a memory index. The grill is the engine. You interview the user to
shared understanding, and the project's docs crystallise live during that
interview.

**Core principle:** a folder is not a project. A project is a *contract* other
agents can pick up cold: where to look first (`TASKS.md`), how not to collide
(the multi-agent norms), and why it exists (provenance + `CONTEXT.md`).

## Workflow

Run in order. The skill stays in the main session because the grill is an
interview, it cannot be delegated.

**Pick the mode first.** If the input targets an existing project (an explicit
"extend / add to / continue" intent, or a target path that already holds a
project: `AGENTS.md` or `.git`), this is an **extend** run, follow EXTEND.md
instead of the steps below. Otherwise it is a **new** run, continue here. Both
modes accept one or more sources.

### 1. Ingest
Accept whatever the user has: a one-line idea, a pasted artifact, a path to
notes, or this session's transcript. Read it fully before asking anything.

### 2. Infer and confirm the frame
From the input, infer:
- **Project type**: derive a best-guess from the input and present it as the
  prefilled answer. Then prompt the user: "Type X (software / presentation /
  research / docs / ops-runbook / library / data-analysis, or anything else).
  Path Y. Go, or correct?" Accept any free-form type; the declared type drives
  `.gitignore` composition and type-specific dirs.
- **Target path**: default `~/projects/<slug>`, slug derived from the input.

One prompt, one line, then proceed.

### 3. Create the repo
Before creating: if the target path already holds a project (`AGENTS.md` or
`.git`), this is an extend, not a new scaffold, switch to EXTEND.md. If the path
exists and is non-empty but is not a project, stop and ask before proceeding. Do
not scaffold over existing files.

At the confirmed path: `mkdir`, `git init`, write a `.gitignore` for the detected
type (see templates.md), picking the variant that matches the detected stack (e.g.
node vs python for software projects) and defaulting to the closest match. Nothing
is committed yet. The repo exists early so the grill can write docs live.

### 4. Grill to shared understanding (always, in full)
Interview the user relentlessly, one question at a time, walking the design tree
and resolving dependencies one by one. For each question, give your recommended
answer. If a question is answerable from the input, answer it from the input
instead of asking.

Write decisions live, do not batch:
- **Terminology** -> `CONTEXT.md` glossary (format: CONTEXT-FORMAT.md). Devoid of
  implementation detail. A glossary, nothing else.
- **Hard-to-reverse trade-offs** -> `docs/adr/NNNN-slug.md`, sparingly. File only
  when it clears the ADR gate (format and gate: ADR-FORMAT.md).

Grilling moves:
- Challenge terms that conflict with what is already in `CONTEXT.md`.
- Sharpen fuzzy or overloaded words into one canonical term.
- Stress-test relationships with concrete edge-case scenarios.
- The input seeds questions, it never shortens the grill.

### 4a. Glance at sibling projects (read-only)
Before finalising the scaffold, look at the sibling directories of the new
project's parent dir (e.g. other folders alongside it in `~/projects`). Shallow
and read-only: check only each sibling's top-level steering or readme file
(`AGENTS.md`, `README.md`, or `CLAUDE.md`), first lines only, to judge
relevance. If any are relevant to this project, note them for the AGENTS.md
"Related projects" section (path + one-line why). If none are relevant, omit
that section entirely. Do not traverse into sibling internals.

### 5. Preview and confirm
Before writing the remaining scaffold, show:
- detected type + final path
- the full directory tree to be created
- extracted goals, first tasks, and open questions

Wait for one explicit "go".

### 6. Scaffold (on go)
Before writing any file, self-edit every piece of synthesized prose you are
about to commit (`AGENTS.md`, `TASKS.md`, `CONTEXT.md`, ADRs). Keep it direct,
specific, and free of filler. The conventions written into `AGENTS.md` govern
the scaffolded project itself, not just future work in it.

Write from templates.md:
- **`AGENTS.md`**: write from templates.md, filling every placeholder. Include the
  multi-agent contract (below). The `CONTEXT.md` and `docs/adr/` index entries are
  conditional: both are created lazily during the grill and may not exist in a
  fresh scaffold. Add the "Related projects" section only if step 4a found any
  (path + one-line why).
- **Harness steering**: keep `AGENTS.md` canonical. Also create `CLAUDE.md` with
  the single line `@AGENTS.md` so Claude Code imports the same instructions.
  Codex reads `AGENTS.md` directly. Add another harness alias only when the user
  names that harness and its supported import mechanism is known.
- **`TASKS.md`**: goals to Backlog, extracted Open Questions filled in; Now and
  Next left empty.
- **Dirs**: `assets/`, `docs/`, `docs/memory/`, `research/`; add a `.gitkeep`
  to every created directory that has no file yet (git does not track empty dirs,
  so without it `research/` and other empty dirs vanish on clone). `assets/` is
  tracked in git (provenance is the point); very large or binary assets may be
  gitignored if size is a concern. The `AGENTS.md` index is the single source of
  truth for what-goes-where. No per-directory READMEs.
- **Type-specific dirs**: on top of the core, add the extension for the declared
  type (see templates.md, "Type-specific extensions"). Keep it minimal, omit when
  unsure. Reflect whatever you add in the `AGENTS.md` index.
- **Memory index**: seed the repo-local index (header + format, no facts).
- **Provenance**: copy the source artifact into `assets/` with a dated name, log
  it in `assets/sources.md`; ADRs and CONTEXT terms that came from it cite it. A
  typed-only idea with no file goes to `assets/origin.md`.
- **Base skills**: copy the three bundled base skills into the project. For
  each of `capture-to-project`, `tidy-project`, `recap-project`, copy this skill's
  `base-skills/<name>/` to the project's `.agents/skills/<name>/` and append
  `installed: <YYYY-MM-DD>` and `source: to-project` to the copied SKILL.md
  frontmatter. Create `.claude/skills` as a relative symlink to
  `../.agents/skills` so Claude Code and Codex use the same project-local files.
  Do not link either directory to a global or source installation.
- **Additional skills (optional)**: do not search for or install additional
  skills during the default scaffold. If the user explicitly asks for discovery,
  use the current runtime's skill catalog or search capability and present a
  short qualified list. Search is read-only. Install only when the user explicitly
  requests installation, use a project-local method supported by the active
  harness, and verify that a fresh session can discover each installed skill.

### 7. Commit
One commit, `Initial project scaffold`. Follow the user's commit conventions.
Do not create a remote. Show the final tree.

## Multi-agent contract (write into AGENTS.md)
The default working model this skill assumes and documents:
- One **main/orchestrator session**; **named side-agents** each run their own
  loop, often on their own branch or git worktree.
- `TASKS.md` is the coordination surface. Claim before working.
- Shared files: re-read right before editing, keep edits narrow, never revert
  another writer.
- If a write is blocked or risks collision, work in a worktree and merge back
  (rebase onto moved main, then ff-only).
- Converging a side session back into the main thread closes the loop; the main session stays the source of truth.

## Harness notes

`AGENTS.md` is the canonical steering file and Codex reads it directly. Claude
Code expects `CLAUDE.md`, so the scaffold creates a small import file rather
than duplicating instructions.

`CLAUDE.md` contains the single line `@AGENTS.md` using Claude Code's import
syntax. If either file already exists, preserve its content and merge the
steering instructions instead of overwriting it.

## Files
templates.md (scaffold file bodies), EXTEND.md (extend mode), CONTEXT-FORMAT.md and
ADR-FORMAT.md (formats for step 4), base-skills/ (capture-to-project, tidy-project,
recap-project, copied into each scaffold). Additional skill discovery is optional
and runs only when the user requests it.
