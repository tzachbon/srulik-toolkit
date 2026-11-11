---
name: agent-swarm
description: Coordinate delegated work through the child-agent capabilities available in the current harness. Use when the user asks to spawn agents, delegate, swarm, parallelize, race approaches, or when active instructions require an orchestrator and worker split. Does not require Traycer, a specific provider, or a fixed model.
---

# Agent swarm

The parent coordinates with the user, frames the work, delegates executable
tasks, tracks evidence, verifies results, and reports one answer. Children do
the bounded work.

Use the delegation transport exposed by the current harness. Treat providers,
models, tool names, response identifiers, storage, and concurrency as runtime
capabilities, not requirements of this skill.

## Parent execution boundary

Keep the parent focused on scope, routing, coordination, verification,
integration, and synthesis. Delegate a task when a child can receive a
self-contained brief and the handoff costs less than the work.

The parent may perform a one-step lookup needed to choose the split, inspect
live capabilities, resolve a dependency between tasks, or verify a returned
claim. A task stays inline when it is genuinely one-step, interactive, or too
small to justify a handoff.

## Portability contract

Before fan-out, inspect the current instructions and available tools for these
capabilities:

1. Create, spawn, fork, or delegate a child.
2. Send a brief or follow-up message.
3. Wait for or read child status and results.
4. Interrupt, retry, or replace failed work.
5. Isolate parallel writers with worktrees, branches, or separate paths.

Use the harness-native transport unless active routing rules select another
configured transport. Use a model CLI only when the user or active routing
rules authorize it. Follow the live tool schema instead of assuming an API
from another harness.

If the environment exposes no child-agent transport, state that no swarm ran.
Keep the task tree and execute ready tasks serially only when that remains
inside the user's request. Never claim delegation from a plan, process launch,
or child-local completion alone.

Use the current plan or task tracker as the ledger. If none exists, keep a
compact ledger in working context. Create durable files only when the user asks
for them or project instructions require them.

## Phase 1: Frame

### Bind the work

State:

1. The requested outcome and done predicate.
2. The exact scope, exclusions, and authorized actions.
3. The artifact or report the swarm must return.
4. The evidence needed for acceptance.
5. The stop condition or user decision that would block progress.

Resolve discoverable facts with read-only inspection. Ask one concise question
only when two plausible answers would change the scope or an external action.

### Choose the work shape

| Shape | Use when | Assignment |
| --- | --- | --- |
| Slice | Independent areas need different work | One bounded area per child |
| Race | The same problem needs competing approaches | The same brief for every child |
| Mixed | Independent areas include one contested choice | Slices plus two or more race arms |

For a race or mixed shape, declare the selection rule before dispatch:

| Rule | Use when |
| --- | --- |
| First pass | The first result that meets acceptance can ship |
| Rank all | Every result matters and the parent must compare them |
| Best of | Every arm finishes and one winner will be selected by evidence |

Derive the child count from the work shape, available capacity, quota, and the
need to reserve a verifier. The number is a task choice, not a fixed property
of the harness.

### Isolate shared state

Parallel writers receive separate worktrees, branches, or writable paths.
Pin each child to a commit, branch, snapshot, or named external state. Serialize
work that shares a browser session, database, port, mutable service, or contract
that cannot be isolated.

Frame is complete when every child can work without guessing at scope, state,
or acceptance.

## Phase 2: Fan out

Every delegation runs as a graph, so the owner can watch it in the live view.
Write a small spec for the chosen shape into the run directory and run it in
[graph mode](#graph-mode):

- slice: one agent node fanned out over the slices;
- race: one agent node fanned out over the arms with the same brief, then a
  `parent` node that applies the selection rule;
- verifier: an agent node with `differ_from` naming the node it checks.

A child whose brief carries a `graph` path is already inside a graph. It runs
any swarm of its own as a graph too, without starting a view; only the
top-level orchestrator serves the view, and the nested run shows there as the
child's one card.

1. Split work into independent, self-contained tasks.
2. Classify each task by cost, complexity, risk, and tool needs.
3. Follow [Model selection](#model-selection) for each executor and reviewer.
   Set the provider, model, and effort explicitly when the transport accepts them;
   otherwise record the harness default and its limits.
4. Dispatch all ready independent tasks in the same tool turn, bounded by live
   capacity.
5. Record each child, task, transport, model or default, state, and return
   handle in the ledger.

### Model selection

An explicit user choice or active routing rule takes precedence; apply the
ranking below only to choices they leave open. If a required model is unavailable,
report that constraint instead of substituting another model.

Run `node <plugin root>/scripts/models.js` before selecting a model; the plugin
root is two directories above this skill file. It reads the public Artificial
Analysis dataset without an API key, with a 24-hour cache and background refresh.
`list --provider <name>` filters creators; `usage` reads the host's quota adapter
when available, otherwise quota remains unknown; see [Host usage](references/host-usage.md).
On a fetch failure, use a host
benchmark tool or disclose the missing score evidence and use judgment. Check data freshness and
match scores to the actual reasoning effort, not the family's best score.

Choose by task fit, then remaining usage, then cost. Assess complexity, ambiguity,
dependencies, and consequences of a wrong result. Bounded mechanical work can use
a cheaper model; architectural decisions, security boundaries, and difficult
reviews need stronger reasoning. Diff size alone does not establish difficulty.
Scores inform this assessment; there is no universal score cutoff. Honor the
user's model exclusions and task-specific score floors.

Compare only runnable candidates. Read remaining usage and reset times when the
host exposes them; unknown quota stays unknown. Prefer a suitable provider with
more headroom before optimizing price. Reassess the choice when review findings
reveal greater complexity or usage limits change. If no available model fits the
task, report that constraint rather than silently lowering the quality bar.
Record the selected model and effort, score evidence, usage limits, and rationale.

### Child brief

Every child brief contains six parts:

```text
Goal: [one-sentence outcome and completion criterion].

Scope: [systems, files, or questions]. Out of scope: [explicit boundary].

Pinned state: [commit, branch, dirty state, snapshot, or shared mutable state].

Context it cannot derive: [settled decisions, constraints, available tools,
and its slice or race arm].

Skill: [the narrow specialist skill to use, if one applies].

Report: [verdict, evidence, commands, file lines, artifacts, and gaps].
Return the result through the parent-visible reply mechanism. Child-local
completion is not delivery.
```

Require `PASS`, `ISSUES`, or `BLOCKED` in each return. Record the transport's
task id, response id, cursor, or other delivery proof when it provides one.

Children may delegate an independent subtask when their harness supports it.
They must preserve the same scope, isolation, evidence, and return contract and
report descendant results to their parent.

## Phase 3: Aggregate

Read each returned result. Accept it only when it includes:

- the requested verdict;
- evidence for every consequential claim;
- the pinned state it examined or changed;
- parent-visible delivery proof when the transport exposes one.

Apply the declared rule:

| Shape | Acceptance rule |
| --- | --- |
| Slice | Every required slice has an accepted result |
| Race | Apply first pass, rank all, or best of |
| Mixed | Accept each slice, then apply the race rule to race arms |

If a child exceeds its expected window, use the harness wait or status
capability. Send one bounded follow-up asking for a result, status, and concrete
estimate. If the child remains silent, mark the dropout and retry with another
model, another transport, or a smaller split. Continue with fewer children only
when the remaining evidence still covers the done predicate.

Add an independent verifier for code changes, security or permission
boundaries, architecture decisions, externally visible writing, conflicting
results, or any mutation whose failure would be costly. A verifier tests the
artifact and tries to refute the claim. It does not repeat the author's brief
as a second opinion.

## Graph mode

Every swarm runs here. A graph costs one child per agent node instance, so
choose the `cheap` tier for bounded mechanical nodes. A graph is a YAML file;
read [graph spec](references/graph-spec.md) for its keys, the YAML subset, loops,
parent tasks, model resolution, and the run log. Two graphs are bundled:
`graphs/task.yaml` runs one task from the request to its terminal state, and
`graphs/pr-review.yaml` reviews one pull request.

The parent is the orchestrator. Run the plugin's `scripts/graph.js` by its
absolute path (the plugin root is two directories above this skill's directory, so `scripts/graph.js` is at `../../scripts/graph.js` from it) from
the project the graph works on. The first `next` records that directory, and
every command and write in the run executes there; pass `--cwd` to choose
another.

1. `check` the spec. Fix every reported error before any child starts.
2. Start `view` on a new run directory and open the printed local page for the
   owner. Run it on one fixed port and leave it running after the run ends; before starting it, stop the earlier
   `view` on that port, so a machine runs only one.
3. Loop: `next` returns ready tasks. Run each `run` task with `exec`. For each
   agent task, `pick` a model from the runnable models and current quota,
   delegate the task to a child with exactly that provider, model and effort,
   then record the child's JSON with `done`, including the task's `attempt` and
   `round`. Do each `parent` task yourself: ask the owner, wait on a watch, push,
   post, or merge, as its prompt says, then record its JSON with `done`. To
   reject, such as an owner who declines the plan, record it failed with
   `final: true`, which stops everything after it. `next` returns an open parent
   task again, marked `resumed`, until it is recorded. An agent task is offered
   once; after a break that lost it, `next --resume` also returns open agent
   tasks, marked `resumed`, so check whether their child is still running before
   delegating again. A `resumed` task is
   continued, never restarted: check the target first, such as whether the
   comment, issue, PR or merge already exists. When only parent tasks that wait
   on a host event remain, end the turn with the watch active and call `next`
   when it wakes you. Loops start the next round on their own; rounds and
   `skipped` nodes need no action.
   Give each child its task's `graph` path, the run index of every node's status
   and output file, and tell it that it may return `attachments` beside its output.
4. Apply each write that `done` or `exec` returns with `apply`. Writes declared by the
   graph are applied automatically; never post one by other means. If `apply`
   reports an unknown outcome, check the target and record it with `--mark`
   instead of running the write again.
5. Finish with `status` and report what completed, what degraded, what gates
   dropped, which writes applied, and which branches were blocked.

When `pick` reports `BLOCKED` only because `differ_from` excluded every runnable
creator, as on a host with one provider, run `pick` again with
`--fallback same-creator`. The run log then records `independence: same-creator`;
say in the report that the review was not independent. Never record a model
`pick` did not choose, and never use the fallback for any other block.

When a child fails, retry once with the failure reason in its brief. If it
fails again, `pick` again with that model excluded and retry once more. Then
record the failure as final. A child that cannot start is a final failure. A
final failure blocks only the work that depends on it; keep running
independent branches. Stop only when nothing more can run.

When the owner states an opinion about a model's strengths or weaknesses for a
kind of work, record that opinion in the model notes file as `prefer` or `avoid`
for that kind, with the conversation as its source, and confirm in one line.

Host details, such as how to list runnable models, read quota, delegate, open
the page, and schedule the refresh and scoring jobs, live in the host
reference beside this skill, such as [this one](references/t3-code.md). On a host without a reference,
show the capability mapping, say graph mode is untested there, and proceed
only after the owner confirms.

## Phase 4: Report

Close ledger items only after the parent accepts their evidence. Report one
consolidated result, not raw child transcripts.

Include:

| Section | Content |
| --- | --- |
| Results | Child or task, slice or arm, verdict, and one-line outcome |
| Issues | Evidence-backed findings that affect the request |
| Gaps | Dropouts, thin evidence, uncovered scope, or blocked authority |
| Selection | Race rule and why the selected result won, when applicable |
| Artifacts | Changed files, worktrees, reports, or durable task records |

The swarm is complete when the goal-level acceptance evidence passes, required
results have returned through parent-visible channels, and no authorized work
remains. If completion needs new authority or user input, report the exact
blocker and stop.
