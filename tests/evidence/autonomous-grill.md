# Autonomous grill evidence

`create-plan` and `execute-task-end-to-end` gain an autonomous mode. When the
user asks for autonomy, the grill still runs, but a fresh stand-in subagent
answers each wave as the user would. The stand-in does not see the planner's
recommended option.

## Contract checks

`scripts/validate/16_autonomous_grill.py` pins the mode's phrases in seven files
and bans host tool names from `create-plan/references/autonomous.md`.

- Red on `66f8c04`, before any skill edit: `create-plan/SKILL.md is missing
  autonomous grill contract: ## Autonomous mode`, exit 1.
- Mutation spot checks, one phrase removed per run in a copy, each failing with
  its own message: the hidden-pick rule, the `blocked`-row exception, the
  end-to-end `**Autonomous mode.**` paragraph, the kept internal-grill sentence,
  and the host-token ban (`delegate_task` appended to `autonomous.md`).
- Green: `./scripts/validate.sh` passes at the PR head.

## Live evaluation

Runtime: Claude Code 2.1.319, `claude -p`, planner on the `sonnet` alias
(`claude-sonnet-5-5`). Each run used a disposable `CLAUDE_CONFIG_DIR` holding a
fixture user `CLAUDE.md`, plus `--strict-mcp-config`, no session persistence
and bypass permissions inside a copy of the fixture. Provider credentials came
from the parent process environment and were not written to disk. `with_skill`
loaded this branch through `--plugin-dir`. `old_skill` loaded a frozen
`66f8c04` copy. There was one run per side per iteration, and token counts were
not exposed.

The fixture is a 32-line stdlib Python todo CLI (`add`, `list`) with a README.
The user's `CLAUDE.md` says: no third-party dependencies; JSON output is one
array on one line; one file when possible.

Prompt (both sides): `/srulik-toolkit:create-plan Add a --json option to the
list command of this CLI. Be autonomous: let a subagent answer your grill
questions on my behalf.`

E1-E5 were fixed before the first runs:

| ID | Expectation |
| --- | --- |
| E1 | An `Agent` call with `model: "opus"`, `effort: "max"`, `run_in_background: false` briefs a stand-in |
| E2 | No stand-in brief names the planner's pick |
| E3 | The run ends with no unanswered grill wave and links a delivered plan file |
| E4 | The plan has `## Answered on your behalf` with a Definition of Done row |
| E5 | The plan honors both preferences, and the log cites the user's instructions |
| E6 | The grill runs in full: two or more stand-in waves; no skipped discovery, contract mode or review |

E6 was added after iteration 1's baseline: that run asked one wave and skipped
discovery, contract mode and review.

| Iteration | with_skill | old_skill |
| --- | --- | --- |
| 1 | 2/6 (E2, E4) | 1/6 (E2) |
| 2 | 5/6 (E1-E5) | 1/6 (E2) |

In iteration 1, the stand-in ran on the default model. The planner ran one
wave, left the source column out of the log, and skipped discovery and review.
Iteration 2 strengthened `autonomous.md`: every step of the Workflow is
required, the model and effort must be set explicitly, there are at least two
waves, and the log has every column.

In iteration 2 with the skill, two Opus max-effort stand-ins answered wave 1
(Outcome, Definition of Done, output shape, flag placement) and an adversarial
wave 2 (corrupt store, stdout/stderr, docs, check). Neither escalated. The log
cites `CLAUDE.md` rules, and the planner's pick matched every answer. Without
the skill, the planner spawned one general-purpose helper. It then refused to
count the helper's Outcome and Definition of Done answers, handed them back to
the user, and skipped the adversarial wave.

E6 still fails. The iteration-2 planner ran both waves but marked skill
discovery `INCOMPLETE` and did not run the review loop. The baseline skipped
the same steps. This gap belongs to the create-plan workflow on a small `-p`
task, not to autonomous mode. The iteration limit of 2 was reached, so it
remains a known limit.

The `with_skill` run took 651 s and cost USD 1.59; the baseline took 87 s and
cost USD 0.23.

## Limits

- Unverified, text contracts only, as the user accepted: the `ask the user`
  escalation, the no-subagent path, the stand-in answering mid-run in
  `execute-task-end-to-end`, and the stand-in launch on Codex, T3 Code and
  Oh My Pi.
- One sample per side; fixture is synthetic.
- Human feedback: not collected; merge authorized by the user.
- Target `autonomous.md` SHA-256 at the iteration-2 run:
  `774ee7b7fcb34284eea32676d7e0b4b3b2bff8af693ba0b73a60f6d0822158ae`.
  Review fixes changed `autonomous.md` after that run: stand-in experiments
  only in a scratch copy, user-only decisions never sent to the stand-in, and
  the Smart Ralph offer skipped. These edits were not rerun live.
