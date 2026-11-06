# pr-babysit on Oh My Pi

Oh My Pi (OMP) runs on T3 Code as an ACP provider and in its own terminal.
Observed with OMP 18.16.0 and Kimi K3.1 Pro on T3 Code, 2026-11-06.

On T3 Code, follow the [T3 Code mapping](t3-code.md) for ownership, the parent
watch, child batches and cleanup. OMP changes how tools are reached, not the
workflow.

## Capability mapping

| Capability | Oh My Pi |
| --- | --- |
| Load a named skill | `read("skill://<name>")` |
| T3 Code tools | Read the schema at `xd://mcp__t3_code_<tool>`, then call it through `xd://`; an unprefixed `xd://<tool>` returns `No such tool` |
| Parent watch | `watch_pull_request`, `unwatch_pull_request`, `link_pull_request`, `list_thread_pull_requests` through `xd://`; present only in a top-level thread |
| Child launch and results | `delegate_task`, native completion delivery, `task_status`, `t3_thread_read`; `task_result` is not exposed |
| Questions | `ask` |

## Top-level thread only

Run the babysitter's parent in a top-level OMP thread on T3 Code. A delegated
OMP child cannot own a PR watch, like any T3 Code child. If a child is asked to
babysit, it reports `BLOCKED: no native PR watch` and stops. A polling loop,
sleep, shell watcher or scheduler does not supply the missing watch.

The OMP terminal without T3 Code has no native PR watch. Report the missing
capability and stop.

## Verification limits

Verified: tool presence in a top-level OMP thread and absence in a delegated
OMP child. A top-level OMP thread registered a watch on a real PR
(`watching: true`), saw it in `list_thread_pull_requests`, and removed it
(`watching: false`). Event delivery that wakes an OMP thread after its turn
ends is unverified.
