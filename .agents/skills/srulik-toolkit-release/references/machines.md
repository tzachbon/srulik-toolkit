# Release hosts and native commands

This mapping covers repository maintenance in T3 Code and native Claude Code,
Codex and Cursor installations. Inspect the active machine's instructions, current
CLI help and registrations before writes. Machine identities, account names,
private paths and credentials belong in local receipts, not this repository.

## Discover the release and machines

Read repository AGENTS.md, CONTRIBUTING.md, validation workflows and the selected
PR. Resolve the owner/repository from the actual remote. GitHub examples below
assume the repository permits squash merges:

```sh
gh pr view <number> --repo <owner/repo> --json headRefOid,baseRefName,isDraft,mergeStateStatus,reviewDecision,statusCheckRollup
gh pr merge <number> --repo <owner/repo> --squash --match-head-commit <validated-head-sha>
gh release create <tag> --repo <owner/repo> --target <merged-commit-sha> --title <release-title> --notes-file <notes-file>
```

Inspect existing remote tags/releases before creation, including peeled commit
identity for annotated tags. Never move a published tag. Read back PR merge state,
release published state and tag commit after writes; inspect state before retries.
Check unresolved review conversations separately through the host's PR tools or
GitHub GraphQL `reviewThreads`; the command above does not include them.

Use local workspace routing for the coordinator's accounts and the owner's other
machines. In T3 Code, call `t3_environment_links` to rediscover linked environments;
IDs are installation-specific and must not be stored here. For a named machine
that is not linked, use `t3_environment_link` with the user's label, never a pairing
code in chat. Read `orchestrator_capabilities` under the current host rules.
Delegate bounded remote work through `delegate_task` with `target.environmentId`
and an available provider/model; set model options in `target.options`. Obey
returned `next`; completion wakes the parent. Do not create top-level threads or
shell worktrees as substitutes. Same-provider native children are suitable only
when their tool supports the required machine and settings.

After creating or pushing a PR, call `link_pull_request` next. For pending checks,
use `watch_pull_request`, then end the turn; no polling or `gh --watch`. Before
handback, use `unwatch_pull_request` if still watched. Children never own watches.
Without these capabilities, use the active harness's documented equivalent; report
unsupported remote routes and do not claim all machines were updated.

## Inventory and update

Locate actual user homes and all installed accounts rather than assuming the
coordinator's paths apply remotely. Common discovery locations are `.codex`,
`.claude`, `.agents/skills` and `.cursor/plugins/local` under each user's home.
Inventory native Srulik registration records, live project overrides and existing
standalone compatibility copies. User-level updates may leave project overrides
stale. Preserve enabled states, newer versions, pins, unrelated records and retired
projects. Save selected metadata/customized files without dumping credentials.

Prefer the existing `update-plugins` skill and its matching host reference when
installed. Typical native commands, subject to current help and source type:

```sh
codex plugin marketplace list --json
codex plugin marketplace upgrade srulik-toolkit --json
codex plugin add srulik-toolkit@srulik-toolkit --json
claude plugin marketplace update srulik-toolkit
claude plugin update srulik-toolkit@srulik-toolkit --scope user --json
claude plugin update srulik-toolkit@srulik-toolkit --scope project --json
```

Refresh a Git marketplace's configured source. For an authorized directory-source
update, export the exact release into a stable snapshot preserving marketplace
relative paths, inspect the native rebinding help and retain original metadata for
rollback. Do not reset a dirty source checkout or silently change a pin. On Cursor,
replace only the existing local plugin copy from the pinned source after preserving
customizations; never install unrelated tools. Use terminal-only operations and
leave active applications and browser profiles untouched.

Run each project update in that project's directory, then inspect that exact
`projectPath` record. If native update reports success but leaves it old, reproduce
and record the mismatch. A documented metadata fallback requires a verified new
cache, scoped backup, preserved owner/mode and unrelated entries, and checking for
concurrent changes immediately before atomic replacement. Otherwise stop that
target. An updater's `up_to_date` message is not installation evidence.

For this repository-only skill, copy `.agents/skills/srulik-toolkit-release/` from
the same verified repository revision into each selected account's existing shared
skill/discovery mechanism. Verify both files and preserve any customized copy.
It must stay outside `plugins/srulik-toolkit/skills/` and outside plugin manifests;
installing it must not increase the plugin's skill count. Do not copy provider
configuration or credentials between machines.

## Fresh discovery and evidence

Codex: start a temporary `codex app-server --stdio`, initialize JSON-RPC, then call
`skills/list` with real project `cwds` and `forceReload: true`. Check enabled
names for each changed `srulik-toolkit:<skill>` and this standalone
`srulik-toolkit-release` skill. Verify resolved versions and actual source/reference
bytes against the pinned release; report relevant discovery errors.

Claude: a temporary CLI with `-p --input-format stream-json --output-format
stream-json --verbose --no-session-persistence` accepts an initialize
`control_request` without a model turn. Verify its successful `control_response`
command list in each account and live project. Inspect installed package contents
as well; command discovery alone does not establish version identity. Bound the
process lifetime, sanitize captured output, and terminate only this task's process.

If Cursor or another host cannot expose fresh discovery without restarting an
active app, record file identity separately and mark discovery/reload pending.
Never infer that a running session uses new files. Record actual platform, native
versions, account/registration/file checks, discovery outcome and receipt path for
each target. A previous receipt is evidence for that release only. Unsupported
hosts, inaccessible accounts or offline machines leave rollout explicitly partial.
