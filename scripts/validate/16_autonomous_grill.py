# Autonomous grill: on request, a stand-in subagent answers every grill wave as the user.
# The grill still runs in full; the old "no questions" internal grill stays as a separate path.

autonomous_contracts = {
    "create-plan/SKILL.md": [
        "## Autonomous mode",
        "[references/autonomous.md](references/autonomous.md)",
        "The grill still runs in full",
        "a stand-in answer counts as an explicit statement for every Outcome and Definition of Done check",
        "Autonomous mode does not forbid interaction",
        "A bare request not to be asked keeps the internal-grill rule in step 7",
        "If the user explicitly forbids questions, run the same grill internally",
    ],
    "create-plan/references/autonomous.md": [
        "# Autonomous grill",
        "be autonomous",
        "launch a fresh stand-in",
        "follow every step of the skill's Workflow in order",
        "Set the model and effort explicitly",
        "at least two waves",
        "with every column below",
        "strongest available reasoning model at its highest effort",
        "unless the user names a model",
        "Leave out the planner's recommended option",
        "every earlier question and the answer it got",
        "may read anything else it needs",
        "`ask the user`",
        "one-way door",
        "closes the Outcome and Definition of Done gate",
        "accepting a `blocked` verification row",
        "a stalled review loop",
        "never edits files",
        "No independent stand-in",
        "## Answered on your behalf",
        "Planner's pick",
        "[host references](hosts.md)",
    ],
    "create-plan/references/grilling.md": ["In autonomous mode, a stand-in answer closes", "Autonomous mode does not forbid interaction"],
    "create-plan/references/planning-brief.md": ["by the stand-in in autonomous mode"],
    "create-plan/references/plan-template.md": ["## Answered on your behalf"],
    "create-plan/references/hosts.md": ["Autonomous stand-in: the `Agent` tool", "Autonomous stand-in: a native subagent", "Autonomous stand-in: on T3 Code"],
    "execute-task-end-to-end/SKILL.md": [
        "**Autonomous mode.**",
        "a fresh stand-in",
        "create-plan's `references/autonomous.md`",
        "Answered on your behalf",
        "Ask through the host's question capability so the conversation shows it is waiting",
    ],
}
for autonomous_name, autonomous_phrases in autonomous_contracts.items():
    autonomous_path = skill_root / autonomous_name
    if not autonomous_path.is_file():
        raise SystemExit(f"autonomous grill surface missing: {autonomous_name}")
    autonomous_text = " ".join(autonomous_path.read_text(encoding="utf-8").split())
    for autonomous_phrase in autonomous_phrases:
        if autonomous_phrase not in autonomous_text:
            raise SystemExit(f"{autonomous_name} is missing autonomous grill contract: {autonomous_phrase}")

autonomous_core = (skill_root / "create-plan" / "references" / "autonomous.md").read_text(encoding="utf-8")
for autonomous_token in ["Claude", "Codex", "T3 Code", "Oh My Pi", "delegate_task", "spawn_agent", "Opus", "opus"]:
    if autonomous_token in autonomous_core:
        raise SystemExit(f"host-specific instruction in create-plan autonomous core: {autonomous_token}")
if "stand-in" not in readme:
    raise SystemExit("README or workflow docs must describe the autonomous stand-in")
