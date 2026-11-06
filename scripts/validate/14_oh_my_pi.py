# Oh My Pi host mappings: each skill with host mappings documents OMP's tool names and limits.

omp_contracts = {
    "pr-babysit/references/oh-my-pi.md": [
        "# pr-babysit on Oh My Pi", 'read("skill://<name>")', "xd://mcp__t3_code_<tool>",
        "top-level thread", "BLOCKED: no native PR watch", "polling loop", "[T3 Code mapping](t3-code.md)", "unverified",
    ],
    "review-pro-max/references/oh-my-pi.md": [
        "# review-pro-max on Oh My Pi", 'read("skill://<name>")', "xd://mcp__t3_code_delegate_task",
        "report the\nempty seats", "unverified",
    ],
    "ui-ux-review/references/oh-my-pi.md": [
        "# UI UX review on Oh My Pi", "`read` on a local image path", "| Clarification | `ask` |", "xd://mcp__t3_code_<tool>", "unverified",
    ],
    "execute-task-end-to-end/references/oh-my-pi.md": [
        "# End-to-end execution on Oh My Pi", 'read("skill://<skill>")', "`ask`",
        "top-level OMP thread", "BLOCKED: no native PR watch", "unverified",
    ],
    "skill-creator/references/oh-my-pi.md": [
        "# Oh My Pi mapping", 'read("skill://<name>")', "disable-model-invocation: true",
        "Never edit a shared profile", "unverified",
    ],
    "create-plan/references/hosts.md": ["## Oh My Pi, on T3 Code or its terminal", "xd://mcp__t3_code_delegate_task", "unverified"],
    "handoff/references/hosts.md": ["| Oh My Pi |", 'read("skill://handoff")'],
    "skill-creator/references/hosts.md": ["[Oh My Pi](oh-my-pi.md)"],
    "pr-babysit/SKILL.md": ["- Oh My Pi: [references/oh-my-pi.md](references/oh-my-pi.md)"],
    "review-pro-max/SKILL.md": ["- Oh My Pi: [references/oh-my-pi.md](references/oh-my-pi.md)"],
    "ui-ux-review/SKILL.md": ["Under Oh My Pi, read the [Oh My Pi mapping](references/oh-my-pi.md)."],
    "execute-task-end-to-end/SKILL.md": ["under Oh My Pi, the [Oh My Pi mapping](references/oh-my-pi.md)"],
}
for omp_rel, omp_tokens in omp_contracts.items():
    omp_text = (skill_root / omp_rel).read_text(encoding="utf-8")
    omp_missing = [t for t in omp_tokens if t not in omp_text]
    if omp_missing:
        raise SystemExit(f"{omp_rel} is missing its Oh My Pi contract: {omp_missing}")
if "### Oh My Pi" not in (root / "README.md").read_text(encoding="utf-8"):
    raise SystemExit("README is missing the Oh My Pi install section")
print("Oh My Pi host mappings passed")
