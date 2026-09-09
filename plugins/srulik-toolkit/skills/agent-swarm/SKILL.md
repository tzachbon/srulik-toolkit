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

1. Split work into independent, self-contained tasks.
2. Classify each task by cost, complexity, risk, and tool needs.
3. Choose a supported model and effort from active routing rules and live
   inventory. Set them explicitly when the transport accepts them. Otherwise,
   record the harness default.
4. Dispatch all ready independent tasks in the same tool turn, bounded by live
   capacity.
5. Record each child, task, transport, model or default, state, and return
   handle in the ledger.

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
