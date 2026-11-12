# Graph spec

A graph is a YAML file that `scripts/graph.js` checks, schedules and records.
The parent agent runs the graph; the scripts never call a model.
[`graphs/pr-review.yaml`](../graphs/pr-review.yaml) and [`graphs/task.yaml`](../graphs/task.yaml) are the bundled graphs.

## Keys

| Key | Allowed on | Meaning |
| --- | --- | --- |
| `name` | spec | `[a-z0-9-]+`, required. |
| `loops` | spec | `<name>: {nodes, until, max_rounds}`. See [Loops](#loops). |
| `inputs` | spec | Default input values. `inputs` and `prev` are reserved, so no node may use those names. Override with `next --input k=v`. Values starting with `-` are refused. |
| `limits.max_agents` | spec | Required. The most agent instances the run may start. Retries and `run` nodes don't count. |
| `limits.explore` | spec | `true` or `false`, default `true`. Allows sampling on gated nodes that aren't verifiers. |
| `writes.<name>` | spec | Name matches `[a-z0-9-]+`. `{max, run}`. `run` is an argument list that may contain `"${inputs.<k>}"` and `"${file}"` as whole elements. |
| `parent` | node | Work the orchestrator does itself, with this text as its instruction. See [Parent tasks](#parent-tasks). `${p.f}` and `{item}` are substituted, and its refs add edges. It can't use `for_each`, `pick`, `model` or `kind`, and never counts toward `max_agents`. |
| `run` | node | An argument list run without a shell. Elements may be `"${inputs.<k>}"` as whole elements. Output: `{text: stdout}`, so `out` may list only `text`. |
| `agent` | node | The child's prompt. `{item}` becomes the current item: a string as-is, anything else as JSON. `${p.f}` becomes the value from a single-instance producer, or the JSON list of surviving values from a fan-out producer. |
| `kind` | agent node | `code`, `code-review`, `debugging` (debugging, reverse-engineering, configuring apps, working around restrictions), `architecture`, `ui-ux`, `agentic` (default), `reasoning`, `long-context` or `writing`. |
| `after` | agent node with `for_each` | An item field holding an id, such as `id`. Each item is then `{<field>: id, after: [ids]}`, and an instance starts only once every item it names has a surviving result. Its task's `input.after` lists those items as `{id, file, summary}`. If one of them fails finally or is dropped, the instance fails finally with `blocked by <id>`; independent items keep running. Unknown or duplicate ids, a cycle, or an item that isn't an object fail every instance at admission, with the reason. When `max_agents` trims the list, an item that waits for a trimmed one fails as `blocked by <id> (cap-skipped)`. |
| `when` | node | `node.field == literal`, naming a single-instance node other than this one, with the field in its `out`. It adds an edge. When false, or when that node's only result was dropped by its gate, this node settles as `skipped`: no task, no agent, not a failure. If that node failed finally or was blocked, this node is blocked like any other consumer. A skip doesn't cascade: a consumer gets `null` or `[]` for it. Inside a loop it is checked each round. |
| `in` | node | `${node.field}` reference, or a list of them. Adds an edge. A `run` node's only field is `text`. |
| `needs` | node | Node names to wait for. Adds edges. |
| `for_each` | agent node | A literal list, or a `${node.field}` reference to a list. |
| `pick` | agent node | `{tier, differ_from}`. `tier` defaults to `standard`. `differ_from` names an agent node and adds an edge. When this instance's item came from that node, only the creator of the instance that produced it is excluded; otherwise every creator that node used is excluded. Each producer instance counts only its latest pick, the attempt that produced its result. |
| `model` | agent node | `"<model-id> @ <effort>"`. Pinned, but still subject to `avoid`, exclusions and quota. Can't be combined with `pick`. |
| `out` | agent node | Fields the child's JSON must contain. |
| `gate` | node with `out` | `field == literal`, where the literal is `true`, `false`, a number or a `"string"`. A failing item is dropped. |
| `write` | node | A `writes` entry. The node's `output.body` becomes the file; for a `run` node, its stdout (`text`) does. Only results that survive their gate reserve a write. |

Any other key is an error. Node names match `[a-z0-9_-]+`, because each becomes a file name under `<run-dir>/nodes/`.

## YAML subset

Supported:
- block maps and block lists of scalars; a block list may sit at its key's indent
- plain, single-quoted and double-quoted scalars
- `true`, `false`, `null` and numbers
- `|` block scalars
- `#` comments
- inline `[a, b]` and `{k: v}` that contain only scalars

Rejected with `line N: <reason>`:
- anchors, aliases and tags
- `---`
- `>` folds
- tabs
- duplicate keys
- inline collections inside inline collections
- maps inside block lists

## What a task receives

- `in: ${inputs.k}` gives `input.inputs = {k: value}`.
- `in: ${p.f}` from a single-instance producer gives `input.p = {f: value}`.
- From a fan-out producer, it gives `input.p = [{index, item, f: value}]` over the surviving instances, with one key per field the consumer references.
- `needs: [p]` gives `input.p = [{index, item, file, summary}]` over the surviving instances: the absolute path of each output file and a one-line summary of its fields. The consumer reads a file when it needs the detail, so it must be able to read the run directory. The list may be empty; an empty review is still a result.
- Every agent task carries `graph`, the absolute path of the run index `<run-dir>/nodes/index.md`, so a child can see what the other agents did and read their files.

A child's JSON may add `attachments: [{name, text}]`: at most 10 text files, each name matching `[A-Za-z0-9][A-Za-z0-9._-]{0,79}` and each text at most 1 MB. `done` refuses anything else, and the instance stays retryable.

`done` also refuses a result whose `index` is not an admitted instance of its node, because the index becomes part of a file path.

## Node files and the run index

Before recording a result, `done` writes the instance's output to `<run-dir>/nodes/<node>-<index>.md`: a `# <node>#<index>` line, the item and model, then `output.text` or `output.body` as-is, or the output as a JSON block. Attachments go to `<run-dir>/nodes/<node>-<index>/<name>`. The run log keeps the output, the file path, the summary and the attachment names, not the attachment text.

`<run-dir>/nodes/index.md` is rewritten after every event, including `pick` and `end`. It is a table of every instance in every round (a later round's rows are named `<node>#<index>.r<n>`), with its item, status (`waiting`, `running`, `waiting on orchestrator`, `retrying (attempt n)`, `done`, `dropped`, `failed`), model (`parent` for a parent task), summary or failure reason, and files, plus one row for each node not yet started, blocked or `skipped`. The rewrite is best-effort: if it fails, the event is still recorded.

## Parent tasks

`next` returns a parent task as `{node, index, attempt, round, taskType: "parent", item, prompt, input, graph}`, with no model to pick. The orchestrator does the work and records `{node, index, round, output}` with `done`; `out` and `gate` apply as for agent nodes. A parent `done` with `failed` and `final: true` blocks everything after it, which is how a rejection stops a run.

An open parent task comes back from every `next`, marked `resumed: true`, until it is recorded, so the run picks up across turns, compaction and restarts. A `resumed` task is continued, never restarted: check the target first, such as whether the comment, issue, PR or merge already exists. The run index and the view show it as `waiting on orchestrator`.

## Loops

```yaml
loops:
  review-rounds: { nodes: [review, verify, post, fix], until: fix.clean == true, max_rounds: 5 }
```

The listed nodes repeat as one round. `check` requires:
- no node outside the group lies on a path between two group nodes;
- the `until` node is in the group, single-instance, with its field in `out`, and is the only group node with dependents outside the group;
- each node is in at most one loop, and `max_rounds` is an integer from 1 to 20;
- `prev` refs stay inside one loop;
- no two loops wait on each other's exit through their nodes' dependencies, directly or through nodes outside any loop.

When every node of a round has settled, in the same locked call that settled the last one, the loop either exits or starts round n+1:
- exit with reason `until` when the `until` condition holds;
- exit with reason `failed` when the `until` node failed finally or was blocked; its consumers are blocked;
- exit with reason `max_rounds` after the last round;
- exit with reason `cap` when the next round's static agents don't fit `max_agents`.

Only an `until` exit releases the nodes outside the loop. After any other exit the loop never converged, so its consumers outside it are blocked with cause `<loop> (<reason>)`.

A `round` event moves the round's instances, picks, blocks, skips and failures into history, so each round starts clean. Earlier rounds' files stay as `nodes/<node>-<index>.md`; round n ≥ 2 writes `nodes/<node>-<index>.r<n>.md` and attachments under `nodes/<node>-<index>.r<n>/`. Node names have no dots, so these never collide.

`dispatch`, every task and every `done` carry `round`; a report for another round is a duplicate. From round 2 on, `done` refuses a loop node's report without `round`, because attempt numbers restart each round. `pick` events carry the round too; a `pick` whose loop moved to another round while it ran is refused, so pick again. A node outside the loop treats a loop node as unsettled until `loop-exit`, then sees the final round. The round decision happens in the same locked call that settles a round, so `status` never sees a settled round without it.

Inside a loop, `${prev.<node>.<field>}` is that loop node's value from the previous round: `null` in round 1, a list for a fan-out node. It adds no edge, so an early node can read a later node's output from the last round. It is valid only in `agent` or `parent` text and only in this three-part form; `check` rejects `${prev.x}` and `prev` in `in` or `for_each`.

`max_agents` covers every round. `check` counts each loop agent node's static count × `max_rounds`. At runtime, fan-out admission counts agents already used in every round and reserves each loop node's static count for every round still to come.

## Scheduling

- A node is ready when every node it depends on has settled. A node is settled when it has a result, a final failure, a gate drop, or a block.
- The first `next` records the working directory (`--cwd`, default the caller's). Every `run` node and every write executes there.
- `next` and `done` hold `<run-dir>/run.lock` while they read and append, so parallel calls never act on the same stale state. A lock whose recorded process is gone is cleared under a short `run.lock.reclaim` guard, so two processes clearing the same dead lock never remove a lock one of them just took.
- Each attempt is offered once. A failure report for an attempt already reported is ignored. Pass the task's `attempt` in every result, success or failure, so a late report for an older attempt is ignored.
- Runtime fan-out is admitted once. Admission reserves the static instance count of every other agent node not yet admitted, so the total never passes `max_agents`. The overflow is logged as `cap-skipped`.
- A final failure blocks a consumer only when the producer was a single instance, or when every one of its instances failed.
- `status` returns `running` until every node settles. After that it returns:
  - `blocked`, when every sink failed or was blocked;
  - `partial`, after any final failure, cap skip or unapplied write in the current state, or a loop that exited for `max_rounds`, `cap` or `failed`;
  - `done` otherwise. Skipped nodes count as completed, and failures in earlier loop rounds don't count.
- `status` also returns `skipped` (node names) and `loops: {<name>: {round, exit}}`.

## Writes

`done` renders the write's body file, then records the result and its write reservation as one event. `apply` then:

1. Refuses an unknown ID, an applied write, or a write another `apply` is running right now.
2. Logs `write-claimed`, which moves the write to `applying`, and runs the command.
3. Logs `write-applied` or `write-failed`. A failed write may be applied again. A command killed by a timeout or a signal logs neither: its effect may have happened, so it stays an unknown outcome until the owner records it with `--mark`.

The claim lock records the process that holds it. While that process is still running, `apply` reports the write as being applied and `--mark` is refused, so a slow write is never unlocked mid-run. If the process stopped between steps 2 and 3, the outcome is unknown and `apply` refuses to run the command again. Check the target, for example the PR's comments, then record what happened with `apply --mark applied` or `apply --mark failed`. Marking clears the leftover lock; a write marked failed can then be applied again.

## Model resolution

`pick` applies these rules in order and logs the reason for each choice:

1. **Hard filters.** These remove candidates and apply to pinned models too:
   - the owner's `avoid` list for this kind;
   - creators excluded by `differ_from`. A model's creator comes from any AA row for that model, whatever its effort, or else from a first-party provider (`claudeAgent`, `codex`, `antigravity`). A model reached only through a proxy route, such as `oh-my-pi`, has an unknown creator: it is filtered whenever `differ_from` excludes any creator, and if a producer's own creator was unknown, its model is excluded instead;
   - models excluded by `--exclude`;
   - any usage account at or above 80% in some window: it filters candidates whose creator (matched through the provider aliases in `models.js`) or provider instance it names.

   If nothing is left, the result is `BLOCKED`. With `--fallback same-creator`, a `differ_from` exclusion that would leave no candidate is dropped instead, and only that one; the other filters still apply. The pick reason then carries `independence: same-creator` (otherwise `different-creator` whenever `differ_from` excluded anyone).
2. **Signal by kind.** The first source with a score for the model decides:

   | kind | signal |
   | --- | --- |
   | ui-ux | arena.webdev rating |
   | code-review | AA terminal_bench_4_0 |
   | debugging | AA terminal_bench_4_0, then arena.agent score |
   | architecture | AA intelligence_index |
   | agentic | arena.agent score, then AA automation_bench |
   | code | AA terminal_bench_4_0, then arena.agent score |
   | reasoning | AA humanitys_last_exam |
   | long-context | AA long_context_reasoning |
   | writing | AA gdpval_elo |

   A score is matched to the candidate's effort: an entry measured at that effort (such as `claude-opus-5-5-low`, or `Claude Opus 5.5 (Low)` on LMArena, for effort `low`) wins, then the unsuffixed entry. An entry measured at a different effort is never used. LMArena's other parenthesized notes, such as dates or `Codex Harness`, are ignored.

3. **Tier floor.** A candidate's percentile is computed against the whole population that has a score for that signal, not just the runnable candidates. The floors:
   - `standard`: 0.5 or higher;
   - `strong`: 0.75 or higher;
   - `strongest`: the top score;
   - `cheap`: no floor.

   A candidate also passes if it has 10 or more decayed outcomes, or if it has no score but the owner `prefer`s it for this kind.
4. **Posterior.** The benchmark prior is α = 1 + 4p and β = 1 + 4(1 − p), or 3 and 3 when there's no score. Outcomes are added with a 30-day half-life.
5. **Ranking.**
   - The `cheap` tier ranks by blended price, `(3·input + output) / 4`.
   - Other tiers rank by posterior mean, or by a Beta sample when exploring.
   - Ties go to `prefer`, then to the lower price.

## Run log events

`<run-dir>/run.jsonl` gets one JSON object per line. Every event carries `type` and `t`.

| Event | Fields |
| --- | --- |
| `spec` | name, engine (2), nodes, edges, inputs, cwd, loops |
| `skipped` | node, reason (`when false`) |
| `round` | loop, round (the round that starts) |
| `loop-exit` | loop, round, reason (`until`, `failed`, `max_rounds`, `cap`) |
| `admit` | node, count, items |
| `dispatch` | node, index, attempt, taskType (`run`, `agent` or `parent`), item, src, round (loop nodes) |
| `pick` | node, index, round (loop nodes), provider, model, effort, creator, explored, reason (with `independence` when `differ_from` applied) |
| `result` | node, index, output, file (absolute path of the output file), summary, attachments (names), model and provider (from `done`, else from this instance's latest `pick`), write (the reserved write, if any: id, name, file, argv), dropped (when the gate failed) |
| `failed` | node, index, attempt, reason, final |
| `gate-dropped` | node, index (for the live view; the result event's `dropped` is authoritative) |
| `cap-skipped` | node, count |
| `outcome` | node, index, model, kind, ok |
| `blocked` | node, cause |
| `write-claimed` | id (the write is now `applying`) |
| `write-applied` | id, marked |
| `write-failed` | id, reason |
| `end` | state |

Events for a loop node also carry `round`. A run log started by engine 2 must finish on engine 2: the older engine ignores unknown events and would misreport such a log.

## Live view

`graph.js view <run-dir> [--port N] [--host <address>]` serves a live page of the run. [Live view](live-view.md) covers its address, safety rules and page.

## Files

State lives in `PLUGIN_DATA`. If that isn't set, it falls back to `CLAUDE_PLUGIN_DATA`, then to `~/.srulik-toolkit`.

- `model-notes.yaml` holds the owner's notes. The project's `.agents/model-notes.yaml`, read from the run's recorded working directory, overrides it per key. Keys are globs on model IDs, and the longest matching key wins.

  ```yaml
  models:
    gpt-6.1-sol:
      prefer: [code-review]
      avoid: [ui-ux]
  ```

- `model-stats.jsonl` holds one `{t, model, kind, ok, src}` per line, with `src` set to `graph` or `thread`. It stores no text and no thread IDs.
- `arena.json` holds the LMArena cache, refreshed at most daily or when `refresh` runs.
- `score-watermark.json` records how far scoring has read: up to just before the oldest thread still undecided, so that thread is read again next time. Threads after the watermark wait too, so no outcome is counted twice. A thread waits only if it has a `model` and `kind` and was updated in the last 30 days, so one that never gets a signal can't stall scoring. `score` holds `score.lock` in the state directory while it reads the watermark, appends outcomes and moves it, so overlapping runs count each thread once. `graph.js watermark` prints it; the weekly job lists threads updated after that time, not after its own last run, so held-back threads are listed again.
- The usage file passed with `--usage` has the same shape as `aa-models usage` output: `{accounts: [{provider, windows: [{used_percent}]}], notes: []}`.

## Thread scoring

`score <threads.json>` takes threads already labeled as `{updated, model, kind, signals}` and turns them into outcomes:
- Any of `verify-confirmed-defect`, `user-redirect`, `reverted` or `redone-other-model` counts as a failure.
- Otherwise, `pr-merged` counts as a success.
- Anything else is skipped.
