# Windows desktop MCP and Tailscale

This maps the skill's PC capabilities to a Windows PC that exposes a desktop MCP server with a `PowerShell` tool, reached over a private Tailscale tailnet. Verified with windows-mcp 4.0.11 and Playwright 1.63.0.

## Adapter

The bundled adapter is a minimal Streamable HTTP MCP client. It sends the script as `{command, timeout}` to the tool and prints the text result:

```sh
--windows-exec "node <this skill>/scripts/windows-mcp-exec.mjs --url <desktop MCP URL>"
```

Use the URL your MCP client is already configured with; do not discover or publish a new one. A harmless check is `echo 'Write-Output ok' | <adapter>`. First-time staging downloads `playwright-core` and Chromium on the PC, so `start` can take several minutes; the adapter allows up to 600 seconds per call (`--timeout`).

## Route

`start` binds the browser server to `127.0.0.1:<port>` (default 39173) on the PC and runs `tailscale serve --bg --tcp=<port> tcp://127.0.0.1:<port>`. The route is tailnet-only (no Funnel). Any device on the tailnet can reach the port while it is started, so the server refuses every request that lacks the per-start token, including Playwright's unauthenticated `/json` endpoint. `start` refuses to reuse a port that already has a Serve route, and `stop` removes the route only when `start` added it, leaving every other Serve route alone.

A listener bound directly to a Tailscale address can be unreachable on PCs that also run another VPN client, even when the firewall allows it. The Serve route avoids that. Firewall changes are not part of this skill.

## On the PC

- Staging: `%LOCALAPPDATA%\RemotePlaywright\<version>\` holds `playwright-core` and its Chromium. Stage directories are reused and never deleted automatically.
- Run state: `%LOCALAPPDATA%\RemotePlaywright\run\` (current user only) holds the proxy script, the token's SHA-256, `owner.json` (process ID, creation time, port, version, `serveAdded`) and the proxy's error log. `stop` deletes it.
- Processes: one hidden `node` running `proxy.cjs`, its child `playwright-core run-server` on a random loopback port, and one Chromium per connected run. `stop` ends exactly the recorded process tree.

`run-server` runs with `--unsafe` so the proxy can set the launch flags given to `start`. The proxy discards every client-supplied launch option, and the inner port listens only on the PC's loopback.

## Recovery

- `start` exits 8 (conflict): an earlier server is still recorded and alive. Run `stop`, then `start` again.
- `start` exits 5: read the proxy's error log in the run directory through the adapter; check that the PC is awake and unlocked and that Tailscale is connected.
- After a lost session, `stop --force` cleans up from `owner.json` alone.
