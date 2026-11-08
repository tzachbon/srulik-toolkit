---
name: srulik-toolkit-release
description: Merge and release Srulik Toolkit, then update its installed copies on the owner's machines. Use when asked to ship a toolkit change, publish its version, or roll that release out to all machines.
---

# Release Srulik Toolkit on all machines

Bind the requested actions first. A release-and-update request authorizes the
necessary commit, push, PR, merge, tag, release and targeted toolkit installation
updates. Honor narrower limits; authoring this skill alone grants no operational
authority. This repository-only maintenance skill lives under `.agents/skills/`; it is not shipped in the plugin.

Read [machine routes and native commands](references/machines.md) before acting.
Use the existing `create-pr` and `update-plugins` skills for their respective
phases when available; the rules below remain required when they are absent.

## 1. Pin the source

Resolve the exact checkout, branch, base and head commits, dirty files, intended
scope and concurrent writers. Read repository contribution and version rules.
Check the package VERSION and all version-bearing manifests agree. Preserve
unrelated work, secrets, installed pins and newer versions. Save a private receipt
outside the repository with the requested actions and intended machine/account
inventory. Inspect commands before running them; honor resource limits.

## 2. Publish and merge

Run required checks on the intended state and retain actual behavior evidence.
Use `create-pr` when a PR is needed, including its UI-proof gate for UI changes.
Link every created or pushed PR through the host's native PR tracking immediately.

Immediately before merging, reread the exact remote PR head, base, required and
applicable checks, review decision and unresolved blocking conversations. Resolve
in-scope blockers first. Merge only the validated current head with explicit merge
authority; use a head-matching operation. Never bypass checks or protections,
force-update another branch, or enable auto-merge as a substitute for readiness.
When checks are pending, use the host's native PR watch and end the turn. On wake,
recheck readiness; do not poll, sleep or start another watcher. Stop that watch
when handing control back. Read back the merged PR and exact merge commit.

## 3. Publish the release

Read the version from the merged commit and pin the release source to that commit.
Follow existing tag/name conventions. Inspect any existing tag and release before
writing: reuse matching completed state, stop on a mismatched tag or release, and
never move or delete published tags to make a retry succeed. Publish accurate
notes for this version. Read back the release URL, published state and peeled tag
commit; verify they match the pinned source. Inspect state before retrying an
uncertain write. Do not release an unmerged branch or install unpublished work as
though it were the release.

## 4. Update every selected installation

Rediscover all owner machines and current routes; never reuse stale machine IDs.
Inventory each account's native registration, marketplace source, cache version,
enabled state, live project overrides, standalone aliases and any installed Cursor
copy. Save targeted metadata and customized files before writes. Use the native
manager's current help and update only Srulik Toolkit to the pinned release.

Delegate remote work only through the host's bound child-task capability. Give each
worker the exact release version/commit, machine, writable install paths, allowed
updates, preservation rules, verification commands and receipt requirements.
Workers must not merge, release, start children, access unrelated secrets or restart
active sessions. Keep one writer per installation and serialize heavy commands.

A successful updater message is insufficient: inspect the exact registration and
compare installed files with the release, including changed skills and references.
For stale project overrides, first reproduce the native mismatch; use a documented
narrow fallback only with backup, verified cache, ownership preservation and
concurrency protection. Preserve retired records and unrelated settings. On a
partial failure, inspect before retrying and restore only this task's affected
metadata if discovery is broken. Do not replace a user's dirty source checkout.

## 5. Verify and report

Run fresh discovery for each selected host/account and live project override.
Verify the changed skill names resolve enabled from the intended release and read
their actual source/reference contents. Stop only temporary processes this task
started. A model turn is unnecessary for discovery; a reported runtime failure
requires reproducing its exact user workflow before calling that failure fixed.

Record each machine as verified, blocked or deferred with version, source commit,
registration/file evidence, discovery result and reload requirements. An offline
machine, stale override or failed discovery means partial rollout, never “all
machines updated.” Continue safe independent targets and report each blocker.
Do not restart active coding sessions without explicit restart authority; existing
sessions may need a new task or restart to load the release. Refresh affected local
workspace records when required. Return the merged PR, release URL, per-machine
results, receipt path and any unverified runtime scope.
