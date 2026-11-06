# End-to-end execution on Oh My Pi

Oh My Pi (OMP) runs on T3 Code as an ACP provider and in its own terminal.
Observed with OMP 18.16.0 and Kimi K3.1 Pro on T3 Code, 2026-11-06.

On T3 Code, follow the [T3 Code mapping](t3-code.md) for ownership handoff,
the main watch, child batches and cleanup. This file maps OMP's tool names.

## Capability mapping

| Workflow need | Oh My Pi |
| --- | --- |
| Invoke `$srulik-toolkit:<skill>` | `read("skill://<skill>")`, then follow it |
| Ask the user | `ask` |
| T3 Code tools | `xd://mcp__t3_code_<tool>`; an unprefixed `xd://<tool>` returns `No such tool` |
| Main PR watch | `watch_pull_request` and `unwatch_pull_request` through `xd://`; present only in a top-level thread |
| Read-only child batches | `delegate_task` through `xd://` |

## Where to run

Run this workflow in a top-level OMP thread on T3 Code. A delegated OMP child
cannot own the main watch: it completes the plan, issue, implementation and PR,
then reports `BLOCKED: no native PR watch` at step 5. The OMP terminal without
T3 Code stops at the same point.

## Verification limits

Verified: skill loading, `ask`, and PR tool presence in a top-level OMP thread.
A full run from plan to `MERGE READY` under OMP is unverified.
