import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

root = pathlib.Path(sys.argv[1])
plugin = root / "plugins" / "srulik-toolkit"
version = (plugin / "VERSION").read_text(encoding="utf-8").strip()
if version != "1.10.0":
    raise SystemExit("wrong packaged VERSION")
expected = {
    "can-you-help",
    "to-project",
    "review-pro-max",
    "ui-ux-review",
    "create-plan",
    "implement-plan",
    "create-pr",
    "execute-task-end-to-end",
    "stay-in-scope",
    "agent-swarm",
    "tdd",
    "keep-it-simple",
    "research",
    "tour",
    "show-me",
    "stop-slop",
    "pr-babysit",
    "resolving-merge-conflicts",
    "fix-ci",
    "retro",
    "recap",
    "skill-creator",
}

skill_root = plugin / "skills"
actual = {path.name for path in skill_root.iterdir() if path.is_dir()}
if actual != expected:
    raise SystemExit(f"skill directories differ: expected={sorted(expected)} actual={sorted(actual)}")

for path in root.rglob("*"):
    if ".git" in path.relative_to(root).parts:
        continue
    if path.is_symlink():
        raise SystemExit(f"symlink is not allowed: {path.relative_to(root)}")

for skill_name in sorted(expected):
    skill_file = skill_root / skill_name / "SKILL.md"
    text = skill_file.read_text(encoding="utf-8")
    match = re.search(r"^---\n(.*?)\n---", text, re.DOTALL)
    if not match:
        raise SystemExit(f"missing frontmatter: {skill_file.relative_to(root)}")
    if not re.search(rf"^name:\s*{re.escape(skill_name)}\s*$", match.group(1), re.MULTILINE):
        raise SystemExit(f"wrong skill name: {skill_file.relative_to(root)}")
    if not re.search(r"^description:\s*\S", match.group(1), re.MULTILINE):
        raise SystemExit(f"missing skill description: {skill_file.relative_to(root)}")

end_to_end = (skill_root / "execute-task-end-to-end" / "SKILL.md").read_text(encoding="utf-8")
end_to_end_t3 = (skill_root / "execute-task-end-to-end" / "references" / "t3-code.md").read_text(encoding="utf-8")
end_to_end_ui = (skill_root / "execute-task-end-to-end" / "agents" / "openai.yaml").read_text(encoding="utf-8")
for token in [
    "Creating a PR and driving it to the terminal Definition of Done",
    "**`MERGE READY` without merge authority:**",
    "**`MERGED` with explicit merge authority:**",
    "acceptance criteria pass at the current head",
    "successful required checks, satisfied review requirements, zero unresolved review conversations",
    "no unaddressed actionable human or bot findings",
    "`MERGE READY` is intermediate progress when merging is authorized",
    "These states do not satisfy the Definition of Done",
    "Carry the primary Definition of Done above into the plan",
    "continue immediately to maintenance",
    "the main agent owns the native watch and all fixes",
    "a read-only child filters bounded event batches and never edits or merges",
    "Without merge authority, clean up monitoring and hand back `MERGE READY`",
    "With merge authority, continue immediately to step 6",
    "Recheck every `MERGE READY` condition immediately before merging",
    "Never bypass checks or branch protection, and never enable auto-merge",
    "on an undocumented host show the capability mapping, label it untested and obtain confirmation",
    "discover existing owners and watches for the exact PR",
    "including standalone babysitters, delegated writers and pending launches",
    "Read every page of relevant ownership records",
    "verify its watch is inactive, its runs and writer tasks have ended with no pending work",
    "retirement prevents further automatic wakes",
    "Preserve unrelated tasks, dirty worktrees and unpublished commits",
    "A mixed-purpose owner or missing stop authority is a blocker",
    "Carry forward narrower authorization",
    "the previous owner's merge authority does not grant this agent merge authority",
    "Register the main watch and start maintenance only after verifying no competing writer remains",
    "Keep the main watch unregistered and perform no PR maintenance writes until the handoff is verified",
    "including when step 4 reuses a PR",
    "Merge authority exists only when the user explicitly asks to merge this task's PR",
]:
    if token not in end_to_end:
        raise SystemExit(f"end-to-end completion contract missing: {token}")
for dependency in ["create-plan", "create-pr", "pr-babysit", "recap"]:
    if f"$srulik-toolkit:{dependency}" not in end_to_end:
        raise SystemExit(f"end-to-end workflow must invoke {dependency} by name")
if re.search(r"\]\(\.\./[^)]+/SKILL\.md\)", end_to_end):
    raise SystemExit("end-to-end workflow must use skill invocation names instead of relative links")
for token in ["T3 Code", "Codex", "Claude", "Luna", "watch_pull_request", "delegate_task", "clientRequestId", "task_cancel", "Keep listening until closure or user STOP"]:
    if token in end_to_end:
        raise SystemExit(f"host-specific or obsolete end-to-end core instruction: {token}")
if "disable-model-invocation: true" not in end_to_end or "allow_implicit_invocation: false" not in end_to_end_ui:
    raise SystemExit("end-to-end execution must require explicit invocation")
for token in [
    "verify `watching: true`",
    "one stable `clientRequestId` per batch",
    "never edit, push, reply or merge",
    "Keep one active child per PR",
    "it is not persistent child monitoring",
    "`unwatch_pull_request`",
    "`task_cancel`",
    "verify watch/task state",
    "has not been exercised in a fresh session",
    "`includeSubagents: true`",
    "every `nextCursor` page",
    "that owner's explicit\n   `threadId`",
    "instead of queuing STOP behind startup",
    "A timeout or `interrupt_requested` is not retirement",
    "require no `activeRunId`, no queued/pending writer work",
    "previous merge authority is not transferred",
    "Do not register the main watch or write to the PR while this gate is blocked",
    "Only after the ownership handoff passes",
    "Require the owning thread to cancel its verified",
    "PR-specific delegated writers with `task_cancel` and verify with `task_status`",
    "Both tools are parent-scoped; the new main must not use the prior owner's",
    "task IDs, child thread IDs, terminal",
    "`hasPendingChildRuns: false` evidence before retirement",
    "If the owner cannot cancel its writers or supply verifiable evidence, block",
    "verify `parentThreadId` associations",
    "Check owner-provided task evidence against these cross-thread reads",
    "or inaccessible child state blocks handoff",
]:
    if token not in end_to_end_t3:
        raise SystemExit(f"end-to-end host contract missing: {token}")
if "cancel its verified delegated writer tasks with `task_cancel`" in end_to_end_t3:
    raise SystemExit("end-to-end handoff must not cancel another parent's delegated tasks directly")
for text in [end_to_end, end_to_end_t3]:
    if "BLOCKED: ownership handoff unverified" not in text:
        raise SystemExit("end-to-end ownership handoff must block on unverified retirement")
if end_to_end_t3.index("## Ownership handoff before registration") > end_to_end_t3.index("## Main watch and event handling"):
    raise SystemExit("end-to-end ownership handoff must precede main watch registration")

