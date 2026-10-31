# Takeover skill evidence

Status: authored, validated, and evaluated against a no-skill baseline on
Claude Code. One known gap (E3 confirm mode) ships as a documented limitation
at the owner's direction. Codex, T3 Code, and Cursor runtime behavior is
unverified.

## Source and checks

- Base: `172c9ea823a785030027f28ad2a97918c353aae6` (`origin/main`).
- Plugin version: `1.11.0`; twenty-three top-level skills.
- `SKILL.md` SHA-256: iteration 1 `bce13141…a7cd525f4` (`fe914bc`); iteration 2
  `794b3f4b…0e835533b12` (`41ecaae`); final `3231d51f…965227b34a0` after review
  wording fixes (precedence sentence completed, no trigger changes; not re-evaluated).
- `./scripts/validate.sh` and `git diff --check`: passed on Linux.
- New contract `scripts/validate/9_takeover.py`. Eleven deliberate mutations were
  each rejected: dropped "Never revert in auto mode", changed the question cap,
  dropped the other-writer trigger, dropped "missing" from the Definition of
  Done trigger, added a host tool name to the core, removed the T3 Code row,
  added a stray file, made the core longer than `recap`, removed `takeover`
  from the startup hint, dropped the several-parts trigger, dropped the
  partial-brief precedence rule.
- `README.md` was already over the 20,000-byte per-file commit limit on `main`.
  Its "How the toolkit fits together" section moved verbatim to
  `docs/workflow.md`; `2_planning.py` reads both files.

## Design inputs

The requirements came from the owner's grill answers and from a keyword scan
of the owner's own Claude Code and Codex sessions between 2026-10-04 and
2026-10-31. Recurring corrections in those sessions became rules:

- Outcome over activity, for example "tooling and downloaded clips do not count".
- An over-built plan counts as scope creep: "update the plan to not over engineer".
- The user's latest words override the earlier agent's own limits: "That was my
  limit, not a user stop".
- Pushed work must not be redone: "don't redo pushed work".
- A near-empty provider-switch handoff ("Selected 0 intact items") is normal.
- The brief stays short: "you yapped too much".

## Review

One independent `review-pro-max` round found stray Python bytecode committed
from validation runs (removed; root `.gitignore` added) and an unpinned confirm
trigger (pinned). Both fixes are in the final commit.

## Evaluation

Fixtures are synthetic: a tiny Python inventory CLI with a bare remote, an
exported earlier transcript, and a one-line handoff. Each run used a fresh
`claude -p` session (Claude Code 2.1.316, `sonnet` alias), a disposable
`CLAUDE_CONFIG_DIR`, `--strict-mcp-config`, no session persistence, and bypass
permissions inside a copied fixture. `with_skill` loaded the plugin through
`--plugin-dir` and invoked `/srulik-toolkit:takeover`; `without_skill` loaded no
plugin and received the same task text. One run per configuration. Token counts
were not captured. Grading was done by the authoring agent against
expectations fixed before the runs, citing final answers and repository state.

| Fixture | Scenario | with_skill | without_skill |
| --- | --- | --- | --- |
| E1 auto continue | "Continue where you left off"; one pushed fix, one failing test | 5/5 | 5/5 |
| E2 scope creep | Unrequested edits to 3 files plus a `rich` dependency; wrong JSON shape | 6/6 | 2/6 |
| E3 false claims | "All tests pass" was false; exporter never wired in; no agreed Definition of Done | 3/4 (iteration 1), 3/4 (iteration 2) | 2/4, 2/4 |

Iteration 1 benchmark: pass rate 0.92 with the skill versus 0.61 without.

- E2 shows the main gain. With the skill, the agent listed every unrequested
  change with a revert recommendation, made no edits, and asked three
  questions. Without it, the agent reverted the files and deleted
  `requirements.txt` without asking.
- E3 is the known gap. With the skill, the agent caught the false claim, marked
  the exporter as enabling work, and proposed an outcome-based Definition of
  Done, but it chose auto mode and committed locally before asking. Iteration 1
  traced the miss to "missing" having been trimmed from the confirm trigger;
  iteration 2 restored and pinned it, and the agent still chose auto. The
  likely cause is that the agent treats its own proposed Definition of Done as
  settled. A candidate fix ("A Definition of Done you propose stays missing
  until the user confirms it") was not applied; the iteration limit was reached.
- Neither configuration pushed in E3; both left the commit local.

Human feedback: the owner reviewed the summary in conversation and chose to
ship with E3 as a known gap. No per-run feedback file was exported from the
static review pages.

## Limitations

- Runtime verified only on Claude Code with Sonnet. Codex, T3 Code, and Cursor
  are not exercised; `references/sources.md` labels Cursor and other hosts
  untested.
- One run per configuration; no variance estimate. Token usage unavailable.
- The history scan matched keywords and did not read every session in full.
