# Depot workspace fallback

The cloud fallback maps to a `depot-workspace` command with `up`, `run`, `export` and `stop`. That command owns a monthly compute ledger, leases and an expiry watchdog. This skill never calls the Depot API directly.

## What `run` does on fallback

1. `up --owner rp-<UTC time>-<random> --repo <cwd> --minutes 30`. The owner is unique to this invocation, so a conversation's existing workspace is never reused or stopped. If `up` reports a reused workspace, the run stops with exit 10 and leaves it alone.
2. `run --owner <owner> --seconds 1500 --command '<script>'`. The script creates `.rp/`, runs `npm ci` and `npx playwright install --with-deps chromium` into `.rp/setup.log`, then the same `npx playwright test --workers=1 <args>` with `--output=.rp/out`. It records the status (100 when setup failed) and archives `.rp/` plus any `playwright-report` into `.rp/artifacts.tgz`.
3. `export --owner <owner> --remote .rp/artifacts.tgz --out <file>`, even after a test failure.
4. The archive is extracted into `test-results/depot-<time>/`. The exit code is Playwright's, 11 when setup failed, or 10 when a Depot step failed.
5. `stop --owner <owner>` in every case once `up` succeeded.

## Accounts

Root uses `depot-workspace` directly. Other accounts use `sudo -n /usr/local/libexec/depot-workspace-user`, a root-owned wrapper that a machine administrator installs. It must:

- allow only `up`, `status`, `run`, `stop` and `export`;
- prefix every owner with the calling user's name;
- collect the repository as the calling user and upload a clean copy;
- write exports to a fresh directory that it hands to the caller only after all writes finish.

Where neither exists, use `--fallback none`. `run` then exits 3 (PC ineligible), 4 (version) or 5 (unreachable) instead.

The workspace uses the repository's default Playwright configuration and environment. Variables such as a preview URL set on this machine are not forwarded.
