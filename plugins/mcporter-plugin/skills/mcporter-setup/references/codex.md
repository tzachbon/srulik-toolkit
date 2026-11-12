# Codex mapping for mcporter-setup

What `scripts/setup.js` reads and writes for Codex.

## Where servers are read

Each `config.toml` is imported on its own: the project's `.codex/config.toml`,
`$CODEX_HOME/config.toml` (mcporter 0.17 misses it), and `~/.codex/config.toml`.

## How a migrated copy is switched off

`enabled = false` inside the server's `[mcp_servers.<name>]` table, in every
`config.toml` that defines it, home or project. The entry stays.

## Limits

- No TOML parser in the Node standard library, so edits are line-based:
  - a server defined as an inline table goes to `manual`;
  - every server in a file that holds a multi-line string (`"""` or `'''`)
    goes to `manual`, because such a string could hide or fake a table header.
- mcporter's Codex import drops `cwd`, `enabled_tools` and `disabled_tools`, so
  a server with `cwd`, `enabled_tools` or `disabled_tools` is not migrated and
  goes to `failed`: its copy would start in another folder or expose tools
  Codex hid.
