#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
plugin_root="$repo_root/plugins/srulik-toolkit"

python3 - "$repo_root" <<'PY'
import json
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1])
plugin = root / "plugins" / "srulik-toolkit"
expected = {
    "to-project",
    "review-pro-max",
    "create-plan",
    "stay-in-scope",
    "agent-swarm",
    "tdd",
    "keep-it-simple",
}

skill_root = plugin / "skills"
actual = {path.name for path in skill_root.iterdir() if path.is_dir()}
if actual != expected:
    raise SystemExit(f"skill directories differ: expected={sorted(expected)} actual={sorted(actual)}")

for path in root.rglob("*"):
    if path.is_symlink():
        raise SystemExit(f"symlink is not allowed: {path.relative_to(root)}")

for skill_name in sorted(expected):
    skill_file = skill_root / skill_name / "SKILL.md"
    text = skill_file.read_text()
    match = re.search(r"^---\n(.*?)\n---", text, re.DOTALL)
    if not match:
        raise SystemExit(f"missing frontmatter: {skill_file.relative_to(root)}")
    if not re.search(rf"^name:\s*{re.escape(skill_name)}\s*$", match.group(1), re.MULTILINE):
        raise SystemExit(f"wrong skill name: {skill_file.relative_to(root)}")

for manifest in [
    root / ".claude-plugin" / "marketplace.json",
    root / ".agents" / "plugins" / "marketplace.json",
    plugin / ".claude-plugin" / "plugin.json",
    plugin / ".codex-plugin" / "plugin.json",
]:
    data = json.loads(manifest.read_text())
    if data.get("name") != "srulik-toolkit":
        raise SystemExit(f"wrong manifest name: {manifest.relative_to(root)}")
    if "version" in data and data["version"] != "1.0.0":
        raise SystemExit(f"wrong version: {manifest.relative_to(root)}")

for relative in [
    "skills/to-project/EXTEND.md",
    "skills/to-project/templates.md",
    "skills/to-project/base-skills/capture-to-project/SKILL.md",
    "skills/to-project/base-skills/recap-project/SKILL.md",
    "skills/to-project/base-skills/tidy-project/SKILL.md",
    "skills/review-pro-max/code-reviewer.md",
    "skills/tdd/tests.md",
    "skills/tdd/mocking.md",
]:
    if not (plugin / relative).is_file():
        raise SystemExit(f"missing bundled resource: {relative}")

forbidden = [
    "/" + "Users" + "/" + "zachbonfil",
    "git." + "autodesk.com",
    "Team" + "Create",
    "Send" + "Message",
    "Task" + "Create",
    "Task" + "Update",
    "~/" + ".config/agent-rules",
]
for path in skill_root.rglob("*"):
    if not path.is_file():
        continue
    text = path.read_text(errors="ignore")
    for token in forbidden:
        if token in text:
            raise SystemExit(f"non-portable token {token!r}: {path.relative_to(root)}")
PY

if command -v claude >/dev/null 2>&1; then
  claude plugin validate --strict "$repo_root"
  claude plugin validate --strict "$plugin_root"
fi

echo "Srulik Toolkit validation passed."
