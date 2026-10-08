# pr-babysit on T3 Code

How each [host capability](../SKILL.md#host-capabilities) maps to T3 Code's orchestration tools. The tool names may carry a harness prefix, such as `mcp__t3-code__t3_thread_launch`. Tool names and fields come from T3 Code's orchestrator tool reference.

| Capability | T3 Code |
| --- | --- |
| 1. Launch a thread | `t3_thread_launch` |
| 2. Native PR watch | `link_pull_request`, `watch_pull_request`, `unwatch_pull_request` |
| 3. Message a thread | `t3_thread_send` |
| 4. List threads by title | `t3_thread_list` |
| 5. Rename a thread | `t3_thread_update` with `action: "rename"` |
| 6. First-run outcome | `t3_thread_wait`, then `t3_thread_read` |
| Optional: settle | `t3_thread_organize` with `action: "settle"` |

## Main thread

**Lookup (step 2).** Call `t3_thread_list` with `titleContains: "Babysit PR <owner>/<repo>#<number>"` and keep only a thread whose `title` matches exactly. An active babysitter is one that is not settled (`settled: false`). Its `status` and `model` tell you whether its run failed and which model was refused. Send the new request with `t3_thread_send` and `mode: "auto"`.

**Launch (step 3).** Call `orchestrator_capabilities` for the runnable catalog, then `t3_thread_launch`:

- `title`: `Babysit PR <owner>/<repo>#<number>`
- `modelSelection`: the chosen model with its `instanceId`, for example `{ "instanceId": "codex", "model": "gpt-6-luna" }` or `{ "instanceId": "claudeAgent", "model": "claude-haiku-5-5" }`. Use the instance IDs the catalog lists on this host.
- `workspaceStrategy`:
  - Same-repository PR: `{ "type": "worktree", "baseRef": "<head ref>", "branch": "babysit/pr-<number>", "startFromOrigin": true }`.
  - Fork PR: run `git fetch <fork remote> <head ref>` first, then use the fetched local ref or head SHA as `baseRef` with `startFromOrigin: false`.
  - Existing `babysit/pr-<number>` branch: find its checkout with `t3_worktree_list` and use `{ "type": "existing_worktree", "worktreePath": "<path>", "branch": "babysit/pr-<number>" }`.
- `message`: the brief.

`t3_thread_launch` has no retry key. If the result is lost, check `t3_thread_list` before launching again. Keep the returned `threadId` and `runId`.

**Startup check (step 4).** T3 does not notify the launcher when a top-level thread's run ends. Call `t3_thread_wait` once with the launch's `threadId`, `runId`, and `timeoutMs: 120000`. A timeout returns `timedOut: true` with the latest status and does not cancel the run.

| `status` | Meaning |
| --- | --- |
| `failed` | Read the error with `t3_thread_read` (`view: "activity"`). The provider's model refusal reads like "There's an issue with the selected model (claude-haiku-5-5). It may not exist or you may not have access to it.", followed by the error item "Claude gave up after repeated API errors." |
| `cancelled`, `interrupted`, `rolled_back` | Ended without running. |
| `completed`, `running`, or `timedOut: true` | Started. |

**Retire.** Call `t3_thread_update` with `threadId`, `action: "rename"`, and the retired title. Then call `t3_thread_organize` with `action: "settle"` if the harness exposes it. T3 Code's documented orchestrator tool set does not include `t3_thread_organize`, so a build may lack it; renaming works on every build.

**Forward (step 5).** Use `t3_thread_send` with `mode: "auto"`. An idle babysitter has no active turn, and `steer` fails on it.

## Babysitter

- **Start:** `link_pull_request` and `watch_pull_request` with the PR URL, then confirm with `list_thread_pull_requests`. Only a top-level thread can own a watch, which is why the babysitter is launched with `t3_thread_launch` and not `delegate_task`. A watch wakes the thread with an `Update on pull request #<number>` message only for comments posted after registration.
- **Messages to the main thread:** `t3_thread_send` with the main thread's ID from the brief.
- **Stop:** `unwatch_pull_request`, then `t3_thread_update` with `action: "rename"` and no `threadId` (it defaults to the calling thread), then `t3_thread_organize` with `action: "settle"` if available.
- T3 Code also ends a watch when the PR merges or closes, when the thread settles or is archived, or after 8 consecutive read failures. Report an unexpected end as `MONITORING FAILED`.

## Verified behavior

Observed on one T3 Code host on 2026-10-08 with controlled probe threads in a scratch project:

- A `claude-haiku-5-5` launch that the provider refused reached `failed` in about one second, with the refusal text above.
- Before retirement, the exact-title lookup found that failed, unsettled thread. After a rename alone, it found nothing.
- A `gpt-6-luna` replacement under the same title completed, and the lookup then found only it.
- A 3-second `t3_thread_wait` on a running `gpt-6-luna` thread returned `running` with `timedOut: true`. The run then completed.

Not observed: a full babysitter following this skill on a real PR, and a T3 build without `t3_thread_organize`.
