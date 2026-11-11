---
name: mcporter
description: Use MCP servers through the mcporter CLI and saved deterministic scripts instead of native MCP tools. Use whenever a task needs an MCP server's tools, when the session hint lists mcporter servers, or when the user asks to script, save, or maintain MCP calls.
---

# mcporter

Native MCP tools cost one model turn per call, and every raw result lands in
context. mcporter runs the same tools from the shell, so one command can make
many calls and return only the answer.

## Choose the form

| Task | Use |
| --- | --- |
| One call, look at the result | `mcporter call <server>.<tool> key:value --output json` |
| Two or more calls, a loop, filtering, or something you may repeat | a script in `.mcporter/scripts/` |
| A server you use every day | `mcporter generate-cli --server <name>` for a typed CLI |

Discover before calling: `mcporter list` shows servers, and
`mcporter list <server> --schema` shows tool signatures. Read only the schema
you need.

Servers the harness injects itself (they are absent from `mcporter list`) stay
on their native tools.

## Write a script

1. Read `.mcporter/scripts/README.md`. Reuse or extend an existing script
   before adding one.
2. Write the script. Use a Node script with `createRuntime()` from `mcporter`
   when it makes several calls: one process keeps one connection, and it can be
   recorded and replayed. A bash one-liner around a single `mcporter call` is
   fine for one call. Node resolves `import 'mcporter'` from the project's
   `node_modules` only, not from a global install or `npx`, so install it once
   per project: `npm install --save-dev mcporter@0.17.0`.
3. Start with the header: purpose, arguments, servers and tools used, output
   format, and the replay command. Print only the result to stdout (JSON, TSV
   or one value). Send errors to stderr and exit non-zero.
4. Run it once against the live server.
5. Record a fixture: `mcporter record <script-name> -- node .mcporter/scripts/<file>`,
   then copy `~/.mcporter/recordings/<script-name>.ndjson` to
   `.mcporter/fixtures/`. Check the fixture for secrets before committing it.
6. Add one row to `.mcporter/scripts/README.md`.

A worked example lives in [examples/.mcporter](examples/.mcporter):
`inventory-gold-stock.mjs` pages through a server and returns one integer, and
`inventory-item.sh` wraps a single call. Its `config/mcporter.json` points
at the benchmark's local fake server, so the example runs offline from that
directory once `npm install mcporter@0.17.0` has run there.

## Maintain scripts

- **Where**: per project in `.mcporter/scripts/`, committed. Scripts shared by
  every project go in `~/.mcporter/scripts/`.
- **Check**: copy the fixture into `~/.mcporter/recordings/`, then run
  `mcporter replay <script-name> -- node .mcporter/scripts/<file>`. Replay runs
  offline and fails when the script's calls no longer match the recording.
- **Drift**: when a live call fails on a changed tool, run
  `mcporter list <server> --schema`, fix the script, rerun it live, and record
  the fixture again.
- **Remove** a script that fails its replay and is no longer used, along with
  its fixture and README row.
