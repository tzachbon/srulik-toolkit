# Srulik Toolkit agent guide

Read this before changing the toolkit. [CONTRIBUTING.md](CONTRIBUTING.md) covers setup, versioning, and pull requests; this file covers what the toolkit is for and where new work belongs.

## Purpose

1. **Generic across providers and agent harnesses.** A skill describes behavior an agent can follow on any model and in any harness that offers the capabilities it needs. Claude Code and Codex are the packaged targets today; other harnesses are supported only where a skill documents and tests them.
2. **A streamlined path from request to merged change.** Skills turn a request into a plan, carry the plan out, and verify the result, with each step handing off to the next.
3. **Reusable skills and utilities.** Each skill works on its own and stays small. Shared helpers live in one place and degrade gracefully when an optional dependency is missing.

## Layout

- `plugins/srulik-toolkit/skills/<name>/SKILL.md`: one skill per directory. Supporting files sit beside it, usually in `references/`.
- `plugins/srulik-toolkit/scripts/`: utilities skills call, such as [`models.js`](plugins/srulik-toolkit/scripts/models.js).
- `plugins/srulik-toolkit/hooks/`: session hooks.
- `.claude-plugin/`, `.agents/plugins/`, and `plugins/srulik-toolkit/.{claude,codex}-plugin/`: marketplace and plugin manifests.
- `scripts/validate.sh`: the repository's single check, run by CI on Linux, macOS, and Windows.
- `research/`: dated research notes behind past decisions.

## Generic core, host-specific references

Write a skill's `SKILL.md` in terms of capabilities, not one harness's tools: "launch a thread with a chosen model", not a specific tool call. Put concrete tool names, fields, statuses, and lifecycle limits for one provider or harness in a reference file beside the skill, and link it from the core.

[`pr-babysit`](plugins/srulik-toolkit/skills/pr-babysit/SKILL.md) is the model. Its core lists the host capabilities it needs and what to do when each is missing. [`references/t3-code.md`](plugins/srulik-toolkit/skills/pr-babysit/references/t3-code.md) maps them to T3 Code's tools and records what was observed live. To support another harness, add a reference beside it; do not edit the core to fit one host.

When a required capability is missing, the skill reports which one and stops or degrades as its core describes. Never claim support for a harness that no reference documents or nobody has tested; say what is unverified.

Some older skills still name Claude Code or Codex directly. Move host-specific text into a reference when you next change such a skill, not as a separate sweep.

## Where new work fits

| Stage | Skills | Add here when a skill or utility |
| --- | --- | --- |
| Understand and plan | `can-you-help`, `to-project`, `research`, `tour`, `show-me`, `create-plan`, `keep-it-simple` | clarifies a request or produces a decision or plan |
| Implement | `implement-plan`, `tdd`, `agent-swarm`, `stay-in-scope` | executes an approved plan or keeps execution on track |
| Verify and ship | `review-pro-max`, `create-pr`, `pr-babysit`, `fix-ci`, `resolving-merge-conflicts`, `stop-slop`, `retro` | checks, publishes, or maintains the result |

Prefer extending an existing skill over adding a new one. A new skill needs a distinct trigger, a handoff to its neighbors in this flow, and a row in the README's skill table.

Utilities in `plugins/srulik-toolkit/scripts/` use only the Node.js standard library. Resolve paths from the plugin root, never the caller's working directory. Read state from `PLUGIN_DATA`, falling back to `CLAUDE_PLUGIN_DATA`, then a temporary directory. An optional external service needs a user-supplied key: exit with code 2 when it is missing so callers fall back, and add attribution to [NOTICE.md](NOTICE.md).

## Keeping the boundaries

- Encode each skill's contract in `scripts/validate.sh`: the phrases that carry its behavior, the phrases it must no longer contain, and, for a generic core, the host-specific names it must not mention. A reference gets its own contract.
- Break each new check once on purpose and confirm validation fails.
- Test utilities in `scripts/validate.sh` against local fakes, never live paid services.
- Before opening a pull request, run `./scripts/validate.sh` and `git diff --check`, then follow [CONTRIBUTING.md](CONTRIBUTING.md) for versions and evidence.
