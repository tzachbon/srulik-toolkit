# Graph mode: verification evidence

Plugin version: 1.18.0. Base: 3cb1a721416173aef06833265987f68d3aa59078. Issue: #66.

## Contract

`scripts/test-graph.js` loads `test-graph-run.js`, `test-graph-models.js` and
`test-graph-review.js`. Shared setup is in `graph-fixtures.js`. There are 19
groups, all using local fakes: no network, no real model calls. The tests set a
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
of this PR: 160 mutations, 160 failed as targeted, and 160 passed again when
restored. The only assertion without a mutation is `length <= 100` inside the
fake leaderboard server, which is test setup, not behavior.

Each of the 12 text contracts in part 18 was also broken once in a scratch copy.
Each time, `validate.sh` failed with that contract's message.

Two real processes were run against one write, using the CLI:
- Two concurrent `apply` calls ran the command once.
- A `--mark failed` sent while a slow write was still running was refused, a
  second `apply` was refused, and the command ran once.

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
process was still running. That fix has its tests, its mutations and the
two-process check above, but no fourth review round. The owner chose to open
the PR at that point instead of starting another round.

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

## Limits

- The full run of `pr-review.yaml` against a real PR with delegated children is
  part of the PR's end-to-end check and is recorded on the PR.
- Windows runs `test-graph.js` in CI. `fs.watch` and the lock's live-process
  check are exercised on Linux only.
