# End-to-end execution on T3 Code

This workflow uses a parent-owned PR watch and bounded read-only child tasks.
Its ownership and completion rules override the standalone babysitter defaults;
do not launch a separate top-level conversation.

## Ownership handoff before registration

1. Discover prior owners with `t3_thread_list`, including `includeSubagents: true`
   and every `nextCursor` page in relevant projects. Include retained owner/task
   IDs, exact-title `Babysit PR <owner>/<repo>#<number>` matches and threads linked
   to the exact host/repository/PR; a title prefix alone is not a match. Inspect
   candidate watches with `list_thread_pull_requests` and explicit `threadId`.
   Read `t3_thread_read` for current runs, pending work, task scope and head ref;
   absence of a watch does not exclude a pending or active writer. If relevant
   owner records cannot be inspected, block instead of assuming there is no owner.
2. For each verified PR-dedicated owner, check stop authority and narrower limits.
   Send a scoped `STOP` using `t3_thread_send` with `mode: "auto"`, covering both
   maintenance and merging. Require the owning thread to cancel its verified
   PR-specific delegated writers with `task_cancel` and verify with `task_status`.
   Both tools are parent-scoped; the new main must not use the prior owner's
   task IDs with them. The owner must return task IDs, child thread IDs, terminal
   task status and `hasPendingChildRuns: false` evidence before retirement.
   If the owner cannot cancel its writers or supply verifiable evidence, block;
   interrupting or retiring the parent alone does not prove its children stopped.
   For an unconfirmed pending launch, interrupt its run
   with `t3_thread_interrupt` instead of queuing STOP behind startup. Remove any
   remaining watch with `unwatch_pull_request` and that owner's explicit
   `threadId`.
   Never interrupt a mixed-purpose thread or discard its dirty/unpublished work.
3. Wait once with `t3_thread_wait`, the retained `runId` and `timeoutMs: 60000`.
   A timeout or `interrupt_requested` is not retirement. Re-read `t3_thread_read`
   for the owner and each reported child: verify `parentThreadId` associations,
   require no `activeRunId`, no queued/pending writer work, and ended writer tasks.
   Check owner-provided task evidence against these cross-thread reads; missing
   or inaccessible child state blocks handoff. Retire the dedicated owner through
   verified rename and
   settlement or archive capabilities; if retirement cannot prevent further
   automatic wakes, block. A renamed thread alone does not prove it stopped.
4. Refresh discovery and verify each former owner's watch is absent/inactive with
   `list_thread_pull_requests` and its explicit `threadId`, its run/tasks ended,
   and its retirement state. Preserve unrelated owners and narrower authorization;
   previous merge authority is not transferred. A missing capability, unknown
   owner or unconfirmed stop is `BLOCKED: ownership handoff unverified`.
   Do not register the main watch or write to the PR while this gate is blocked.
   Remove this workflow's existing main watch while blocked; leave unrelated
   watches untouched.
   Reuse an existing main-thread watch only after excluding competing writers.
   Refresh the provider's head/base and open/closed state after the handoff;
   reconcile any intervening pushes without rewriting or discarding work.

## Main watch and event handling

1. Only after the ownership handoff passes, register the exact PR with
   `link_pull_request`, call `watch_pull_request`, and
   verify `watching: true` with `list_thread_pull_requests`. Read existing feedback
   after registration; events may cover only changes after registration. Failed
   registration is `MONITORING FAILED`, not an active monitor.
2. Discover runnable providers, models and effort options with
   `orchestrator_capabilities`, then check available quota and reset evidence.
   Prefer runnable Luna at max effort for bounded triage when supported; choose
   task fit, remaining usage, then cost, and disclose unavailable quota or fallback.
3. Use `delegate_task` with explicit `target.providerInstanceId`, `target.model`
   and discovered effort in `target.options`, `mode: "async"`, and one stable `clientRequestId` per batch. Send the
   PR URL, base/head SHA, event batch, previous deduplication ledger and a read-only
   brief: return new findings, failed checks, conflicts, readiness or closure,
   with source URLs and current-head evidence; never edit, push, reply or merge.
   Retain `taskId`; a timeout does not cancel it. Keep one active child per PR.
4. Native events wake the main agent. Child completion delivers the filtered
   result; it is not persistent child monitoring. Apply fixes in the main agent,
   then await native events. Use `task_status` for uncertain task state. Start a
   new batch with `delegate_task`, carrying the ledger; never continue a round
   with `t3_thread_send` on `childThreadId`. Do not poll or schedule a watcher.
5. Before `MERGE READY`, refresh provider evidence for the current head and base.
   Without merge authority, hand back readiness after cleanup; with explicit
   authority, merge only from fresh readiness and verify `MERGED` and issue closure.
6. On completion, closure or user STOP, call `unwatch_pull_request`, cancel any
   active child with `task_cancel`, and verify watch/task state before reporting
   monitoring stopped. Unexpected watch loss is `MONITORING FAILED`; restore it
   when possible and keep the task incomplete while monitoring is unavailable.

The current tool contract says a subagent cannot own a PR watch. This mapping
uses the documented parent watch and asynchronous child-result delivery. The
complete issue-to-merge workflow has not been exercised in a fresh session;
file checks and contract tests do not establish runtime verification.

## Waiting and questions

- A watched thread stays in Working and out of the user's inbox. Before asking the user anything or handing off, call `unwatch_pull_request`, then ask with the harness's question tool (`AskUserQuestion` in Claude Code, `request_user_input` in Codex).
- `watch_pull_request` reports conflicts but not a branch that fell behind its base. Check the merge state yourself before `MERGE READY`.
- A watch that ends with "Stopped watching, could not read it" usually means the GitHub GraphQL quota is used up. Check `gh api rate_limit --jq .resources.graphql`; if `remaining` is near 0, wait for `reset` with one background command, then watch again. Never re-watch in a tight loop.
