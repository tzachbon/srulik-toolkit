# Graph spec

A graph is a YAML file that `scripts/graph.js` checks, schedules and records.
The parent agent runs the graph; the scripts never call a model.
[`graphs/pr-review.yaml`](../graphs/pr-review.yaml) is the bundled example.

## Keys

| Key | Allowed on | Meaning |
| --- | --- | --- |
| `name` | spec | `[a-z0-9-]+`, required. |
| `inputs` | spec | Default input values. `inputs` is reserved, so no node may use that name. Override with `next --input k=v`. Values starting with `-` are refused. |
| `limits.max_agents` | spec | Required. The most agent instances the run may start. Retries and `run` nodes don't count. |
| `limits.explore` | spec | `true` or `false`, default `true`. Allows sampling on gated nodes that aren't verifiers. |
| `writes.<name>` | spec | Name matches `[a-z0-9-]+`. `{max, run}`. `run` is an argument list that may contain `"${inputs.<k>}"` and `"${file}"` as whole elements. |
| `run` | node | An argument list run without a shell. Elements may be `"${inputs.<k>}"` as whole elements. Output: `{text: stdout}`, so `out` may list only `text`. |
| `agent` | node | The child's prompt. `{item}` becomes the current item: a string as-is, anything else as JSON. `${p.f}` becomes the value from a single-instance producer, or the JSON list of surviving values from a fan-out producer. |
| `kind` | agent node | `code`, `code-review`, `debugging` (debugging, reverse-engineering, configuring apps, working around restrictions), `architecture`, `ui-ux`, `agentic` (default), `reasoning`, `long-context` or `writing`. |
| `in` | node | `${node.field}` reference, or a list of them. Adds an edge. A `run` node's only field is `text`. |
| `needs` | node | Node names to wait for. Adds edges. |
| `for_each` | agent node | A literal list, or a `${node.field}` reference to a list. |
| `pick` | agent node | `{tier, differ_from}`. `tier` defaults to `standard`. `differ_from` names an agent node and adds an edge. When this instance's item came from that node, only the creator of the instance that produced it is excluded; otherwise every creator that node used is excluded. Each producer instance counts only its latest pick, the attempt that produced its result. |
| `model` | agent node | `"<model-id> @ <effort>"`. Pinned, but still subject to `avoid`, exclusions and quota. Can't be combined with `pick`. |
| `out` | agent node | Fields the child's JSON must contain. |
| `gate` | node with `out` | `field == literal`, where the literal is `true`, `false`, a number or a `"string"`. A failing item is dropped. |
| `write` | node | A `writes` entry. The node's `output.body` becomes the file; for a `run` node, its stdout (`text`) does. Only results that survive their gate reserve a write. |

Any other key is an error.

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
- `needs: [p]` gives `input.p = [{index, item, output}]` over the surviving instances. The list may be empty; an empty review is still a result.

## Scheduling

- A node is ready when every node it depends on has settled. A node is settled when it has a result, a final failure, a gate drop, or a block.
- The first `next` records the working directory (`--cwd`, default the caller's). Every `run` node and every write executes there.
- `next` and `done` hold `<run-dir>/run.lock` while they read and append, so parallel calls never act on the same stale state. A lock whose recorded process is gone is cleared under a short `run.lock.reclaim` guard, so two processes clearing the same dead lock never remove a lock one of them just took.
- Each attempt is offered once. A failure report for an attempt already reported is ignored. Pass the task's `attempt` in every result, success or failure, so a late report for an older attempt is ignored.
- Runtime fan-out is admitted once. Admission reserves the static instance count of every other agent node not yet admitted, so the total never passes `max_agents`. The overflow is logged as `cap-skipped`.
- A final failure blocks a consumer only when the producer was a single instance, or when every one of its instances failed.
- `status` returns `running` until every node settles. After that it returns:
  - `blocked`, when every sink failed or was blocked;
  - `partial`, after any final failure, cap skip or unapplied write;
  - `done` otherwise.

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

   If nothing is left, the result is `BLOCKED`.
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
| `spec` | name, nodes, edges, inputs, cwd |
| `admit` | node, count, items |
| `dispatch` | node, index, attempt, taskType, item, src |
| `pick` | node, index, provider, model, effort, creator, explored, reason |
| `result` | node, index, output, model and provider (from `done`, else from this instance's latest `pick`), write (the reserved write, if any: id, name, file, argv), dropped (when the gate failed) |
| `failed` | node, index, attempt, reason, final |
| `gate-dropped` | node, index (for the live view; the result event's `dropped` is authoritative) |
| `cap-skipped` | node, count |
| `outcome` | node, index, model, kind, ok |
| `blocked` | node, cause |
| `write-claimed` | id (the write is now `applying`) |
| `write-applied` | id, marked |
| `write-failed` | id, reason |
| `end` | state |

## Live view

`graph.js view <run-dir> [--port N] [--host <address>]` serves a page that replays `run.jsonl` and streams new events. It listens on `127.0.0.1` unless `--host` names one literal loopback or private address: `10/8`, `172.16/12`, `192.168/16`, Tailscale's `100.64/10`, or IPv6 `::1` or `fc00::/7`. Host names, public addresses and every spelling of `0.0.0.0` or `::` are refused, because the page has no login. Requests whose `Host` header names any other address get 403, so a page on another site can't reach it through DNS rebinding.

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
