# End-to-end execution on T3 Code

This workflow uses a parent-owned PR watch and bounded read-only child tasks.
Its ownership and completion rules override the standalone babysitter defaults;
do not launch a separate top-level conversation.

1. Register the exact PR with `link_pull_request`, call `watch_pull_request`, and
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
