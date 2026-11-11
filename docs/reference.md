# Reference

Details behind the [README](../README.md): hooks, invocation, optional tools, updates, and local development.

## Startup hint

On a new session, the plugin writes the twenty-six skill names and a short routing
instruction to model context. Claude Code and Codex use the default
`hooks/hooks.json` location and run it only for `SessionStart` with the
`startup` matcher. Cursor runs it from `hooks/hooks-cursor.json` on
`sessionStart`. It does not run on each prompt or skill invocation.

The same hook checks the installed version against this repository at most once
every 24 hours and suggests an upgrade only when the versions differ. The
request times out after two seconds; network and invalid-response failures are
silent and are not cached. It never upgrades automatically. Skills remain
available when the hook is disabled, untrusted, or offline.

## Blocked task recovery

When a main agent explicitly ends with a current blocked verdict, the `Stop`
hook gives it one more turn to inspect the failure and try an authorized route.
It stays silent for completed work, past blockers, subagents, and a second stop.
The hook does not grant access, bypass approvals, or turn planning into execution.
The agent may still report a real blocker after the recovery turn.

Recovery is on by default. Set `SRULIK_TOOLKIT_BLOCKED_STOP=0` in the agent's
environment before launch to disable only this hook. Codex users must review
and trust the new `Stop` hook through `/hooks` after updating the plugin.
Cursor does not run this hook yet.

## Example prompts


```text
$can-you-help Here is a Slack thread. Can you help?
$create-plan Add offline support to this app
$create-plan Add offline support to this app. Be autonomous and answer the grill for me.
$implement-plan Execute the approved plan in docs/offline-plan.md
$srulik-toolkit:skill-creator Create a skill for release notes and evaluate it on real examples
$execute-task-end-to-end Add offline support and drive its PR to MERGE READY
$create-pr Open a pull request for the current changes
$make-it-verifiable Before I add the --json flag, how do we make this fully verifiable?
$review-pro-max Review the changes on my current branch
$ui-ux-review Review the checkout flow for usability and accessibility
$tdd Implement expiration for cached sessions
$research Trace how this repository handles retries
$tour How did this repository's PR review workflow evolve?
$show-me Explain the current request flow
$video-creation Make a 90-second product video of the new import flow
$fix-ci Diagnose and fix the failing checks on this pull request
$recap Catch me up on this thread from the beginning
$handoff Focus the next session on the failing CI job
$takeover The other agent added things I didn't ask for; take over from here
$retro Review this session and suggest environment improvements
```

Claude Code may expose skills as slash commands. Codex uses `$skill-name`.
Plain-language requests can trigger a matching skill in either tool, except
`handoff`, which preserves upstream’s explicit invocation policy. `handoff` writes
outgoing notes; `takeover` verifies incoming work before continuing.

`skill-creator` uses `create-plan` and `implement-plan` for every skill creation
or edit, including small changes, then reviews the authored change through
`review-pro-max`. Executing a covered task reads its authoring references inside
the approved plan; it does not recursively restart planning. Evaluation-only
requests can compare outputs without editing a skill. Use the namespaced name
to distinguish this adaptation from a host's built-in skill with the same name.

The portable workflow runs actual target tasks and independent no-skill or
old-skill baselines, preserves unknown telemetry, and uses equal fixture weights
for benchmarks. Its offline static viewer exports completed feedback; synthetic
feedback proves plumbing, while human acceptance is recorded separately.
Automatic description optimization is optional, Claude-specific, and currently
POSIX-only. It is not a prerequisite for portable authoring or evaluation.
Runtime evidence identifies the exact isolated installation and platform tested;
repository checks alone do not prove both native workflows or current-session
activation. Installing a shared copy is a separate action.

## Optional tools

- `review-pro-max` can use GitHub CLI for pull requests. It can also run
  CodeRabbit when you opt in and the command is installed and authenticated.
  CodeRabbit may send source outside the local machine.
- `review-pro-max` uses a three-vendor reviewer panel on a harness with a host
  mapping (T3 Code); on other harnesses it asks before launching child agents, and keeps a round ledger in the OS temporary
  directory so a rerun after fixes sees earlier findings.
- `agent-swarm` and `research` use available child-agent controls when useful.
  They can work inline when those controls are unavailable.
- `create-pr`, `pr-babysit`, and `fix-ci` can use an authenticated GitHub CLI
  or an equivalent connector for checks, logs, and pull requests. Local checks
  use the project toolchain.
- `pr-babysit` uses a subagent under the original conversation for bounded
  read-only triage. The parent owns the native PR watch, receives completion
  and PR events, applies fixes, and merges only with explicit authority. It
  never creates a separate babysitter conversation. After addressing feedback,
  it applies the hand-back the repository documents, such as a label swap.
  Listening continues after green CI and quiet passes until closure or STOP;
  an explicit end-to-end invocation uses its own terminal gate. Hosts missing child/result/watch
  capabilities report the limitation. T3 Code's tool mapping is in
  [`plugins/srulik-toolkit/skills/pr-babysit/references/t3-code.md`](../plugins/srulik-toolkit/skills/pr-babysit/references/t3-code.md).
- `agent-swarm` and `pr-babysit` use
  `plugins/srulik-toolkit/scripts/models.js` for model facts from the public
  [Artificial Analysis](https://artificialanalysis.ai/evaluations/artificial-analysis-intelligence-index)
  dataset without an API key. Like `aa-models`, it lists effort variants, prices
  and benchmarks, filters by provider or model name, and caches for 24 hours
  with background refresh. `list` includes usage from the host's `aa-models usage`
  command when available; otherwise quota remains unknown. `--frontier` keeps
  existing price/intelligence comparisons working. The host's runnable-model
  catalog determines availability. If model data is unavailable, use a host
  benchmark tool or disclose the gap and use judgment.
- `to-project` can search public skill catalogs when you ask. It requires your
  approval before installing another skill.

## Optional companion plugin

[Smart Ralph](https://github.com/tzachbon/smart-ralph#installation) provides an end-to-end,
specification-driven workflow for persistent engineering work across multiple
sessions. Srulik Toolkit keeps its skills focused and independently invokable;
Smart Ralph remains a separately installed and versioned companion.

When a `create-plan` request is a strong fit, the skill offers a handoff once.
You choose whether to receive the official installation instructions or keep
planning with Srulik Toolkit. It never installs Smart Ralph automatically.

## Update or remove

Maintainers releasing this repository and updating their machines can use the
repository-only [srulik-toolkit-release](../.agents/skills/srulik-toolkit-release/SKILL.md)
skill. It lives in `.agents/skills/` and is not included in the plugin package.

### Claude Code

```text
/plugin marketplace update srulik-toolkit
/plugin update srulik-toolkit@srulik-toolkit

/plugin uninstall srulik-toolkit@srulik-toolkit
/plugin marketplace remove srulik-toolkit
```

### Codex

```bash
codex plugin marketplace upgrade srulik-toolkit

codex plugin remove srulik-toolkit@srulik-toolkit
codex plugin marketplace remove srulik-toolkit
```

In Cursor, pull the clone and replace `~/.cursor/plugins/local/srulik-toolkit`
with a fresh copy. Delete that folder to remove the plugin.

Restart Claude Code or Cursor, or start a new Codex task, after updating. In
Codex, open `/hooks` again and review trust if the hook changed.

### Every installation at once

From a clone, `python3 scripts/update-installs.py` runs the commands above for
every installation the current account has, each from its configured source:
Claude Code for the user and each live project, Codex, and a Cursor local copy.
The Cursor copy is replaced from the Codex source, or the Claude Code source when
Codex has none, so a Cursor-only account reports it as unchecked. The script also
moves skill symlinks that point at an older toolkit cache, and rewrites copied
skills in the usual skill folders when they match an installed toolkit version,
keeping each copy's `name:` line. Edited copies, including ones with added files,
are left alone. Then it checks that the installed files match the
source and that a fresh Claude Code and Codex process loads every skill. It exits
non-zero on any failure.

- `--check` verifies without changing anything.
- `--via COMMAND` repeats the run through a command that starts Python on another
  account or machine, such as `--via "ssh my-pc python"` or
  `--via "sudo -n -u other-user -H python3"`. Repeat it for each target.

## Windows

Use the same plugin commands in the shell supported by your Claude Code or
Codex installation. The startup checker and recovery hook use Node.js and have no other
runtime dependency.

Repository validation uses Bash and Python 3. On Windows, run it from Git Bash
with Python 3 on `PATH`. The CI matrix checks Linux, macOS, and Windows, including
the native Windows PowerShell and `cmd.exe` echo behavior. Project work may
require the tools used by that project.

## Local development

Clone the repository and run its checks:

```bash
git clone https://github.com/tzachbon/srulik-toolkit.git
cd srulik-toolkit
./scripts/validate.sh
```

Load the local Claude Code plugin with:

```bash
claude --plugin-dir ./plugins/srulik-toolkit
```

For Codex, register the checkout as a local marketplace:

```bash
codex plugin marketplace add .
codex plugin add srulik-toolkit@srulik-toolkit
```

For Cursor, see [CONTRIBUTING.md](../CONTRIBUTING.md). The repository keeps the same skill payload for all three tools:

```text
srulik-toolkit/
├── .agents/plugins/marketplace.json
├── .claude-plugin/marketplace.json
├── .cursor-plugin/marketplace.json
├── plugins/srulik-toolkit/
│   ├── .claude-plugin/plugin.json
│   ├── .codex-plugin/plugin.json
│   ├── .cursor-plugin/plugin.json
│   ├── hooks/hooks.json
│   ├── hooks/hooks-cursor.json
│   └── skills/
└── scripts/validate.sh
```

Read [CONTRIBUTING.md](../CONTRIBUTING.md) before opening a pull request. Use the
[issue tracker](https://github.com/tzachbon/srulik-toolkit/issues) for bugs,
skill ideas, and questions. Report security concerns through
[SECURITY.md](../SECURITY.md).
