---
name: capture-to-project
description: Use when a decision, definition, durable fact, or actionable item surfaces in conversation and belongs in the project's docs. Triggers include "capture this", "save this to the project", or an AGENTS.md directive to file capture-worthy moments as they happen.
---

# capture-to-project

File something from the current conversation into the right project doc, then
commit. The automation is in the routing: you decide a moment is worth keeping,
the skill decides where it goes.

**Core principle:** route by what the content *is*, into the file that already
owns that kind of knowledge. Do not invent a new file or a catch-all log.

## Routing

| Content | Destination |
|---|---|
| A term or definition | `CONTEXT.md` glossary |
| A hard-to-reverse decision with a real trade-off | new `docs/adr/NNNN-slug.md` |
| An actionable item / next step | `TASKS.md` (Backlog, or Now/Next if clearly current) |
| A durable fact worth recalling later | a file in `docs/memory/` + a pointer line in `docs/memory/MEMORY.md` |
| A finding or notes that fit none of the above | a dated note in `research/` |

Create `CONTEXT.md` or `docs/adr/` lazily if they do not exist yet (first term,
first ADR). Match the existing file's format. For ADRs, only file one when the
decision is hard to reverse AND surprising without context AND a real trade-off,
otherwise route it as a fact or a task instead.

## Steps

1. Identify the one thing to capture and its type (table above). If several
   distinct things came up, file each into its own destination.
2. Match the destination's voice. Keep the addition direct and free of filler.
   Append or merge; never clobber existing entries.
3. If it came from a specific source already in `assets/`, cite that source.
4. Commit: `git add -A && git commit -m "capture: <what>"`. The project keeps
   everything tracked, so do not leave the write uncommitted.

## Do not
- Dump the raw transcript. Capture the resolved point, not the discussion.
- Duplicate something already filed. Check the destination first.
- Force a fit. If it is genuinely just notes, the dated `research/` note is correct.
