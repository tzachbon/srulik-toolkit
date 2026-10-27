pr_babysit_contract = [
    "Prefer a delegated subagent when it meets every capability below",
    "it owns its native PR watch, receives events independently, and keeps listening after its initial run and the main thread's turn end",
    "Delegation alone does not prove persistent monitoring",
    "use a separate top-level babysitter conversation only when the user explicitly authorizes that fallback",
    "Otherwise report the missing capability and ask for that authorization before launching",
    "The main thread still never owns the watch or forwards watch events to a child",
    "Both forms use the same startup, lookup, forwarding, and retirement rules",
    "including subagents and separate conversations",
    "Execution: prefer a delegated subagent that meets Host capabilities; otherwise use the explicitly authorized separate-conversation fallback",
    "Retain its task and conversation identifiers for status, follow-up requests, and cancellation",
    "The main thread never owns the PR watch",
    "PR events never wake the main thread",
    "## Host capabilities",
    "List the models it can run, and launch a thread with a chosen model, its own checkout, a title, and a first message",
    "Give that thread a native PR watch",
    "- T3 Code: [references/t3-code.md](references/t3-code.md)",
    "For another host, map each capability to its own tools, show the user the mapping, say that this host has no tested reference, and launch only after the user confirms",
    "If capability 5 is missing, retire threads by settling or archiving them",
    "Relaunch only on a later request, after the lookup in step 2 no longer finds that thread",
    "Try `gpt-6-luna`, then `claude-haiku-5-5`",
    "For fallback comparisons, run `node <plugin root>/scripts/models.js --frontier`",
    "use `node <plugin root>/scripts/models.js luna` only to inspect Luna matches",
    "Check startup once",
    "When every candidate has been refused, report the refusals to the user and stop",
    "rename it to `Retired babysitter for <owner>/<repo>#<number> (<reason>)`, then settle or archive it if the host can",
    "Rename whenever the host can, because not every host can settle or archive a thread; without rename, use the fallback in Host capabilities",
    "Without rename, use the fallback in Host capabilities. A later wake after a stop does nothing",
    "One babysitter per PR",
    "and let another thread check whether that watch is active",
    "List threads by exact title, across every page of results",
    "Report a thread's latest run status with its error details, wait for a run with a time limit that does not cancel it, and interrupt a run",
    "`STOP` for a Pending babysitter is the exception: do not queue it behind an unconfirmed start. Interrupt its run, wait once for up to 2 minutes for that run to end, then classify it again",
    "Still Pending: the interrupt did not take, so tell the user stopping is unconfirmed",
    "never report a babysitter stopped before its run has ended without an active watch",
    "If capability 1, 2, 3, 4, or 6 is missing, report which one and stop",
    "## Classify a babysitter",
    "A running thread is not a monitored PR. A babysitter has started only once its PR watch is active",
    "| Its PR watch is active | Watching | It has started. Requests may be sent to it. |",
    "| Latest run failed with a confirmed model-access error | Refused | Retire it and launch again with the model after the refused one in the order of step 3",
    "| Latest run failed with any other error, ended without running (cancelled, interrupted, or rolled back), or completed without an active watch | Dead | Retire it and report the error or status to the user, then stop",
    "| Latest run is still queued, preparing, starting, running, or waiting on an approval or question | Pending | Startup is unverified. Send it nothing. |",
    "Send requests only to a Watching babysitter",
    "a babysitter that never started has only its launch run, and its latest run is the one to judge",
    "Pending: tell the user it has not confirmed its PR watch, so the request was not delivered",
    "Wait once, for up to 2 minutes, for the launch run; a timeout does not cancel it",
    "a refusal or failure after this point is caught the next time the skill runs for this PR",
    "Treat the user's later instructions for this PR as new requests through step 2, so they reach only a Watching babysitter",
    "If registration fails, send `MONITORING FAILED` and stop",
    "read every page of results before concluding none exists",
    "Visible notifications are limited to input needed, readiness changes, monitoring failure, or PR closure",
    "Green CI, missing approvals, silence, and a quiet pass do not stop listening",
    "zero unresolved review conversations",
    "Never substitute foreground maintenance",
    "Merge only when the user's request explicitly asks to merge",
    "there is no round limit",
]
if not all(token in pr_babysit for token in pr_babysit_contract):
    missing = [token for token in pr_babysit_contract if token not in pr_babysit]
    raise SystemExit(f"pr-babysit is missing its babysitter-thread contract: {missing}")
# The core skill stays host-agnostic; T3 Code tool names and fields live only in its reference.
pr_babysit_core = pr_babysit.replace("- T3 Code: [references/t3-code.md](references/t3-code.md)", "")
t3_only = re.findall(r"t3_[a-z_]+|_pull_request\b|orchestrator_capabilities|delegate_task|workspaceStrategy|modelSelection|startFromOrigin|instanceId|timeoutMs|runId|threadId|rolled_back|mode: \"|\bT3\b", pr_babysit_core)
if t3_only:
    raise SystemExit(f"pr-babysit core must stay host-agnostic; move these to references/t3-code.md: {sorted(set(t3_only))}")
pr_babysit_t3 = (skill_root / "pr-babysit" / "references" / "t3-code.md").read_text(encoding="utf-8")
for removed in ["A thread here is an independent agent conversation", 'mode: "async"', "The parent owns the listener", "Do not wait for it", "settle that thread", "and settle this thread", "or the wait timed out: the babysitter started", "Renaming is the required step", "If only capability 6 is missing, launch anyway", "A babysitter with more runs started", "the babysitter started", "ordinal: 1", "raise `runLimit`", "| `completed`, `running` | Started. |"]:
    if removed in pr_babysit + pr_babysit_t3:
        raise SystemExit(f"pr-babysit still contains a retired design: {removed}")
pr_babysit_t3_contract = [
    "A subagent cannot watch: its parent thread owns the pull request",
    "Although `delegate_task` can launch a child, it cannot give that child the required watch on this build",
    "Do not substitute a parent-owned watch or event relay",
    "only after the user explicitly authorizes a separate babysitter conversation",
    "Without that authorization, report the subagent-watch limitation and ask before launching",
    "verify every host capability and document/test its delegation lifecycle before claiming that path is supported",
    "`includeSubagents: true`",
    "Confirm the fallback authorization above",
    "[host capability](../SKILL.md#host-capabilities)",
    "| 1. Runnable models and launch | `orchestrator_capabilities`, `t3_thread_launch` |",
    "| 2. Native PR watch | `link_pull_request`, `watch_pull_request`, `unwatch_pull_request`; another thread checks it with `list_thread_pull_requests` and `threadId` |",
    "| 3. Message a thread | `t3_thread_send` |",
    "| 4. List threads by title | `t3_thread_list`, paging with `cursor` |",
    "| 5. Rename a thread | `t3_thread_update` with `action: \"rename\"` |",
    "| 6. Run status and errors | `status` from `t3_thread_list` or `t3_thread_wait`; errors from `t3_thread_read`; interrupt with `t3_thread_interrupt` |",
    "returns `no_active_run` for a thread with no active provider turn, and does not describe queued or preparing runs, so do not assume it cancels them",
    "classify the babysitter again before retiring it or reporting it stopped",
    "| Optional: settle | `t3_thread_organize` with `action: \"settle\"` |",
    "keep only a thread whose `title` matches exactly",
    "pass each response's `nextCursor` as `cursor` until it is `null`",
    "send a request with `t3_thread_send` and `mode: \"auto\"` only when it is Watching",
    "First call `list_thread_pull_requests` with the babysitter's `threadId`. If it lists this PR with `watching: true`, the babysitter is Watching, whatever its run status",
    "| `failed` with the model refusal text in its activity | Refused |",
    "| `failed` with any other error | Dead |",
    "| `completed`, `cancelled`, `interrupted`, `rolled_back` | Dead |",
    "| `idle`, `preparing`, `queued`, `starting`, `running`, `waiting` | Pending |",
    "Then retire this thread as in Retire, with no `threadId`",
    "Call `orchestrator_capabilities` for the runnable catalog",
    "so use only instances whose `constraints` list is empty",
    '{ "instanceId": "codex", "model": "gpt-6-luna" }',
    '"startFromOrigin": true',
    "use the fetched local ref or head SHA as `baseRef` with `startFromOrigin: false`",
    "`t3_thread_launch` has no retry key",
    "T3 does not notify the launcher when a top-level thread's run ends",
    "Call `t3_thread_wait` once with the launch's `threadId`, `runId`, and `timeoutMs: 120000`",
    "does not cancel the run",
    "There's an issue with the selected model",
    "If the harness exposes `t3_thread_update`, call it",
    "T3 Code's documented orchestrator tool set includes `t3_thread_update` but not `t3_thread_organize`, and builds can differ",
    "If rename is missing, follow the skill's fallback for a host without capability 5",
    "Use `t3_thread_send` with `mode: \"auto\"`",
    "`steer` fails on it",
    "confirm with `list_thread_pull_requests`",
    "Only a top-level thread can own a watch",
    "not `delegate_task`",
    "Report an unexpected end as `MONITORING FAILED`",
    "Not observed: a full babysitter following this skill on a real PR, `watching: true` reported for a babysitter thread",
]
if not all(token in pr_babysit_t3 for token in pr_babysit_t3_contract):
    missing = [token for token in pr_babysit_t3_contract if token not in pr_babysit_t3]
    raise SystemExit(f"pr-babysit T3 Code reference is missing its implementation contract: {missing}")
if not all(token in readme for token in [
    "`pr-babysit` prefers a delegated subagent",
    "with your explicit authorization. T3 Code currently requires this fallback",
    "because subagents cannot own PR watches",
]):
    raise SystemExit("README is missing the pr-babysit preference and fallback contract")
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
# Lifecycle matrix: every T3 run status maps to exactly one class, and the core table defines every class.
t3_rows = re.findall(r"^\| ([^|]*`[a-z_]+`[^|]*) \| (Refused|Dead|Pending) \|$", pr_babysit_t3, re.MULTILINE)
if len({condition for condition, _ in t3_rows}) != len(t3_rows):
    raise SystemExit(f"pr-babysit T3 classification has duplicate condition rows: {t3_rows}")
t3_class = {}
for statuses, klass in t3_rows:
    for status in re.findall(r"`([a-z_]+)`", statuses):
        t3_class.setdefault(status, set()).add(klass)
expected_t3 = {"failed": {"Refused", "Dead"}, "completed": {"Dead"}, "cancelled": {"Dead"}, "interrupted": {"Dead"},
               "rolled_back": {"Dead"}, "idle": {"Pending"}, "preparing": {"Pending"}, "queued": {"Pending"},
               "starting": {"Pending"}, "running": {"Pending"}, "waiting": {"Pending"}}
if t3_class != expected_t3:
    raise SystemExit(f"pr-babysit T3 classification must cover every run status once: {t3_class}")
core_classes = re.findall(r"^\| [^|]+ \| (Watching|Refused|Dead|Pending) \| [^|]+ \|$", pr_babysit, re.MULTILINE)
if core_classes != ["Watching", "Refused", "Dead", "Pending"]:
    raise SystemExit(f"pr-babysit core classification must define Watching, Refused, Dead, and Pending in order: {core_classes}")
if re.search(r"(?i)works on every (T3 )?build", pr_babysit + pr_babysit_t3):
    raise SystemExit("pr-babysit must not claim a T3 tool works on every build")
if re.search(r"Try `claude-haiku-5-5`, then `gpt-6-luna`|gpt-6-luna`?\)? as (a )?fallback", pr_babysit + pr_babysit_t3):
    raise SystemExit("pr-babysit must keep gpt-6-luna first")
if "Leave questions awaiting an answer open" in pr_babysit:
    raise SystemExit("pr-babysit must not leave review questions unresolved")
