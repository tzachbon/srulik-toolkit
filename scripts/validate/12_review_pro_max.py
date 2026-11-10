# review-pro-max: three-vendor panel, scores, round ledger, and scope-holding
# reruns adopted from tstack council; host details stay in references.
rpm_dir = skill_root / "review-pro-max"
rpm_contracts = {
    "SKILL.md": [
        "one strong model from each of three model vendors, at high reasoning effort",
        "A vendor is the model's maker, not the harness that runs it",
        "never fill a seat with a second model from the same vendor",
        "report the empty seat as a coverage limit",
        "- T3 Code: [references/t3-code.md](references/t3-code.md)",
        "label the mapping untested, and ask before launching children",
        "### Rounds and ledger",
        "`review-pro-max-<first 16 hex characters of the SHA-256 of the identity>`",
        "The identity is host, owner, repository, and target joined by newlines",
        "compare its identity before changing anything",
        "report the limit and do not write to that ledger",
        "record the rewritten history as a limit and continue",
        "Named models fill their seats even when they repeat a vendor",
        "`local-<absolute repository root path>-<HEAD commit, or no-head>`",
        "Use an existing folder only when it is a real directory, not a link, owned by the current user",
        "Create the folder with owner-only access",
        "`open`, `fixed`, `disputed`, or `withdrawn`",
        "If the ledger is usable, recheck its open findings against the current state",
        "Later rounds must not widen scope",
        "Ask each reviewer for a score out of 10",
        "never in a PR description or PR comment",
        "Write `no score` when a reviewer gave none; never invent one",
        "advise rerunning this review after they are applied",
        "Stop advising reruns once every reviewer reports no open blocking findings",
        "When the change alters rendered UI, also run the `ui-ux-review` skill",
        "state why the pass was skipped",
        "Its findings go through the verification in step 4 and this skill's blocking rule",
        "it is not a panel seat and gets no score row",
        "mark the affected criteria `UNVERIFIED` and report a coverage limit",
        "A requested quick review skips the UI pass and says so",
        "or when no earlier round recorded `COMPLETE` UI coverage",
        "each reviewer's model and score, the UI pass's coverage verdict or skip reason",
    ],
    "code-reviewer.md": [
        "round number, prior findings with their status",
        "In a later round, recheck each prior finding first",
        "do not add requirements, preferences, or adjacent cleanup",
        "`Score: N/10`",
    ],
    "references/t3-code.md": [
        "`orchestrator_capabilities`, called once per thread before the first `delegate_task`",
        "A provider instance is not a vendor",
        "Seat each model the user named on an instance that runs it",
        "`role: \"review\"`",
        "`delegate_task`, one per seat",
        "high effort in `target.options`",
        "while reviewers are still running, end the turn instead of polling",
        "finish the report once every seat has returned or failed",
        "Never send a new round to an earlier reviewer through `t3_thread_send`",
        "`task_cancel`",
        "mode `0700` on POSIX",
        "[code-reviewer.md](../code-reviewer.md)",
    ],
}
for rpm_relative, rpm_phrases in rpm_contracts.items():
    rpm_text = " ".join((rpm_dir / rpm_relative).read_text(encoding="utf-8").split())
    for rpm_phrase in rpm_phrases:
        if rpm_phrase not in rpm_text:
            raise SystemExit(f"review-pro-max {rpm_relative} missing contract: {rpm_phrase}")

rpm_core = (rpm_dir / "SKILL.md").read_text(encoding="utf-8").replace("- T3 Code: [references/t3-code.md](references/t3-code.md)", "")
for rpm_name, rpm_surface in [("SKILL.md", rpm_core), ("code-reviewer.md", (rpm_dir / "code-reviewer.md").read_text(encoding="utf-8"))]:
    if re.search(r"\b(?:Claude|Codex|Cursor|T3|Opus|GPT|Gemini|Grok)\b|t3_[a-z_]+|delegate_task|orchestrator_capabilities|\$TMPDIR|%TEMP%", rpm_surface):
        raise SystemExit(f"review-pro-max {rpm_name} must stay host-agnostic")
for rpm_retired in ["Avoid arbitrary reviewer counts", "for a consequential change, use one strong model from each of several providers"]:
    if rpm_retired in " ".join(rpm_core.split()):
        raise SystemExit(f"review-pro-max SKILL.md still contains retired text: {rpm_retired}")
