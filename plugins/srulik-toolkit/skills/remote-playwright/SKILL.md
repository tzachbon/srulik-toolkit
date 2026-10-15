---
name: remote-playwright
description: Run a repository's own Playwright tests on this machine while Chromium runs natively on a separate Windows PC, with a cloud fallback when the PC is busy or unreachable. Use only when the user explicitly asks to offload the browser, use the Windows browser or run Playwright remotely, or when a repository's guidance routes its E2E runs here.
---

# Remote Playwright

The test runner and the app under test stay on this machine; only the browser runs on the Windows PC. Playwright's own remote protocol carries the session, and `exposeNetwork` tunnels the browser's `localhost` requests back here, so a dev server bound to loopback works unchanged. No repository configuration changes. Use it only on explicit request or a repository hint; a busy machine alone is not a reason to start a remote browser.

Run `node <this skill>/scripts/remote-playwright.mjs` from the repository root. Everything is Node standard library plus the repository's own installed Playwright.

## Capabilities needed

1. **Run PowerShell on the PC.** An adapter command that takes a script on stdin and prints its stdout, passed as `--windows-exec`. Without one, stop and say so; never install a remote-control tool to get one.
2. **A private TCP route to the PC.** The browser server listens only on the PC's loopback. A private-network TCP forward exposes one port to this machine, and `start` adds and `stop` removes it. Changing firewall or network policy needs the user's approval first.
3. **Optional cloud fallback.** An isolated cloud workspace that can run the same command, for when the PC is not usable. If it is missing, `run` uses `--fallback none` and fails with a clear exit code.

Host mappings: [Windows desktop MCP and Tailscale](references/windows-desktop-mcp.md), [Depot workspace fallback](references/depot.md), [running inside a container](references/openclaw.md). On another host, show the user your mapping for each capability, say it is untested, and continue only after they confirm.

## Start, run, stop

```sh
RP="node <this skill>/scripts/remote-playwright.mjs"
$RP start --windows-exec "<adapter>" [--arg <chromium flag> ...]     # once per session
$RP run   --windows-exec "<adapter>" [--capture] -- <playwright test args>
$RP stop  --windows-exec "<adapter>"
```

- `start` checks that the PC is eligible (CPU and busiest GPU engine at or below 60%, at least 4 GB free memory, GPU telemetry available). It stages the repository's exact `playwright-core` version on the PC, starts the browser server with a fresh access token, opens the private route, and proves that a remote page can load a loopback page here. Launch flags the repository passes through `launchOptions` do not apply to a remote browser; give them to `start` with `--arg`.
- `run` refuses inherited `PW_TEST_CONNECT_*` variables and any `-j`/`--workers` argument, then runs `npx playwright test --workers=1` with `PW_TEST_CONNECT_WS_ENDPOINT`, the token in `PW_TEST_CONNECT_HEADERS` and `PW_TEST_CONNECT_EXPOSE_NETWORK=<loopback>`. `--capture` keeps screenshots and traces for passing tests too. Artifacts land in this repository's output directory.
- `stop` removes only what `start` created: its process tree, its route and its token. It refuses while a `run` is in progress unless given `--force`. If something remains, it keeps its record and reports it, so `stop` can be run again. Run it when finished, including after failures.
- `status` shows whether a server is started. `check` runs the offline self-test.

## Fallback

If anything fails before the tests start, `run` moves the whole job to a fresh cloud workspace that this run owns, using a 30-minute lease within the existing budget. That covers an adapter error, missing telemetry, an ineligible PC, no started server, a version mismatch, or a failed loopback probe. It installs dependencies there, runs the same tests with one worker, brings the artifacts back as one archive, and stops the workspace. Never retry a test that failed on the Windows browser on another host: once tests have started, a failure is a real result.

## Safety

- The access token is the secret; the server's URL is not. Never print, log, commit or paste the token. `run` redacts it from test output and text reports, and `stop` rotates it.
- The browser is a fresh Playwright Chromium with a temporary profile for every connection. Never point it at a personal browser profile.
- Keep the footprint small. Check this machine's load before starting the runner or the app under test. Use one worker, and never stop processes this skill did not start.
- Report results with the tested revision. A run that fell back to the cloud is not a Windows-browser result.

## Limits

- `file://` URLs and paths only this machine can read do not resolve on the PC; use projects served over HTTP.
- Tests that set their own browser launch flags need a server started with the same flags.
- Cloud fallback uploads tracked and unignored files and runs with the repository's default environment; local environment variables are not forwarded.
- Trace archives are not scanned for the token; it rotates on `stop`.

## Handoffs

Use a desktop-access skill, when one is installed, for the adapter and connection troubleshooting, and the cloud-workspace skill for workspace status or manual cleanup. Report test results through the repository's usual evidence rules.
