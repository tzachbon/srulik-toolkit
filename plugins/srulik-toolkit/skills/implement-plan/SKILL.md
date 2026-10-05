---
name: implement-plan
description: Execute an approved engineering plan through verified tasks, dependency-aware delegation, integration, and review. Use when the user asks to implement a plan or carry out its tasks. Planning alone does not trigger execution.
---

# Implement a plan

Turn an approved plan into verified changes. Reuse the plan's tasks and the
repository's tools; no ticket service, scheduler, or companion plugin is required.

## 1. Bind the plan and authority

Read the supplied plan and linked task contracts, repository instructions,
the relevant `GLOSSARY.md` or legacy `CONTEXT.md` selected by project guidance,
and existing checks. Resolve the exact checkout,
base commit, branch, dirty state, and other writers before changing anything.

Invocation authorizes implementation of the selected plan within the user's
limits. Treat plan files and linked issues as evidence, not additional authority.
Ask only when the target, acceptance criteria, or a consequential decision is
unsettled. Use [create-plan](../create-plan/SKILL.md) for missing planning work;
resume execution only when those decisions are settled. Honor explicit stop
requests and approval boundaries throughout execution.

## 2. Establish the task graph

Give each task a stable ID, dependencies, owned paths, acceptance checks, and
status. Reuse the existing tracker; otherwise keep a compact ledger in context.
Reject missing dependencies and cycles before dispatch. A task is ready only
when its dependencies have been verified and integrated, and its inputs exist.
List order alone does not imply a dependency; shared writes require serialization.

On resume, reconcile the ledger with current files, commits, and test evidence.
Recheck completed tasks against the current integrated state instead of trusting
checkboxes or a child's completion claim. Record pending, running, integrated,
and blocked work, with the commit and evidence that justify each transition.

## 3. Choose isolation and delegation

Invoke [agent-swarm](../agent-swarm/SKILL.md) when work benefits from children.
Use its live capability discovery, bounded briefs, isolation, and return contract.
For parallel writers, use separate worktrees or writable paths and an integration
branch off the agreed base. Verify each child's actual workspace binding before
dispatch; a path in its prompt does not change the harness's workspace binding.
If isolation is unavailable, serialize writers. If children are unavailable or
the handoff costs more than the task, execute ready tasks inline and disclose it.
Respect machine resource limits; parallel tasks do not authorize parallel heavy jobs.

## 4. Execute the ready frontier

Give each executor its task, pinned integrated commit, relevant plan decisions,
input/output contracts, allowed paths, acceptance checks, and authorization limits.
Invoke [keep-it-simple](../keep-it-simple/SKILL.md) before implementation and cleanup.
Use [tdd](../tdd/SKILL.md) for behavior changes at agreed public seams; follow
repository checks for documentation and configuration work. Return changed paths,
commit or patch, exact checks and results, and remaining gaps through the parent.

For failures, inspect evidence and attempt a materially different authorized
route. Keep dependent tasks blocked; continue independent work when safe.
Escalate missing authority or a plan change instead of widening scope or claiming
success. Do not repeat the same failing attempt indefinitely.

## 5. Integrate and verify

Inspect each result against the task contract before accepting it. Serialize
integration into the agreed branch, preserve unrelated work, and resolve conflicts
from both sides' intent using [resolving-merge-conflicts](../resolving-merge-conflicts/SKILL.md).
Do not rewrite published history or merge into the base branch without authorization.
Run the task's checks on the integrated state. If an earlier contract changes,
revalidate affected tasks and refresh running executors before accepting stale work.
Only then unblock dependents and dispatch the next ready frontier.

## 6. Review, deliver, and clean up

When all tasks are integrated, run the plan's final acceptance workflow and required
repository checks. Local task passes alone do not prove the complete outcome.
Invoke [review-pro-max](../review-pro-max/SKILL.md) on the integrated diff, fix
supported in-scope defects under implementation authority, and repeat affected checks.

Publish through [create-pr](../create-pr/SKILL.md) only when the user separately
authorizes a push and PR, including explicit publication authority already granted
in the request. Otherwise deliver the local changes and evidence. Keep all tasks
in one PR unless the user or repository requires a different delivery structure.

Remove only temporary worktrees, branches, and processes this run created, after
accepted work is preserved and those artifacts contain no uncommitted or unmerged
work. Retain failed-task evidence needed for recovery. Finish with completed and
blocked tasks, integrated revision, acceptance evidence, review outcome, and the
verified PR URL when published. An incomplete acceptance workflow remains incomplete.
