# Coding standards

## Layout

- `.claude-plugin/`, `.agents/plugins/`, and `plugins/srulik-toolkit/.{claude,codex}-plugin/`: marketplace and plugin manifests.
- `scripts/validate.sh`: the repository's single check, run by CI on Linux, macOS, and Windows. Its contract checks live in `scripts/validate/<n>_<area>.py`, run in order in one namespace; keep each part under 20 KB and add a new part rather than growing one past that.
- `research/`: dated research notes behind past decisions.

## Legacy skills

Some older skills still name Claude Code or Codex directly. Move host-specific text into a reference when you next change such a skill, not as a separate sweep.

## Utilities

Utilities in `plugins/srulik-toolkit/scripts/` use only the Node.js standard library. Resolve paths from the plugin root, never the caller's working directory. Read state from `PLUGIN_DATA`, falling back to `CLAUDE_PLUGIN_DATA`, then a temporary directory. An optional external service needs a user-supplied key only when it requires authentication: exit with code 2 when a required key is missing so callers fall back. Add attribution to [NOTICE.md](NOTICE.md).

## Validation and pull requests

- Test utilities in `scripts/validate.sh` against local fakes, never live paid services.
