---
name: tidy-project
description: Use periodically (session start, or after a batch of changes) to keep a project clean. Triggers include "tidy the project", "clean up", janitor pass, or an AGENTS.md directive to run a cleanup occasionally. Handles stray log/tmp files, stale tasks, dead memory pointers, and AGENTS.md index drift.
---

# tidy-project

A janitor pass. Scan the project for rot, fix what is clearly safe, propose what
is risky, then commit. The project keeps everything tracked, so the tree should
be clean and committed when you finish.

**Core principle:** a destructive step never runs unattended. Safe fixes apply
automatically; anything that deletes tracked content or is ambiguous is proposed
and waits for a yes.

## Scan list

1. **Stray junk** — `*.log`, `tmp/`, `.scratch/`, editor/OS cruft, build leftovers.
2. **`TASKS.md` staleness** — completed items lingering in Now/Next; resolved Open
   Questions still listed.
3. **Dead `docs/memory/` pointers** — `MEMORY.md` lines pointing at files that no
   longer exist (or files with no pointer).
4. **AGENTS.md index drift** — index entries for dirs/files that no longer exist,
   or top-level dirs/files missing from the index.
5. **Broken cross-references** — links between docs (CONTEXT, ADRs, TASKS) whose
   targets moved or were deleted.

## Two classes

**Safe (auto-fix):**
- Delete junk that already matches `.gitignore` patterns.
- Fix an index entry whose target merely moved.
- Remove a `MEMORY.md` pointer to a deleted file.
- Repair a broken link whose target is unambiguous.

**Risky (propose, then wait):**
- Deleting any tracked file.
- Removing or rewriting a `TASKS.md` item (you might still want it).
- Anything where "is this outdated?" is a judgment call.

## Steps

1. Run the scan. Build two lists: safe-fixes, risky-proposals.
2. Apply the safe fixes.
3. Present the risky list as a short numbered plan. Apply only what the user
   approves.
4. Commit: `git add -A && git commit -m "tidy: <summary>"`. If nothing changed,
   say so and skip the commit.

## Do not
- Delete tracked content without explicit approval.
- "Tidy" by deleting work you do not understand. When unsure, propose, never auto.
