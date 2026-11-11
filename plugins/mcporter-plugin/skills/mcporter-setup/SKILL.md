---
name: mcporter-setup
description: Move the MCP servers configured in Claude Code, Codex, Cursor and other editors into one mcporter home config, check each one answers, then disable the native copies with backups and an undo receipt. Use when the user asks to set up mcporter, consolidate or migrate MCP servers, or stop using native MCP tools.
---

# mcporter setup

Goal: every MCP server the user has configured is reachable through
`mcporter call`, and the harness no longer loads a second native copy.

Run the work in a child agent when the host offers one (the `mcporter-setup`
agent in this plugin). Otherwise follow these steps yourself. Either way, the
user approves step 3 before anything is written.

## Steps

1. **Inventory.** Run `node <plugin>/scripts/setup.js inventory`. It lists the
   servers mcporter can import from every supported editor config (plus the
   project `.mcp.json` and `$CODEX_HOME/config.toml`), and the servers already
   in mcporter's config. It prints names and paths, never definitions.
2. **Classify** each server and show the table to the user:
   - *Move*: stdio or HTTP server with a static config.
   - *Move, then log in*: OAuth server. After moving, run `mcporter auth <name>` once.
   - *Stays native*: servers the harness injects at runtime (the host's own
     tools, hosted connectors, IDE bridges). They never appear in the
     inventory, so nothing is done to them and the redirect hook ignores them.
3. **Ask** which servers to move. Default: every *Move* and *Move, then log in* server.
4. **Dry run.** `node <plugin>/scripts/setup.js apply --servers a,b --dry-run`.
5. **Apply.** `node <plugin>/scripts/setup.js apply --servers a,b`. For each server it:
   - copies the definition, as mcporter read it from the first file listing the
     server, into the mcporter home config: the existing `mcporter.json` or `.jsonc` under
     `$XDG_CONFIG_HOME/mcporter` or `~/.mcporter`, else `~/.mcporter/mcporter.json`
     (a home config with comments is refused);
   - runs `mcporter list <name>`; only a server that answers counts as migrated.
     A project `config/mcporter.json` that defines the same name would win over
     the home config, so that server is listed under `failed` as shadowed; so is
     a server ordinary `mcporter` cannot find (for example with `MCPORTER_CONFIG`
     set). A stdio server from a project file, or a Claude Code local-scope
     server in `~/.claude.json`, gets that project as its `cwd`. A server that needs a login is kept in mcporter and listed under
     `authRequired`: run `mcporter auth <name>`, then apply it again so its
     native copy is disabled;
   - disables every native copy of a migrated server that has the same
     definition, without deleting it. A same-name server defined differently
     elsewhere stays enabled and is listed under `conflicts`. So does a
     user-level copy when the moved one came from a project file and is bound
     to that project's folder: ask the user which
     one to keep, or rename one. Two different Claude Code definitions of one
     name, including different user and project definitions in `~/.claude.json`,
     are not denied at all (the denylist is by name) and go to `manual`. A Codex
     server with `cwd` is not migrated (mcporter's import drops `cwd`) and is listed
     under `failed`
     (Claude Code: `deniedMcpServers` in `~/.claude/settings.json`; Codex:
     `enabled = false` in every `config.toml` that defines it, home or project). Other editors, Claude
     Desktop, Codex servers defined as inline tables, and every server in a Codex
     file that holds multi-line strings are listed under `manual`;
   - checks `~/.claude/settings.json` and the home config parse before writing anything, backs
     up every file before writing, and saves the receipt with its `undo`
     command after each backup.
6. **Report** the receipt: migrated, authRequired, conflicts, failed (native copy left enabled), manual
   steps, OAuth logins still needed, and the undo command. Tell the user to
   restart the coding agent so the native copies unload.

## Rules

- Never delete a harness MCP entry. Disable only, and only after mcporter reached the server.
- Never print secret values from configs. Refer to them by key name.
- If `mcporter` is missing, the scripts fall back to `npx -y mcporter@0.17.0`; mcporter targets Node 24 or newer.
- After setup, daily use follows the `mcporter` skill.
