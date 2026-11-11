# Full-task graph: verification evidence

Plugin version: 1.23.0. Base: 76a4ffe. Issue: #75.

## Contract

`scripts/test-graph-flow.js` adds groups C40–C48, loaded by `scripts/test-graph.js` with C1–C39. All use local fakes; nothing calls a model or the network.

| Group | Covers |
| --- | --- |
| C40 | Parent tasks: substituted prompt, no pick, no cap charge, `resumed` on every `next` until recorded, refs add edges, rejection blocks downstream and ends the run `blocked` with an `end` event (status called with no `next` in between) |
| C41 | Loops: a round waits for every group node, `status` stays `running` between rounds, a late report from an earlier round is a duplicate, round isolation (a round-1 failure doesn't make a clean round 2 `partial`), `.r<n>` files, outside nodes start only after `loop-exit`, a failed exit node blocks consumers |
| C42 | `${prev.node.field}`: `null` in round 1, the previous round's value after, same loop only, `prev` reserved |
| C43 | `max_rounds` gives `partial`; fan-out before a loop is trimmed so every round still fits; `check` counts rounds against the cap and enforces contiguity, a single exit, one loop per node and the round range |
| C44 | `after`: dependents wait, get `input.after`, fail as `blocked by <id>` when a dependency fails; cycles, unknown ids, duplicate ids and non-objects fail at admission |
| C45 | `when`: false skips only its node, consumers get `null`, a reference with no survivor is false, re-checked each loop round, `check` rules |
| C46 | A run log written by 1.22.0 (`scripts/fixtures/graph-1.22-run.jsonl`) folds to the same status; `pr-review.yaml` still checks; new runs record `engine: 2` |
| C47 | Run index rows for parent tasks, rounds and skips; `.r<n>` files and attachments served by the view; the page's reducer, run in Node, keeps one card per round and marks parents, skips and loop exits |
| C48 | `graphs/task.yaml` walked with fake answers: without hosting it skips issue, PR, post, babysit and merge (even with merge authorized) and ends `done`; with hosting it runs two plan rounds, implements from the reviewed plan in `after` order, posts once per review round, merges only after babysit, and passes the previous plan file and decided findings into round 2 prompts |

Before the engine existed, C40–C45 and C47 failed with `unknown key` errors, C46 failed only on the missing `engine` tag, and C48 failed because `task.yaml` did not exist. C1–C39 passed throughout.

## Per-assertion red proof

Each mutation ran in a pristine copy of the repository, then the copy was discarded. The original group passes. 47 mutations, 47 failed as targeted:

| Mutation | Group | Result |
| --- | --- | --- |
| parent-no-resume | C40 | red |
| parent-charged | C40 | red |
| parent-text-refs | C40 | red |
| parent-for_each | C40 | red |
| reject-no-loop-exit | C40 | red |
| round-early | C41 | red |
| outside-sees-loop | C41 | red |
| stale-round-accepted | C41 | red |
| no-isolation | C41 | red |
| round-decided-in-done | C41 | red |
| r2-filename | C41 | red |
| exit-failed | C41 | red |
| prev-null | C42 | red |
| prev-same-loop | C42 | red |
| max-rounds | C43 | red |
| reserve-rounds | C43 | red |
| check-rounds-cap | C43 | red |
| between-check | C43 | red |
| after-wait | C44 | red |
| after-input | C44 | red |
| after-block | C44 | red |
| after-cycle | C44 | red |
| when-ignored | C45 | red |
| when-no-survivor | C45 | red |
| skip-cascades | C45 | red |
| when-field-out | C45 | red |
| engine-tag | C46 | red |
| index-history | C47 | red |
| index-parent | C47 | red |
| view-r-path | C47 | red |
| page-round-card | C47 | red |
| page-skipped | C47 | red |
| r1-missing-round | C41 | red |
| cap-trim-after | C44 | red |
| prev-two-part | C42 | red |
| pick-round | C47 | red |
| page-round-clears | C47 | red |
| exec-round | C41 | red |
| page-round-capskip | C47 | red |
| pick-fallback | C13 | red |
| pick-fallback-any | C31 | red |
| pick-independence | C13 | red |
| page-same-creator | C47 | red |
| task-merge-gate | C48 | red |
| task-post-hosted | C48 | red |
| task-draft-prev | C48 | red |
| task-review-decided | C48 | red |

Four assertions did not fail on their first mutation, and were fixed before this table:
- the resume check crashed before its message;
- the parent-ref check passed through a different error;
- the stale-round check ran before round 2 was admitted;
- a `status` guard was dead code, because the round decision happens in the same locked `done`. The guard was removed, and the mutation now removes that decision instead.

Each of the 20 new text contracts in `scripts/validate/18_graph.py` was also broken once in a scratch copy. Each time, validation failed with that contract's message.

## Live view

`tests/evidence/graph-flow/` holds Playwright screenshots of `graph.js view` replaying a scripted `task.yaml` run, with fake answers but the real engine and page:

- `done-*`: the finished run;
- `waiting-*`: the run stopped while `babysit` waits on the orchestrator;
- `panel-round2-light-1400.png`: the details panel of a round-2 card.

Each run was captured at 1400 px and 390 px wide, in light and dark. Every capture had zero page errors and zero overlapping cards.

The screenshots show:
- parent cards tagged `you`, with `waiting on orchestrator`;
- `r2` cards beside round 1;
- `after` edges from `engine` to `view`;
- the skipped `merge`;
- a gate-dropped verify;
- the header line per loop, such as `plan-rounds: round 2/5 (until)`.

These runs come from a fixture. The real-task run is recorded below.

## Review fixes

An independent `review-pro-max` pass on `641625c` reproduced five defects. Each was fixed test-first, and its mutation is in the table above.

1. **Stale reports without `round`.** A loop node's report without `round` could be recorded as a later round's result, because attempt numbers restart each round. From round 2 on, `done` now refuses it (`r1-missing-round`).
2. **Cap trims on `after` fan-outs.** A cap trim failed every instance as `unknown id`. The list is now ordered before trimming, and only items that wait for a trimmed one fail, as `blocked by <id> (cap-skipped)` (`cap-trim-after`).
3. **Skips in later rounds.** In the view, a node skipped in one round stayed skipped in later rounds. A `round` event now clears the loop's skips and blocks (`page-round-clears`).
4. **Model on the wrong card.** A round-2 model showed on the round-1 card, because `graph.js pick` wrote no round. It now does (`pick-round`).
5. **Two-part `prev` refs.** `check` accepted `${prev.x}`, and `next` then crashed on it. `check` now rejects it (`prev-two-part`).

The `when` row in `graph-spec.md` now says what the engine does: a reference that failed finally or was blocked blocks the node, rather than skipping it.

A second review pass on `b5c0439` found two more defects. Both are fixed, and each has its mutation in the table above:

- `exec` recorded a `run` node inside a loop without its round, so from round 2 on the node was refused and stayed dispatched forever (`exec-round`).
- In the view, a node's cap-skipped card from an earlier round stayed on screen in later rounds (`page-round-capskip`).

## skill-creator evaluation

The evaluation ran 3 prompts. Each prompt ran once with this PR's skills (snapshot at `0eff204`, `with_skill`) and once with v1.22.0 (`76a4ffe`, `old_skill`). All 6 runs were fresh child sessions on `claude-sonnet-5-5` at high effort, with the same inputs and permissions within each pair. Every output was graded against its listed expectations, with evidence taken from the files each run produced.

| Eval | with_skill | old_skill |
| --- | --- | --- |
| 1. Fix a failing test end to end; no hosting remote | 5/5 | 3/5 |
| 2. Swarm: fix one typo in each of three files, then verify | 3/4 | 2/4 |
| 3. Change a config file outside Git, end to end | 4/4 | 3/4 |
| Mean pass rate | 0.92 | 0.62 |

- **Both configurations** made the correct change in every eval.
- **v1.22.0** never ran a graph. It skipped the issue and PR steps by following its prose, and in eval 2 it chose not to use graph mode for single-stage work.
- **This PR** ran `task.yaml` from `research` to `end: done` in evals 1 and 3. Both runs skipped the issue, PR, post, babysit and merge nodes because `hosted: false`. In eval 2 it ran a graph: `fix` fanned out over the three files.
- **Eval 2 miss:** the run checked the result with a deterministic `run` node rather than a `differ_from` verifier agent.
- **Cost:** for one-line changes, the full task graph costs many more agent calls than v1.22.0 did.
- **Measurements:** timing and token counts were not available from the host, so the benchmark leaves them as unknown.

**Defect found.** In evals 1 and 3, `pick` blocked `plan-review` and `audit`, because `differ_from` excluded the only creator the run could use. One run then wrote models into the run log that `pick` had never chosen.

**Fix.** `pick --fallback same-creator` keeps `differ_from` strict by default, so C31 still holds. The option is for a host with one provider:
- it drops only that one exclusion, and only when nothing else is left;
- the pick reason logs `independence: same-creator`, and the view marks the card;
- agent-swarm tells the orchestrator to use the option, and never to record a model `pick` did not choose.

The static review artifact was generated with `eval-viewer/generate_review.py`. Human review status is recorded in the PR.
