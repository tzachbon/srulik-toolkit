#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
plugin_root="$repo_root/plugins/srulik-toolkit"

python3 - "$repo_root" <<'PY'
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

root = pathlib.Path(sys.argv[1])
plugin = root / "plugins" / "srulik-toolkit"
version = (plugin / "VERSION").read_text().strip()
if version != "1.1.5":
    raise SystemExit("wrong packaged VERSION")
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
    "tour",
    "show-me",
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

create_plan = (skill_root / "create-plan" / "SKILL.md").read_text()
keep_it_simple = (skill_root / "keep-it-simple" / "SKILL.md").read_text()
skill_routing = (skill_root / "create-plan" / "references" / "skill-routing.md").read_text()
readme = (root / "README.md").read_text()
if not all(token in keep_it_simple for token in ["plan or implementation", "During planning", "During implementation", "acceptance evidence"]):
    raise SystemExit("keep-it-simple is missing its planning and implementation contract")
if not all(token in create_plan + skill_routing for token in ["Always invoke `keep-it-simple`", "For implementation-oriented plans", "during plan QA"]):
    raise SystemExit("create-plan is missing its keep-it-simple planning or handoff contract")
if not all(token in readme for token in ['"smallest correct plan"', '"smallest correct implementation"']):
    raise SystemExit("README is missing the keep-it-simple planning or implementation flow")
star_contract = [
    ".create-plan-star-suggested",
    "https://github.com/tzachbon/srulik-toolkit",
    "Optional:",
    "machine-persistent state directory",
    "plugins/data/srulik-toolkit-srulik-toolkit",
    "Never derive state from this skill's installation or cache path",
    "Create the marker before adding the suggestion",
    "Already exists: deliver the plan without the suggestion",
    "Any other read or write failure: append the suggestion anyway",
]
if not all(token in create_plan for token in star_contract):
    raise SystemExit("create-plan is missing the one-time star suggestion contract")

def claim_star_suggestion(marker, mkdir=os.mkdir):
    try:
        mkdir(marker)
        return True
    except FileExistsError:
        return False
    except OSError:
        return True

with tempfile.TemporaryDirectory() as temp_dir:
    marker = pathlib.Path(temp_dir) / ".create-plan-star-suggested"
    if not claim_star_suggestion(marker) or claim_star_suggestion(marker):
        raise SystemExit("star suggestion marker does not suppress later runs")

with tempfile.TemporaryDirectory() as temp_dir:
    marker = pathlib.Path(temp_dir) / ".create-plan-star-suggested"
    with ThreadPoolExecutor(max_workers=2) as pool:
        claims = list(pool.map(lambda _: claim_star_suggestion(marker), range(2)))
    if claims.count(True) != 1:
        raise SystemExit("concurrent star suggestion claims did not produce one winner")

def fail_write(_marker):
    raise PermissionError

if not claim_star_suggestion("unused", fail_write):
    raise SystemExit("star suggestion must be shown when state cannot be written")

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
    if "version" in data and data["version"] != version:
        raise SystemExit(f"wrong version: {manifest.relative_to(root)}")
    if "hooks" in data:
        raise SystemExit(f"hooks must use default discovery: {manifest.relative_to(root)}")

claude_catalog = manifests[".claude-plugin/marketplace.json"]
codex_catalog = manifests[".agents/plugins/marketplace.json"]
for catalog in [claude_catalog, codex_catalog]:
    entries = catalog.get("plugins", [])
    if len(entries) != 1 or entries[0].get("name") != "srulik-toolkit":
        raise SystemExit("catalog must contain exactly the srulik-toolkit plugin")
if claude_catalog.get("version") != version:
    raise SystemExit("wrong Claude marketplace version")
claude_entry = claude_catalog["plugins"][0]
if claude_entry.get("version") != version or claude_entry.get("source") != "./plugins/srulik-toolkit":
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
    if manifest.get("version") != version or manifest.get("license") != "MIT":
        raise SystemExit(f"wrong {harness} plugin version or license")
    if not manifest.get("description", "").startswith("Fifteen "):
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
if set(hook) != {"type", "command", "timeout"} or hook["type"] != "command" or hook["timeout"] != 3:
    raise SystemExit("hook must contain one three-second command")
command = hook["command"]
if command != 'node -e "require((process.env.PLUGIN_ROOT || process.env.CLAUDE_PLUGIN_ROOT) + \'/hooks/check-version.js\')"':
    raise SystemExit("startup hook must invoke the packaged version checker")

node = shutil.which("node")
if not node:
    raise SystemExit("Node.js is required by the startup hook")

requests = {}
class VersionHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        requests[self.path] = requests.get(self.path, 0) + 1
        if self.path == "/slow":
            time.sleep(0.2)
        body = {"/equal": version, "/new": "9.9.9", "/bad": "not-a-version", "/slow": "9.9.9"}.get(self.path)
        self.send_response(200 if body else 404)
        self.end_headers()
        try:
            self.wfile.write((body or "missing").encode())
        except BrokenPipeError:
            pass
    def log_message(self, *_):
        pass

server = ThreadingHTTPServer(("127.0.0.1", 0), VersionHandler)
threading.Thread(target=server.serve_forever, daemon=True).start()
base_url = f"http://127.0.0.1:{server.server_port}"
hint_start = "Srulik Toolkit skills:"

def check(endpoint, data_root, timeout="2000"):
    env = os.environ | {
        "PLUGIN_ROOT": str(plugin),
        "PLUGIN_DATA": str(data_root),
        "SRULIK_TOOLKIT_VERSION_URL": base_url + endpoint,
        "SRULIK_TOOLKIT_VERSION_TIMEOUT_MS": timeout,
    }
    result = subprocess.run([node, str(plugin / "hooks" / "check-version.js")], env=env, capture_output=True, text=True, timeout=5, check=True)
    if result.stderr or not result.stdout.startswith(hint_start):
        raise SystemExit(f"version checker did not preserve startup hint: {result.stderr or result.stdout}")
    return result.stdout

with tempfile.TemporaryDirectory() as temporary:
    data = pathlib.Path(temporary)
    if "is available" in check("/equal", data):
        raise SystemExit("equal versions must not suggest an upgrade")
with tempfile.TemporaryDirectory() as temporary:
    data = pathlib.Path(temporary)
    if "9.9.9 is available" not in check("/new", data):
        raise SystemExit("version mismatch must suggest an upgrade")
    check("/new", data)
    if requests.get("/new") != 1:
        raise SystemExit("fresh cached version must prevent a second request")
with tempfile.TemporaryDirectory() as temporary:
    if "is available" in check("/bad", pathlib.Path(temporary)):
        raise SystemExit("invalid upstream version must be silent")
with tempfile.TemporaryDirectory() as temporary:
    if "is available" in check("/slow", pathlib.Path(temporary), "50"):
        raise SystemExit("timed-out upstream request must be silent")
server.shutdown()
print("Startup version checker passed")

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
    "skills/show-me/LICENSE",
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
show_me_license = (plugin / "skills" / "show-me" / "LICENSE").read_text()
if not all(token in notice for token in ["2024 Zach Bonfil", "CodeRabbit", "Hardik Pandya", "MIT", "stop-slop/LICENSE", "HumanLayer", "2026", "https://github.com/humanlayer/skills", "show-me/LICENSE"]):
    raise SystemExit("missing source attribution in NOTICE.md")
if not all(token in license_text for token in ["MIT License", "2025 Hardik Pandya", "Permission is hereby granted", "THE SOFTWARE IS PROVIDED"]):
    raise SystemExit("missing retained stop-slop copyright or MIT terms")
if not all(token in show_me_license for token in ["MIT License", "Copyright (c) 2026 HumanLayer", "Permission is hereby granted", "THE SOFTWARE IS PROVIDED"]):
    raise SystemExit("missing retained show-me copyright or MIT terms")

tour = (skill_root / "tour" / "SKILL.md").read_text()
tour_contract = [
    "Invoke `$research` for every tour",
    "very thorough",
    "chat-only output",
    "after the initial research",
    "materially change the tour's scope, chronology, or interpretation",
    "invoke `$show-me` for every completed tour",
    "OS-managed temporary path outside the repository",
    "Context-encode every untrusted topic, repository, and research value",
    "keep scripts static and trusted, and load no remote resources",
    "OS-managed temporary Markdown file outside the repository",
    "verified facts, user decisions, inferences, and unresolved gaps",
]
if not all(token in tour for token in tour_contract):
    raise SystemExit("tour is missing its research, grilling, visualization, or delivery contract")

for skill_name in expected:
    if f"skills/{skill_name}/SKILL.md" not in readme:
        raise SystemExit(f"README is missing skill: {skill_name}")
if "Fifteen focused skills" not in readme or "/hooks" not in readme:
    raise SystemExit("README must document fifteen skills and Codex hook trust")
PY

if command -v claude >/dev/null 2>&1; then
  claude plugin validate --strict "$repo_root"
  claude plugin validate --strict "$plugin_root"
fi

if [[ "${GITHUB_EVENT_NAME:-}" == "pull_request" && "${RUNNER_OS:-}" == "Linux" ]]; then
  git fetch --no-tags --depth=1 origin "$GITHUB_BASE_REF"
  "$repo_root/scripts/check-version-bump.sh" FETCH_HEAD
fi

echo "Srulik Toolkit validation passed."
