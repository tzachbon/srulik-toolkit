# Srulik Toolkit agent guide

Before changing a skill, utility, hook, manifest or validation contract, read [CODING_STANDARDS.md](CODING_STANDARDS.md) and follow this guide. Before opening a PR, read [CONTRIBUTING.md](CONTRIBUTING.md) for validation, versions and evidence.

Edit skill sources under `plugins/srulik-toolkit/skills/` in this repository. Installed plugin caches are runtime copies; verify their version separately when investigating installed behavior.

## Purpose

- Generic across providers and agent harnesses.
- A streamlined path from request to merged change.
- Reusable skills and utilities.

## Generic core, host-specific references

Write a skill's `SKILL.md` in terms of capabilities, not one harness's tools: "launch a thread with a chosen model", not a specific tool call. Put concrete tool names, fields, statuses, and lifecycle limits for one provider or harness in a reference file beside the skill, and link it from the core.

[`pr-babysit`](plugins/srulik-toolkit/skills/pr-babysit/SKILL.md) is the model. Its core lists the host capabilities it needs and what to do when each is missing. [`references/t3-code.md`](plugins/srulik-toolkit/skills/pr-babysit/references/t3-code.md) maps them to T3 Code's tools and records what was observed live. To support another harness, add a reference beside it; do not edit the core to fit one host.

When a required capability is missing, the skill reports which one and stops or degrades as its core describes. On a harness with no reference, a skill shows its capability mapping, says it is untested, and acts only after the user confirms. Never claim support for a harness that no reference documents or nobody has tested; say what is unverified.

## Where new work fits

| Stage | Skills | Add here when a skill or utility |
| --- | --- | --- |
| Understand and plan | `can-you-help`, `to-project`, `research`, `tour`, `show-me`, `create-plan`, `keep-it-simple` | clarifies a request or produces a decision or plan |
| Implement | `implement-plan`, `execute-task-end-to-end`, `tdd`, `agent-swarm`, `stay-in-scope` | executes an approved plan or keeps execution on track |
| Verify and ship | `review-pro-max`, `create-pr`, `pr-babysit`, `fix-ci`, `resolving-merge-conflicts`, `stop-slop`, `retro` | checks, publishes, or maintains the result |

Prefer extending an existing skill over adding a new one. A new skill needs a distinct trigger, a handoff to its neighbors in this flow, and a row in the README's skill table.

## Keeping the boundaries

- Encode each skill's contract in `scripts/validate.sh`: the phrases that carry its behavior, the phrases it must no longer contain, and, for a generic core, the host-specific names it must not mention. A reference gets its own contract.
- Break each new check once on purpose and confirm validation fails.
