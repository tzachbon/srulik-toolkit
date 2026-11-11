# mcporter plugin

`mcporter-plugin` ships in the Srulik Toolkit marketplace, installed separately. It has
agents call MCP servers through the [mcporter](https://github.com/openclaw/mcporter)
CLI and saved scripts instead of one native tool call per turn.

Needs Node 24 or newer and the mcporter CLI on `PATH`; setup refuses to
disable anything without it:

```bash
npm install -g mcporter@0.17.0
claude plugin install mcporter-plugin@srulik-toolkit
```

- `/mcporter-setup` moves the MCP servers configured in Claude Code, Codex,
  Cursor and other editors into the mcporter home config, checks each one
  answers, and disables (never deletes) the Claude Code and Codex copies, with
  owner-only backups and an undo receipt. Copies in other editors are listed for you to
  disable by hand.
- A startup hint lists the servers from `mcporter config list`, and a hook adds
  the matching `mcporter call` command to any native MCP call for those servers.
- The `mcporter` skill says when to write a script, where to save it
  (`.mcporter/scripts/`), and how to check it with recorded fixtures.

On a 20-call task, the agent used 74-76% fewer input tokens through mcporter,
and a saved script cut the time in half. Method and full results:
[benchmark](benchmark/README.md).
