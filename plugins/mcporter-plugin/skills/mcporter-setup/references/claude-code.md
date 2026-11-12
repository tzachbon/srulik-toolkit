# Claude Code mapping for mcporter-setup

What `scripts/setup.js` reads and writes for Claude Code. All paths move under
`CLAUDE_CONFIG_DIR` when it is set (`<dir>/settings.json`, `<dir>/.claude.json`).

## Where servers are read

Each file is imported on its own, in mcporter 0.17's order, so a different
definition in another file is seen:

- the project's `.claude/settings.local.json`, `.claude/settings.json`, `.claude/mcp.json`;
- the same three files in `~/.claude/`;
- `~/.claude.json` (user scope, plus one block per project for local scope);
- the project's `.mcp.json` (mcporter's own claude-code import skips it).

## How a migrated copy is switched off

Claude Code keeps every entry; these switches stop it from loading. They are
the same ones `/mcp disable` writes.

| Copy | Switch |
| --- | --- |
| User scope (`~/.claude.json` top level, `~/.claude/*.json`) | `deniedMcpServers: [{serverName}]` in `~/.claude/settings.json` |
| Project `.mcp.json` | `disabledMcpjsonServers` in the project's `.claude/settings.local.json` |
| Local scope (this project's block in `~/.claude.json`) | `disabledMcpServers` in that block |
| Project `.claude/*.json` | `manual` |

## Limits

- The user denylist is by name, so it would also block a same-name server with
  another definition. Two different Claude Code definitions of one name,
  including the same name in more than one block of `~/.claude.json`, are not
  switched off at all and go to `manual`.
- A user-scope deny also hides another project's same-name project server,
  which setup does not inspect.
- Native tools appear as `mcp__<server>__<tool>`, with every character outside
  `[A-Za-z0-9_-]` replaced by `_`. When two mcporter names share that key, or
  the tool part holds another `__`, the redirect hook leaves the call alone.
- Hook output follows Claude Code's PreToolUse contract: warn mode returns
  only `additionalContext`, block mode returns `permissionDecision: "deny"`.
