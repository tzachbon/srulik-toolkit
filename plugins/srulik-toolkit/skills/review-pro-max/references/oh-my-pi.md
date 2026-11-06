# review-pro-max on Oh My Pi

Oh My Pi (OMP) runs on T3 Code as an ACP provider and in its own terminal.
Observed with OMP 18.16.0 and Kimi K3.1 Pro on T3 Code, 2026-11-06.

On T3 Code, follow the [T3 Code mapping](t3-code.md) for panel choice, rounds
and result handling. OMP changes how tools are reached.

## Capability mapping

| Capability | Oh My Pi |
| --- | --- |
| Load a named skill | `read("skill://<name>")` |
| Runnable reviewer models | `orchestrator_capabilities` through `xd://mcp__t3_code_orchestrator_capabilities` |
| Reviewer launch | `delegate_task` through `xd://mcp__t3_code_delegate_task`, one per seat |
| Result delivery and cancellation | native completion delivery; `task_status`, `task_cancel` through `xd://` |
| Ledger file | OMP file tools or `bash` in the OS temporary directory |

An unprefixed `xd://<tool>` returns `No such tool`; use the `mcp__t3_code_` name.

## OMP terminal without T3 Code

OMP's own `task` children run on the session's configured models, which may
all come from one vendor. Fill only seats from distinct vendors, report the
empty seats as a coverage limit, and do not repeat a vendor.

## Verification limits

Verified: skill loading and `delegate_task` launch from OMP on T3 Code. A full
three-vendor panel launched from an OMP thread is unverified.
