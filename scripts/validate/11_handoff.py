# handoff: explicit outgoing context transfer, separate from incoming takeover.
import hashlib

handoff_dir = skill_root / "handoff"
handoff_contracts = [
    (handoff_dir / "SKILL.md", [
        "name: handoff",
        "argument-hint:",
        "disable-model-invocation: true",
        "license: MIT",
        "Run only on an explicit request",
        "focus argument",
        "Do not invent missing history",
        "temporary file creation, and saved-file readback",
        "[host mappings](references/hosts.md)",
        "obtain confirmation before acting",
        "uniquely named Markdown file in the OS temporary directory outside the workspace",
        "Never overwrite an existing handoff",
        "Require owner-only access, or an equivalent private ACL, at creation before writing any content",
        "verified progress with evidence pointers, unverified claims",
        "active or paused tasks, watches, and their owners",
        "path or URL instead of duplicating their content",
        "Notes do not grant new authority",
        "**Suggested skills:**",
        "Recommend `takeover`",
        "use `recap` for history alone",
        "Redact all sensitive information, including confidential business decisions, internal system details, API keys, passwords, tokens, and personally identifiable information",
        "filename, links, and receiving prompt",
        "Read the saved file back",
        "actual saved path and a copyable prompt",
        "does not resume tasks, transfer ownership, launch an agent, send messages, push, merge, deploy, or publish",
        "Matt Pocock",
        "Modified for portable skill invocation",
        "[LICENSE](LICENSE)",
    ]),
    (handoff_dir / "agents" / "openai.yaml", [
        'display_name: "Handoff"',
        "policy: allow_implicit_invocation: false",
    ]),
    (handoff_dir / "references" / "hosts.md", [
        "| Claude Code |", "| Codex |", "| T3 Code |",
        "$TMPDIR", "/tmp", "%TEMP%",
        "outside the workspace before writing",
        "mode `0600` on POSIX or an equivalent private ACL on Windows",
        "does not prove native command discovery",
        "Cursor and Windows",
        "unverified",
    ]),
    (root / "NOTICE.md", [
        "skills/handoff/LICENSE",
        "4ae2317ddb22b046e26455e4f9c9b3aaaf62212d",
        "Copyright (c) 2026 Matt Pocock",
    ]),
    (root / "docs" / "reference.md", [
        "$handoff Focus the next session",
        "`handoff`, which preserves upstream’s explicit invocation policy",
        "`handoff` writes outgoing notes; `takeover` verifies incoming work",
    ]),
]
for handoff_path, handoff_tokens in handoff_contracts:
    handoff_text = " ".join(handoff_path.read_text(encoding="utf-8").split())
    for handoff_token in handoff_tokens:
        if handoff_token not in handoff_text:
            raise SystemExit(f"handoff contract missing in {handoff_path.relative_to(root)}: {handoff_token!r}")

handoff_core = (handoff_dir / "SKILL.md").read_text(encoding="utf-8")
if re.search(r"\b(?:Claude|Codex|Cursor|T3)\b|t3_[a-z_]+|\bSkill tool\b|\$(?:TMPDIR|TEMP)\b|%TEMP%", handoff_core):
    raise SystemExit("handoff core must stay host-agnostic")
# Git can check text out with CRLF on Windows; compare the unchanged license text.
if hashlib.sha256((handoff_dir / "LICENSE").read_text(encoding="utf-8").encode("utf-8")).hexdigest() != "0e7ac423bf2c6e223b7c5b156f8cf72da49d748e56a1641402c31f22ad07dbb5":
    raise SystemExit("handoff must retain the exact pinned upstream MIT license")
if {p.relative_to(handoff_dir).as_posix() for p in handoff_dir.rglob("*") if p.is_file()} != {
    "SKILL.md", "LICENSE", "agents/openai.yaml", "references/hosts.md",
}:
    raise SystemExit("handoff must contain only its skill, license, invocation metadata, and host mapping")
