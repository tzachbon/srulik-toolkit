# create-plan keeps reviewing past three rounds while rounds make progress;
# it asks only on a stall or a user-set cap. implement-plan keeps its cap.
plan_rounds = {
    "create-plan": (create_plan, ["ask whether to continue only when the loop stalls or reaches a user-set cap"]),
    "plan quality gates": (quality_gates, [
        "Count every launched review attempt, including failed, stale, or timed-out attempts",
        "Preserve the count across resumes; fixes do not reset it",
        "A round count alone is not a reason to stop or ask",
        "no stall condition holds, no user-specified cap has been reached, and the previous round fixed at least one, start the next round without asking, including after the third",
        "even if that round also fixed comments",
        "a round fixes nothing, a fixed comment returns, or a disagreement stays unresolved after two replies",
        "A user-specified cap must be a positive whole number",
        "Only explicit user continuation grants more rounds after a stall or cap",
        "That continuation starts the next round, and after a cap it opens another budget of the same size",
    ]),
}
for plan_surface_name, (plan_surface, plan_phrases) in plan_rounds.items():
    plan_text = " ".join(plan_surface.split())
    for plan_phrase in plan_phrases:
        if plan_phrase not in plan_text:
            raise SystemExit(f"{plan_surface_name} is missing round-continuation contract: {plan_phrase}")
for plan_surface_name, plan_surface in [("create-plan", create_plan), ("plan quality gates", quality_gates), ("create-plan launcher", create_plan_openai)]:
    for plan_retired in ["Use a default cap of three review rounds", "three-round default cap", "Default to three review rounds", "At the cap without a clean verdict"]:
        if plan_retired in " ".join(plan_surface.split()):
            raise SystemExit(f"{plan_surface_name} still stops at three review rounds: {plan_retired}")
