# Graph mode: verification evidence

Plugin version: 1.19.0. Base: 16573c5fed91c318c6d467ab117e2590fd92e63c. Issue: #66.

## Contract

`scripts/test-graph.js` loads `test-graph-run.js`, `test-graph-models.js`,
`test-graph-review.js`, `test-graph-e2e.js` and `test-graph-later.js`. Shared setup is in
`graph-fixtures.js`. There are 33 groups, all using local fakes: no network, no real model calls. The tests set a
temporary `PLUGIN_DATA` before any graph module loads, so they never touch real
notes or stats. `scripts/validate/18_graph.py` checks the skill and reference
text, the NOTICE attribution, the standards paragraph, that there are no
dependencies, and that the bundled `pr-review.yaml` passes `graph.js check`.
It then runs the contract.

Before any module existed, every group failed with `Cannot find module`, and
C13 failed on its first CLI exit-status assertion.

## Per-assertion red proof

Each behavior assertion has a mutation in the implementation that makes it the
first failure. The test is never changed. Each mutation ran in a pristine copy,
then the code was restored and the group passed again. Final run at the head
of this PR: 206 mutations, 206 failed as targeted, and 206 passed again when
restored. The only assertion without a mutation is `length <= 100` inside the
fake leaderboard server, which is test setup, not behavior.

Each of the 12 text contracts in part 18 was also broken once in a scratch copy.
Each time, `validate.sh` failed with that contract's message.

Real processes, through the CLI:
- Two concurrent `apply` calls ran the command once.
- A `--mark failed` sent while a slow write was still running was refused, a
  second `apply` was refused, and the command ran once.
- A write killed by its timeout stayed an unknown outcome; the next `apply`
  was refused, so the command ran once.
- Two concurrent `done` calls sharing a write reserved `note#1` and `note#2`.
  Without the run lock, both reserved `note#1`.
- Two `next` calls that both found the same dead `run.lock` dispatched once.
  Without the reclaim guard, both dispatched under `max_agents: 1`.

## Review

A three-vendor panel reviewed the change for three rounds: OpenAI
`gpt-6-astra`, Google `gemini-4-argon-high` and Moonshot `kimi k3.1-pro`, all
at high effort and read-only.

| Round | Head | Findings | Scores (OpenAI / Google / Moonshot) |
| --- | --- | --- | --- |
| 1 | 635b59e | 10 distinct | 6 / 9 / 6 |
| 2 | 1632af5 | 6 distinct (2 reopened) | 7 / 10 / 6 |
| 3 | 2ae34dd | 1 | 8 / 10 / 10 |

Each finding was fixed with a failing test first, plus a mutation. The single
round-3 finding was fixed in c06cbf3: recovery could unlock a write while its
process was still running. The owner chose to open the PR at that point
instead of starting a fourth panel round.

On the PR, review continued from three more sources, all fixed test-first in
the same way:

| Source | Findings |
| --- | --- |
| Codex bot | 17: timed-out writes, stale successes, fan-out fields, outcomes rescored past a stalled watermark, fan-out values in prompts, two processes reclaiming one dead run lock, `in: ${inputs.k}` dropped, `exec` not returning a run node's write, benchmark scores borrowed across efforts, gate outcomes lost when the report omits its model, overlapping `score` runs counting a thread twice, the weekly job listing threads from its last run instead of the watermark, `differ_from` excluding a creator whose attempt failed, LMArena effort labels such as `(Max)` dropped so another effort's rating was borrowed, a proxy route standing in for a model's creator so `differ_from` could be bypassed, a node named `inputs`, a node named `constructor` treated as already blocked |
| CodeRabbit | 10 (one major): gate drop in the result event, run-node fields, view errors, docs, a test that couldn't fail, a missing write command treated as an unknown outcome, an unscorable thread stalling the scoring watermark, `out` fields a run node can't produce |
| This graph's own run on the PR (Opus, Kimi ×2) | 5 new (one overlapped Codex): `differ_from` scope, scoring watermark, a run-directory lock, same-indent YAML lists, a `--mark` race |

The perf reviewer's three suggestions (fold the log once per pick, index
outcomes, load sources concurrently) are optional; they affect speed only at
large scale.

## Live view

A headless Chromium screenshot of `graph.js view` replaying a sample
`pr-review` run, in light and dark color schemes:

- `graph-mode/pr/view-sample-light.png`
- `graph-mode/pr/view-sample-dark.png`

What the screenshots show:
- `fetch` and two `review` instances done, on `claude-opus-5-5`.
- `review#2` picked `claude-sonnet-5-5 @ high`.
- `verify#0` done on `gpt-6-astra`; `verify#1` dropped by its gate.
- `verify#2` retrying, with a `<b>x</b>` reason shown as literal text, not as
  HTML.
- `report#0` on attempt 1.

The sample events were written by hand, so this proves rendering, not a real
run. The server returned 403 to a foreign `Host` header, and streamed a newly
appended event within 2 s (C14).

## Real end-to-end run on this PR

`pr-review.yaml` ran on PR #67 from `graph.js` on the VPS. Every agent node was delegated through T3 Code `delegate_task` with exactly the provider, model and effort that `pick` chose. Quota came from `aa-models usage`; the highest window was 60%, so nothing was filtered for quota.

| Instance | Provider | Model | Signal | Percentile | Explored | Filtered |
| --- | --- | --- | --- | --- | --- | --- |
| review#0 | claudeAgent | claude-opus-5-5 | aa.terminal_bench_4_0 | 0.93 | True | — |
| review#1 | oh-my-pi | 9router/kimi/k3.1-pro | aa.terminal_bench_4_0 | 0.99 | False | — |
| review#2 | oh-my-pi | 9router/kimi/k3.1-pro | aa.terminal_bench_4_0 | 0.99 | False | — |
| verify#0 | antigravity | gemini-4-argon-high | aa.humanitys_last_exam | 0.97 | False | creator: claude-opus-5-5, claude-sonnet-5-5 |
| verify#1 | antigravity | gemini-4-argon-high | aa.humanitys_last_exam | 0.97 | False | creator: claude-opus-5-5, claude-sonnet-5-5 |
| verify#2 | antigravity | gemini-4-argon-high | aa.humanitys_last_exam | 0.97 | False | creator: claude-opus-5-5, claude-sonnet-5-5 |
| verify#3 | antigravity | gemini-4-argon-high | aa.humanitys_last_exam | 0.97 | False | creator: claude-opus-5-5, claude-sonnet-5-5 |
| report#0 | claudeAgent | claude-opus-5-5 | aa.gdpval_elo | 0.99 | False | — |

- `fetch` ran `gh pr diff 67` (133 KB) without a shell.
- The three reviewers returned 9 findings. With `max_agents: 8` and one slot reserved for `report`, 4 verify instances were admitted and 5 were logged `cap-skipped`.
- All four verifiers checked findings from `review#0` (Anthropic), so `differ_from` excluded only Anthropic and Gemini was picked.
- 3 findings were confirmed and 1 was refuted (dropped by the gate). All 3 confirmed findings were already fixed in 391e9ef.
- 4 outcomes were credited to the producing model: 3 success, 1 failure, all `claude-opus-5-5 / code-review`.
- `report` (Opus, writing benchmark at the 99th percentile) wrote the comment; `apply` posted it once with a `Partial run:` header, and a second `apply` was refused with `already applied`. Final status: `partial`.

The graph's own reviewers also found 5 new defects in this PR that the earlier panel missed; they're fixed in 391e9ef.

- `graph-mode/pr/e2e-review-running-light.png`: the live view mid-run, with three reviewers picked.
- `graph-mode/pr/e2e-final-light.png` and `-dark.png`: the finished run.

## Limits

- Windows runs `test-graph.js` in CI. `fs.watch` and the lock's live-process
  check are exercised on Linux only.
