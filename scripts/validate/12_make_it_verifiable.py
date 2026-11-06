# make-it-verifiable: claims, red-capable checks, and the verification contract.
# A phrase contained in a later phrase is listed first, so each one fails with its own message.
import hashlib

miv_dir = skill_root / "make-it-verifiable"
miv_contracts = [
    (miv_dir / "SKILL.md", [
        "license: MIT",
        "Contract mode",
        "audit mode",
        "check artifacts",
        "scratch copy",
        'Define "fully" for this change',
        "new or invariant",
        "red-capable",
        "pristine copy",
        "`diff`",
        "planned-red",
        "whose red proof is the guarded work's first task",
        "no feasible red-capable check is `blocked`",
        "Audit mode accepts only `verified` or",
        "accepted-unverified",
        "by name",
        "Without a way to ask the user, every unaccepted row stays `blocked`",
        "Done when",
        "[feedback loops](references/feedback-loops.md)",
        "[host mappings](references/hosts.md)",
        "label it untested",
        "tdd",
        "Matt Pocock",
        "[LICENSE](LICENSE)",
    ]),
    (miv_dir / "agents" / "openai.yaml", [
        "allow_implicit_invocation: true",
    ]),
    (miv_dir / "references" / "feedback-loops.md", [
        "**Failing test**",
        "**HTTP script**",
        "**CLI invocation**",
        "**Headless browser script**",
        "**Replay a captured trace**",
        "**Throwaway harness**",
        "**Property or fuzz loop**",
        "**Bisection harness**",
        "**Differential loop**",
        "**Scripted human step**",
        "<REDACTED>",
    ]),
    (miv_dir / "references" / "hosts.md", [
        "| Claude Code |", "| Codex |", "| T3 Code |", "| Cursor |", "unverified",
    ]),
    (root / "NOTICE.md", [
        "skills/make-it-verifiable/LICENSE",
        "4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/diagnosing-bugs",
        "writing-for-agents",
    ]),
    (root / "README.md", [
        "$make-it-verifiable Before I add the --json flag",
    ]),
    (skill_root / "execute-task-end-to-end" / "SKILL.md", [
        "Build proof with `$srulik-toolkit:make-it-verifiable`.",
        "and `$srulik-toolkit:make-it-verifiable` audit mode reports every claim `verified` or `accepted-unverified`.",
        "Immediately before merging, rerun `$srulik-toolkit:make-it-verifiable` audit mode on the final diff.",
    ]),
]
for miv_path, miv_tokens in miv_contracts:
    miv_text = " ".join(miv_path.read_text(encoding="utf-8").split())
    for miv_token in miv_tokens:
        if miv_token not in miv_text:
            raise SystemExit(f"make-it-verifiable contract missing in {miv_path.relative_to(root).as_posix()}: {miv_token!r}")

miv_core = (miv_dir / "SKILL.md").read_text(encoding="utf-8")
if "disable-model-invocation" in miv_core:
    raise SystemExit("make-it-verifiable must stay model-invoked")
if re.search(r"\b(?:Claude|Codex|Cursor|T3)\b|t3_[a-z_]+|\bSkill tool\b|\$(?:TMPDIR|TEMP)\b|%TEMP%", miv_core):
    raise SystemExit("make-it-verifiable core must stay host-agnostic")
# Git can check text out with CRLF on Windows; compare the unchanged license text.
if hashlib.sha256((miv_dir / "LICENSE").read_text(encoding="utf-8").encode("utf-8")).hexdigest() != "0e7ac423bf2c6e223b7c5b156f8cf72da49d748e56a1641402c31f22ad07dbb5":
    raise SystemExit("make-it-verifiable must retain the exact pinned upstream MIT license")
if {p.relative_to(miv_dir).as_posix() for p in miv_dir.rglob("*") if p.is_file()} != {
    "SKILL.md", "LICENSE", "agents/openai.yaml", "references/feedback-loops.md", "references/hosts.md",
}:
    raise SystemExit("make-it-verifiable must contain only its skill, license, invocation metadata, and two references")
