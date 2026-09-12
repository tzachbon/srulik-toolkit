#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
plugin_root="$repo_root/plugins/srulik-toolkit"

python3 - "$repo_root" <<'PY'
import json
import os
import pathlib
import re
import subprocess
import sys

root = pathlib.Path(sys.argv[1])
plugin = root / "plugins" / "srulik-toolkit"
expected = {
    "to-project",
    "review-pro-max",
    "create-plan",
    "create-pr",
    "stay-in-scope",
    "agent-swarm",
    "tdd",
    "keep-it-simple",
    "research",
    "stop-slop",
    "pr-babysit",
    "resolving-merge-conflicts",
    "fix-ci",
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
    text = skill_file.read_text()
    match = re.search(r"^---\n(.*?)\n---", text, re.DOTALL)
    if not match:
        raise SystemExit(f"missing frontmatter: {skill_file.relative_to(root)}")
    if not re.search(rf"^name:\s*{re.escape(skill_name)}\s*$", match.group(1), re.MULTILINE):
        raise SystemExit(f"wrong skill name: {skill_file.relative_to(root)}")
    if not re.search(r"^description:\s*\S", match.group(1), re.MULTILINE):
        raise SystemExit(f"missing skill description: {skill_file.relative_to(root)}")

manifests = {}
for manifest in [
    root / ".claude-plugin" / "marketplace.json",
    root / ".agents" / "plugins" / "marketplace.json",
    plugin / ".claude-plugin" / "plugin.json",
    plugin / ".codex-plugin" / "plugin.json",
]:
    data = json.loads(manifest.read_text())
    if data.get("name") != "srulik-toolkit":
        raise SystemExit(f"wrong manifest name: {manifest.relative_to(root)}")
    manifests[manifest.relative_to(root).as_posix()] = data
    if "version" in data and data["version"] != "1.1.1":
        raise SystemExit(f"wrong version: {manifest.relative_to(root)}")
    if "hooks" in data:
        raise SystemExit(f"hooks must use default discovery: {manifest.relative_to(root)}")

claude_catalog = manifests[".claude-plugin/marketplace.json"]
codex_catalog = manifests[".agents/plugins/marketplace.json"]
for catalog in [claude_catalog, codex_catalog]:
    entries = catalog.get("plugins", [])
    if len(entries) != 1 or entries[0].get("name") != "srulik-toolkit":
        raise SystemExit("catalog must contain exactly the srulik-toolkit plugin")
if claude_catalog.get("version") != "1.1.1":
    raise SystemExit("wrong Claude marketplace version")
claude_entry = claude_catalog["plugins"][0]
if claude_entry.get("version") != "1.1.1" or claude_entry.get("source") != "./plugins/srulik-toolkit":
    raise SystemExit("wrong Claude catalog version or source")
codex_entry = codex_catalog["plugins"][0]
if codex_entry.get("source") != {"source": "local", "path": "./plugins/srulik-toolkit"}:
    raise SystemExit("wrong Codex catalog source")
if codex_entry.get("policy") != {"installation": "AVAILABLE", "authentication": "ON_INSTALL"}:
    raise SystemExit("wrong Codex catalog policy")
if not codex_entry.get("category"):
    raise SystemExit("missing Codex catalog category")
for harness in ["claude", "codex"]:
    manifest = manifests[f"plugins/srulik-toolkit/.{harness}-plugin/plugin.json"]
    if manifest.get("version") != "1.1.1" or manifest.get("license") != "MIT":
        raise SystemExit(f"wrong {harness} plugin version or license")
    if not manifest.get("description", "").startswith("Thirteen "):
        raise SystemExit(f"stale {harness} plugin skill count")
if manifests["plugins/srulik-toolkit/.codex-plugin/plugin.json"].get("skills") != "./skills/":
    raise SystemExit("wrong Codex skill discovery path")

hook_file = plugin / "hooks" / "hooks.json"
hook_config = json.loads(hook_file.read_text())
if set(hook_config) != {"hooks"} or set(hook_config["hooks"]) != {"SessionStart"}:
    raise SystemExit("hook must contain only SessionStart; no user-visible messages or prompt hooks")
groups = hook_config["hooks"]["SessionStart"]
if not isinstance(groups, list) or len(groups) != 1:
    raise SystemExit("hook must contain one startup matcher")
group = groups[0]
if set(group) != {"matcher", "hooks"} or group["matcher"] != "startup" or len(group["hooks"]) != 1:
    raise SystemExit("hook must run once for startup only")
hook = group["hooks"][0]
if set(hook) != {"type", "command"} or hook["type"] != "command":
    raise SystemExit("hook must contain only a command, with no user-visible warning")
command = hook["command"]
if not isinstance(command, str) or not re.fullmatch(r'echo "[A-Za-z0-9 ,:.-]+"', command):
    raise SystemExit("startup command must be a static ASCII echo with no shell expansion")
message = command[len('echo "'):-1]
if len(message) > 500 or set(re.findall(r"\b[a-z]+(?:-[a-z]+)+\b|\btdd\b|\bresearch\b", message)) != expected:
    raise SystemExit("startup hint must name exactly the thirteen public skills")
if "Read relevant skills" not in message or "scope" not in message:
    raise SystemExit("startup hint must give a relevant-skill and scope instruction")
if os.name == "nt":
    runs = [
        ("cmd.exe", "cmd.exe /d /s /c " + command),
        ("powershell.exe", ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command]),
    ]
else:
    runs = [("/bin/sh", ["/bin/sh", "-c", command])]
for shell_name, invocation in runs:
    result = subprocess.run(invocation, capture_output=True, text=True, timeout=10, check=True)
    output = result.stdout.strip()
    if shell_name == "cmd.exe":
        output = output.strip('"')
    if result.stderr or output != message:
        raise SystemExit(f"startup echo output mismatch in {shell_name}")
    print(f"Startup echo passed: {shell_name}")

for relative in [
    "skills/to-project/EXTEND.md",
    "skills/to-project/templates.md",
    "skills/to-project/base-skills/capture-to-project/SKILL.md",
    "skills/to-project/base-skills/recap-project/SKILL.md",
    "skills/to-project/base-skills/tidy-project/SKILL.md",
    "skills/review-pro-max/code-reviewer.md",
    "skills/tdd/tests.md",
    "skills/tdd/mocking.md",
    "skills/stop-slop/LICENSE",
]:
    if not (plugin / relative).is_file():
        raise SystemExit(f"missing bundled resource: {relative}")

forbidden = [
    "autodesk",
    "zachbonfil",
    "bonfilz",
    "Team" + "Create",
    "Send" + "Message",
    "Task" + "Create",
    "Task" + "Update",
    "~/" + ".config/agent-rules",
    "~/" + ".claude",
    "~/" + ".codex",
    "AECCON-",
    "WPX-",
]
for path in skill_root.rglob("*"):
    if not path.is_file():
        continue
    text = path.read_text(errors="ignore")
    if re.search(r"/Users/[A-Za-z0-9_.-]+|/home/[A-Za-z0-9_.-]+|[A-Za-z]:[\\/]Users[\\/]", text):
        raise SystemExit(f"personal filesystem path: {path.relative_to(root)}")
    for token in forbidden:
        if token.lower() in text.lower():
            raise SystemExit(f"non-portable token {token!r}: {path.relative_to(root)}")
    if path.suffix == ".md":
        # Example code may show paths for a user's project, not bundled resources.
        prose = re.sub(r"```.*?```|`[^`\n]+`", "", text, flags=re.DOTALL)
        for target in re.findall(r"\]\(([^)\s]+)\)", prose):
            if re.match(r"[a-zA-Z][a-zA-Z0-9+.-]*:", target) or target.startswith("#"):
                continue
            resource = (path.parent / target.split("#", 1)[0]).resolve()
            if not resource.is_relative_to(plugin.resolve()) or not resource.exists():
                raise SystemExit(f"missing or external bundled resource {target!r}: {path.relative_to(root)}")

notice = (root / "NOTICE.md").read_text()
license_text = (plugin / "skills" / "stop-slop" / "LICENSE").read_text()
if not all(token in notice for token in ["2024 Zach Bonfil", "CodeRabbit", "Hardik Pandya", "MIT", "stop-slop/LICENSE"]):
    raise SystemExit("missing source attribution in NOTICE.md")
if not all(token in license_text for token in ["MIT License", "2025 Hardik Pandya", "Permission is hereby granted", "THE SOFTWARE IS PROVIDED"]):
    raise SystemExit("missing retained stop-slop copyright or MIT terms")
readme = (root / "README.md").read_text()
for skill_name in expected:
    if f"skills/{skill_name}/SKILL.md" not in readme:
        raise SystemExit(f"README is missing skill: {skill_name}")
if "Thirteen focused skills" not in readme or "/hooks" not in readme:
    raise SystemExit("README must document thirteen skills and Codex hook trust")
PY

if command -v claude >/dev/null 2>&1; then
  claude plugin validate --strict "$repo_root"
  claude plugin validate --strict "$plugin_root"
fi

echo "Srulik Toolkit validation passed."
