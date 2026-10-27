# Coding standards

## Purpose

1. **Generic across providers and agent harnesses.** A skill describes behavior an agent can follow on any model and in any harness that offers the capabilities it needs. Claude Code and Codex are the packaged targets today; other harnesses are supported only where a skill documents and tests them.
2. **A streamlined path from request to merged change.** Skills turn a request into a plan, carry the plan out, and verify the result, with each step handing off to the next.
3. **Reusable skills and utilities.** Each skill works on its own and stays small. Shared helpers live in one place and degrade gracefully when an optional dependency is missing.

## Layout

- `plugins/srulik-toolkit/skills/<name>/SKILL.md`: one skill per directory. Supporting files sit beside it, usually in `references/`.
- `plugins/srulik-toolkit/scripts/`: utilities skills call, such as [`models.js`](plugins/srulik-toolkit/scripts/models.js).
- `plugins/srulik-toolkit/hooks/`: session hooks.
- `.claude-plugin/`, `.agents/plugins/`, and `plugins/srulik-toolkit/.{claude,codex}-plugin/`: marketplace and plugin manifests.
- `scripts/validate.sh`: the repository's single check, run by CI on Linux, macOS, and Windows. Its contract checks live in `scripts/validate/<n>_<area>.py`, run in order in one namespace; keep each part under 20 KB and add a new part rather than growing one past that.
- `research/`: dated research notes behind past decisions.

## Legacy skills

Some older skills still name Claude Code or Codex directly. Move host-specific text into a reference when you next change such a skill, not as a separate sweep.

## Utilities

Utilities in `plugins/srulik-toolkit/scripts/` use only the Node.js standard library. Resolve paths from the plugin root, never the caller's working directory. Read state from `PLUGIN_DATA`, falling back to `CLAUDE_PLUGIN_DATA`, then a temporary directory. An optional external service needs a user-supplied key only when it requires authentication: exit with code 2 when a required key is missing so callers fall back. Add attribution to [NOTICE.md](NOTICE.md).

## Validation and pull requests

- Test utilities in `scripts/validate.sh` against local fakes, never live paid services.
- Before opening a pull request, run `./scripts/validate.sh` and `git diff --check`, then follow [CONTRIBUTING.md](CONTRIBUTING.md) for versions and evidence.
