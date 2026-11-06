# review-pro-max on T3 Code

The current thread owns the review. Panel reviewers run as child tasks of that thread and return findings to it; they never edit, post, or start their own children.

## Capability mapping

| Capability | T3 Code |
| --- | --- |
| Runnable reviewer models | `orchestrator_capabilities`, called once per thread before the first `delegate_task` |
| Reviewer launch | `delegate_task`, one per seat, started in the same turn |
| Reasoning effort | the model's effort option in `target.options`, for example `effort`, `reasoningEffort`, or `reasoning_effort`, set to `high` |
| Result delivery | native completion delivery; follow each task's `next` |
| Cancellation | `task_cancel` with the reviewer's `taskId` |

## Choose the panel

Read `orchestrator_capabilities`. Seat each model the user named on an instance that runs it. Fill each open seat with the latest flagship model from a vendor not yet seated, where `canRunChildTask` is true. A provider instance is not a vendor: a Claude model served through the Cursor instance is still a Claude seat. Use `search` when a named model is not in the short list. Skip disabled instances. Report a named model that no runnable instance offers instead of substituting.

## Launch each round

1. Call `delegate_task` once per seat with `mode: "async"`, `role: "review"`, the default shared checkout, `target.providerInstanceId`, `target.model`, and high effort in `target.options`. Give each task a stable `clientRequestId` that includes the ledger folder name, round number, and seat.
2. Put the whole brief in `task`: the pinned state, requirements, assigned files, round number, prior ledger findings, the read-only boundary, and the content of [code-reviewer.md](../code-reviewer.md). The child has no parent history. Include no secrets.
3. Retain each `taskId`. Follow the returned `next`: while reviewers are still running, end the turn instead of polling with `task_status`, sleeps, or watchers. When a completion wakes this thread, record that reviewer's findings and score in the ledger, and finish the report once every seat has returned or failed.
4. Start each new round with new `delegate_task` calls. Never send a new round to an earlier reviewer through `t3_thread_send`.
5. Cancel a reviewer you replace or no longer need with `task_cancel`. A timed-out wait does not cancel a child; a failed or cancelled seat is incomplete coverage.

## Ledger location

Use the OS temporary directory: `$TMPDIR` on macOS, `/tmp` when `TMPDIR` is unset on Linux, and `%TEMP%` on Windows. Create the folder with mode `0700` on POSIX or an equivalent owner-only ACL on Windows. The folder persists across T3 threads on the same machine, so a rerun in another thread finds it.

## Verification status

This mapping follows the tool contracts listed by `orchestrator_capabilities` and `delegate_task`. A two-round, three-vendor panel was run through these tools when this mapping was added. Other harnesses have no mapping and are untested.
