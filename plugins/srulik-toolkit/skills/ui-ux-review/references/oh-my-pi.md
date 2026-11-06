# UI UX review on Oh My Pi

Oh My Pi (OMP) runs on T3 Code as an ACP provider and in its own terminal.
Observed with OMP 18.16.0 and Kimi K3.1 Pro on T3 Code, 2026-11-06.

## Capability mapping

| Capability | Oh My Pi |
| --- | --- |
| Stories, requirements, tokens, components | OMP file reads, `grep` and `glob`; scope `glob` to a directory, since a broad walk times out |
| Direct image inspection | `read` on a local image path; inspect the returned image itself |
| Browser and device tools on T3 Code | the T3 Code tools in the [T3 Code mapping](t3-code.md), reached through `xd://mcp__t3_code_<tool>` |
| Clarification | `ask` |

Follow the [T3 Code mapping](t3-code.md)'s rules for browser tabs, resource
checks, own-edit validation and image delivery; they apply to OMP on T3 Code.
In the OMP terminal without T3 Code, browser and device checks need the
project's own harness.

## Verification limits

Verified: OMP file reads and `ask`. Image inspection through `read` was
observed only for video frames. Browser, device and full application review
under OMP remain unverified until performed on the target instance.
