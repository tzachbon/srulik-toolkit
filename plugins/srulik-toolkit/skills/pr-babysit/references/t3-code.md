# pr-babysit on T3 Code

The original thread owns the PR watch. `delegate_task` creates the babysitter as a child of that thread. The child cannot own a PR watch, so it filters bounded evidence and returns findings; its parent applies fixes and performs authorized merges. No separate babysitter conversation is created.

## Capability mapping

| Capability | T3 Code |
| --- | --- |
| Runnable child models | `orchestrator_capabilities`; honor provider constraints and available effort options |
| Parent watch | `link_pull_request`, `watch_pull_request`, `unwatch_pull_request`; inspect with `list_thread_pull_requests` |
| Child launch and result delivery | `delegate_task`, native completion delivery, `task_result`, `t3_thread_read` |
| Task state and cancellation | `task_status`, `task_cancel`; pending input through the host's native request tools |
| Existing ownership | `t3_thread_list`, `list_thread_pull_requests`, `t3_thread_read` |

## Ownership before monitoring

Use the existing [ownership handoff](../../execute-task-end-to-end/references/t3-code.md#ownership-handoff-before-registration), including discovery of legacy dedicated owners, pending launches and writer descendants. That section describes stopping prior owners, not launching another conversation. Retain and reuse only this parent's verified watch/task handles. Block new watching and writes until competing owners have been verifiably retired; preserve unrelated conversations and unpublished work.

## Parent watch and child batches

1. Resolve the PR and complete ownership handoff. Read all existing feedback and checks, then run the initial catch-up batch. Finish any maintenance push before registering a new watch.
2. Call `delegate_task` with `mode: "async"`, a stable `clientRequestId` for the batch, the chosen `target.providerInstanceId` and `target.model`, and supported effort in `target.options`. Keep the read-only child in the parent checkout; no independent checkout is needed. Its brief pins the base/head, event batch and prior ledger, and says never edit, push, reply, resolve threads, merge, or register a watch.
3. Retain `taskId` and `childThreadId`. Read the child's durable metadata when ancestry needs verification: `parentThreadId` matches the original thread and `relationshipToParent` is `subagent`. A different root conversation is a failed launch contract, not a valid babysitter. Follow the returned `next`: completion wakes the original thread, so end the turn instead of polling it. A timed-out wait does not cancel the child.
4. Link the PR with `link_pull_request` when required. Once the initial catch-up and writes are finished, call `watch_pull_request` in the original thread and require `watching: true` in its response. That tool requires ending the turn immediately after registration; do not make another tool call to inspect the watch afterward. On a wake, reuse the existing watch rather than registering again. If a child launch's `next` already requires ending the turn, yield for its completion and finish catch-up before registering the PR watch.
5. On a PR event or child completion, refresh the live PR first. Inspect the completed result through the host's delivery/result mechanism, then verify each finding against the current head. A completed child does not end the parent's PR watch. Keep one active child per PR and accumulate later events for the next batch. Create each new round with a new `delegate_task` and a new batch key, retaining the previous ledger. Do not send another round through `t3_thread_send` on `childThreadId`. The parent owns every maintenance mutation and merge.
6. On STOP or closure, call `task_cancel` for this parent's active child and `unwatch_pull_request` for this parent's PR watch. Verify terminal task state and `hasPendingChildRuns: false` from task state/result evidence; use cancellation verification, not a status-polling loop. A pending question, failed run or timeout is not proof of cleanup. Do not rename or settle the original thread.

## Native waiting and failure handling

A watched thread remains Working between PR events. Pending child completion also returns to the original thread; it does not transfer monitoring to the child. Only the parent calls the watch tools.

`watch_pull_request` reports conflicts but not a branch that fell behind its base. Refresh the current head and base before readiness or merging, even when the watch has reported no conflict.

A failed watch registration or unexpected loss is `MONITORING FAILED`; restore native monitoring when possible and otherwise keep the task incomplete. Check quota with `gh api --hostname <host> rate_limit` and use the provider's other available API interface when appropriate. Never re-watch in a tight loop; do not create a sleep, poller or scheduler. Before asking a user question, suspend this watch if it hides input-needed work and use the native question capability. Re-register after the answer when monitoring is still required.

The tool contracts support parent watches and parent-visible child results. The full standalone lifecycle has not been verified on the original Mac; source checks and a bounded child probe do not prove its native waiting indicator. That runtime verification is tracked separately from source acceptance.
