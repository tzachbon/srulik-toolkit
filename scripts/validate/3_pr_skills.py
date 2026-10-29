pr_babysit_contract = [
    "If the user explicitly invoked `execute-task-end-to-end` for this task",
    "load [that workflow](../execute-task-end-to-end/SKILL.md) before applying the standalone roles below",
    "Its ownership and completion rules take precedence",
    "If it is absent from the skill catalog, check the linked bundled file",
    "If that file is unavailable, report the missing skill and blocked phase instead of substituting a background handoff",
    "The babysitter is a subagent under the original conversation",
    "The parent owns the native PR watch and all maintenance",
    "The child handles bounded read-only triage",
    "Never launch a separate conversation for babysitting",
    "Confirm the host records the task as a child of the original conversation",
    "If a required capability is missing, report it and stop",
    "including legacy babysitters and pending writer tasks",
    "Keep one active child per PR",
    "never edits, pushes, replies, resolves threads, merges, or owns a watch",
    "Child completion is not persistent monitoring",
    "leave the parent's watch active and end the turn",
    "Cancel the active child and remove the parent's watch",
    "Do not rename, settle, or archive the original conversation",
    "Green CI, missing approvals, silence, and a quiet pass do not stop listening",
    "Merge only when the user's request explicitly asks to merge",
    "zero unresolved review conversations",
    "there is no round limit",
    "public Artificial Analysis dataset without an API key",
    "- T3 Code: [references/t3-code.md](references/t3-code.md)",
]
if not all(token in pr_babysit for token in pr_babysit_contract):
    raise SystemExit(f"pr-babysit is missing its parent/subagent contract: {[t for t in pr_babysit_contract if t not in pr_babysit]}")
pr_babysit_core = pr_babysit.replace("- T3 Code: [references/t3-code.md](references/t3-code.md)", "")
t3_only = re.findall(r"t3_[a-z_]+|_pull_request\b|orchestrator_capabilities|delegate_task|workspaceStrategy|modelSelection|startFromOrigin|instanceId|timeoutMs|runId|threadId|rolled_back|mode: \"|\bT3\b", pr_babysit_core)
if t3_only:
    raise SystemExit(f"pr-babysit core must stay host-agnostic: {sorted(set(t3_only))}")
pr_babysit_t3 = (skill_root / "pr-babysit" / "references" / "t3-code.md").read_text(encoding="utf-8")
pr_babysit_t3_contract = [
    "The original thread owns the PR watch",
    "`delegate_task` creates the babysitter as a child of that thread",
    "[ownership handoff](../../execute-task-end-to-end/references/t3-code.md#ownership-handoff-before-registration)",
    "`link_pull_request`",
    "`watch_pull_request`",
    "`watching: true`",
    "`clientRequestId`",
    "`mode: \"async\"`",
    "`taskId`",
    "`parentThreadId` matches the original thread",
    "`relationshipToParent` is `subagent`",
    "`childThreadId`",
    "never edit, push, reply, resolve threads, merge, or register a watch",
    "Follow the returned `next`",
    "`task_cancel`",
    "`hasPendingChildRuns: false`",
    "A timed-out wait does not cancel the child",
    "Do not send another round through `t3_thread_send`",
    "A completed child does not end the parent's PR watch",
    "`unwatch_pull_request`",
    "The full standalone lifecycle has not been verified on the original Mac",
]
if not all(token in pr_babysit_t3 for token in pr_babysit_t3_contract):
    raise SystemExit(f"pr-babysit T3 mapping is missing its parent/subagent contract: {[t for t in pr_babysit_t3_contract if t not in pr_babysit_t3]}")
for retired in [
    "The main thread never owns the PR watch",
    "PR events never wake the main thread",
    "separate-conversation fallback",
    "Do not substitute a parent-owned watch",
    "## Classify a babysitter",
    "t3_thread_launch",
    "workspaceStrategy",
    "create_threads",
]:
    if retired in pr_babysit + pr_babysit_t3:
        raise SystemExit(f"pr-babysit still permits the retired standalone-conversation design: {retired}")
readme_babysit_contract = [
    "`pr-babysit` uses a subagent under the original conversation",
    "The parent owns the native PR watch",
    "never creates a separate babysitter conversation",
]
if not all(token in readme for token in readme_babysit_contract):
    raise SystemExit("README is missing the pr-babysit parent/subagent contract")
agents_guide = (root / "AGENTS.md").read_text(encoding="utf-8")
standards = (root / "CODING_STANDARDS.md").read_text(encoding="utf-8")
for name, text in [("AGENTS.md", agents_guide), ("CODING_STANDARDS.md", standards)]:
    for link in re.findall(r"\]\(([^)#]+)", text):
        if not (root / link).exists():
            raise SystemExit(f"{name} links to a missing file: {link}")
if "[CODING_STANDARDS.md](CODING_STANDARDS.md)" not in agents_guide:
    raise SystemExit("AGENTS.md must point agents to CODING_STANDARDS.md")
agents_stages = standards[standards.index("| Stage |"):standards.index("Prefer extending")]
if set(re.findall(r"`([a-z-]+)`", agents_stages)) != expected:
    raise SystemExit("CODING_STANDARDS.md stage table must list every skill exactly once by its directory name")
agents_contract = [
    "generic across providers and agent harnesses",
    "a streamlined path from request to merged change",
    "reusable skills and utilities",
]
if not all(token in agents_guide.lower() for token in agents_contract):
    raise SystemExit(f"AGENTS.md is missing its purpose: {[t for t in agents_contract if t not in agents_guide.lower()]}")
standards_contract = [
    "Write a skill's `SKILL.md` in terms of capabilities, not one harness's tools",
    "[`references/t3-code.md`](plugins/srulik-toolkit/skills/pr-babysit/references/t3-code.md)",
    "To support another harness, add a reference beside it; do not edit the core to fit one host",
    "Never claim support for a harness that no reference documents or nobody has tested",
    "On a harness with no reference, a skill shows its capability mapping, says it is untested, and acts only after the user confirms",
    "Encode each skill's contract in `scripts/validate.sh`",
    "Break each new check once on purpose and confirm validation fails",
]
if not all(token in standards for token in standards_contract):
    raise SystemExit(f"CODING_STANDARDS.md is missing its architecture guidance: {[t for t in standards_contract if t not in standards]}")
if "[AGENTS.md](AGENTS.md)" not in (root / "CONTRIBUTING.md").read_text(encoding="utf-8"):
    raise SystemExit("CONTRIBUTING.md must point contributors to AGENTS.md")
