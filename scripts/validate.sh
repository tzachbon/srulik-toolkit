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
from urllib.parse import parse_qs, urlparse
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

root = pathlib.Path(sys.argv[1])
plugin = root / "plugins" / "srulik-toolkit"
version = (plugin / "VERSION").read_text(encoding="utf-8").strip()
if version != "1.4.2":
    raise SystemExit("wrong packaged VERSION")
expected = {
    "can-you-help",
    "to-project",
    "review-pro-max",
    "create-plan",
    "implement-plan",
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
    "retro",
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
    text = skill_file.read_text(encoding="utf-8")
    match = re.search(r"^---\n(.*?)\n---", text, re.DOTALL)
    if not match:
        raise SystemExit(f"missing frontmatter: {skill_file.relative_to(root)}")
    if not re.search(rf"^name:\s*{re.escape(skill_name)}\s*$", match.group(1), re.MULTILINE):
        raise SystemExit(f"wrong skill name: {skill_file.relative_to(root)}")
    if not re.search(r"^description:\s*\S", match.group(1), re.MULTILINE):
        raise SystemExit(f"missing skill description: {skill_file.relative_to(root)}")

create_plan = (skill_root / "create-plan" / "SKILL.md").read_text(encoding="utf-8")
engineering_plan = (skill_root / "create-plan" / "references" / "engineering.md").read_text(encoding="utf-8")
dynamic_skills = (skill_root / "create-plan" / "references" / "dynamic-skills.md").read_text(encoding="utf-8")
quality_gates = (skill_root / "create-plan" / "references" / "quality-gates.md").read_text(encoding="utf-8")
keep_it_simple = (skill_root / "keep-it-simple" / "SKILL.md").read_text(encoding="utf-8")
pr_babysit = (skill_root / "pr-babysit" / "SKILL.md").read_text(encoding="utf-8")
skill_routing = (skill_root / "create-plan" / "references" / "skill-routing.md").read_text(encoding="utf-8")
create_plan_openai = (skill_root / "create-plan" / "agents" / "openai.yaml").read_text(encoding="utf-8")
readme = (root / "README.md").read_text(encoding="utf-8")
implement_plan = (skill_root / "implement-plan" / "SKILL.md").read_text(encoding="utf-8")
for dependency in ["create-plan", "agent-swarm", "keep-it-simple", "tdd", "resolving-merge-conflicts", "review-pro-max", "create-pr"]:
    if f"../{dependency}/SKILL.md" not in implement_plan:
        raise SystemExit(f"implement-plan is missing its {dependency} handoff")
for boundary in ["Reject missing dependencies and cycles", "verified and integrated", "workspace binding", "execute ready tasks inline", "without authorization", "user separately", "uncommitted or unmerged"]:
    if boundary not in implement_plan:
        raise SystemExit(f"implement-plan is missing execution boundary: {boundary}")
if "../../implement-plan/SKILL.md" not in skill_routing:
    raise SystemExit("create-plan is missing its implement-plan handoff")

glossary_format = skill_root / "to-project" / "GLOSSARY-FORMAT.md"
if not glossary_format.is_file() or (skill_root / "to-project" / "CONTEXT-FORMAT.md").exists():
    raise SystemExit("to-project must ship the renamed glossary format")
for relative in ["to-project/SKILL.md", "to-project/templates.md", "to-project/EXTEND.md", "to-project/base-skills/capture-to-project/SKILL.md", "to-project/base-skills/recap-project/SKILL.md", "tdd/SKILL.md"]:
    text = (skill_root / relative).read_text(encoding="utf-8")
    if "GLOSSARY.md" not in text or "CONTEXT-FORMAT.md" in text:
        raise SystemExit(f"stale glossary routing: {relative}")
for relative in ["to-project/GLOSSARY-FORMAT.md", "to-project/EXTEND.md", "to-project/base-skills/capture-to-project/SKILL.md", "to-project/base-skills/recap-project/SKILL.md", "tdd/SKILL.md"]:
    if "CONTEXT.md" not in (skill_root / relative).read_text(encoding="utf-8"):
        raise SystemExit(f"missing legacy context compatibility: {relative}")

pr_conventions = (skill_root / "create-pr" / "references" / "conventions.md").read_text(encoding="utf-8")
pr_evidence = (skill_root / "create-pr" / "references" / "evidence.md").read_text(encoding="utf-8")
pr_template = (root / ".github" / "PULL_REQUEST_TEMPLATE.md").read_text(encoding="utf-8")
if not all(section in pr_conventions and f"## {section}" in pr_template for section in ["Evidence", "Merge danger", "Blast radius"]):
    raise SystemExit("PR guidance and template must include evidence, merge danger, and blast radius")
if "../../show-me/SKILL.md" not in pr_conventions or "same scenario" not in pr_evidence:
    raise SystemExit("PR review guidance must connect useful visuals and matched before/after evidence")
if not all(token in keep_it_simple for token in ["plan or implementation", "During planning", "During implementation", "acceptance evidence"]):
    raise SystemExit("keep-it-simple is missing its planning and implementation contract")
if not all(token in create_plan + skill_routing for token in ["Always invoke `keep-it-simple`", "For implementation-oriented plans", "during plan QA"]):
    raise SystemExit("create-plan is missing its keep-it-simple planning or handoff contract")
strict_skill_discovery_contract = create_plan + dynamic_skills + skill_routing
if not all(token in strict_skill_discovery_contract for token in [
    "External discovery is mandatory for every non-trivial plan",
    "one focused external search per material discipline",
    "Loading a discovered skill is optional",
    "SKIPPED: TRIVIAL",
    "Skill discovery: `INCOMPLETE`",
    "after the Expected outcome and Definition of Done are explicit",
    "CLI-native",
    "--agent",
]):
    raise SystemExit("create-plan is missing its strict external skill discovery contract")
for stale_gap_only_rule in [
    "Use this reference only when the installed catalog lacks a material planning or execution capability",
    "If no installed skill covers a material capability",
    "When the installed skill catalog lacks a material planning or execution capability",
]:
    if stale_gap_only_rule in strict_skill_discovery_contract:
        raise SystemExit(f"create-plan retains stale gap-only discovery rule: {stale_gap_only_rule}")
if not all(token in create_plan_openai for token in [
    "$create-plan",
    "mandatory external skill discovery per material discipline",
    "loading remains optional",
    "Skill handoff",
]):
    raise SystemExit("create-plan Codex prompt is missing strict skill discovery guidance")
if not all(token in quality_gates for token in [
    "every material discipline",
    "all strict-trivial conditions",
    "discovery alone did not trigger either action",
]):
    raise SystemExit("create-plan quality gates are missing strict skill discovery evidence")
discovery_surfaces = {
    "create-plan": create_plan,
    "dynamic-skills": dynamic_skills,
    "skill-routing": skill_routing,
    "openai.yaml": create_plan_openai,
    "README": readme,
}
for surface_name, surface in discovery_surfaces.items():
    normalized_surface = " ".join(surface.lower().split())
    if not all(token in normalized_surface for token in [
        "redact or generalize confidential terms before external skill discovery",
        "if safe generalization is not possible",
        "skill discovery: `incomplete`",
    ]):
        raise SystemExit(f"{surface_name} is missing the external discovery confidentiality boundary")
gate8 = quality_gates.split("## Gate 8: skill handoff quality", 1)[1].split("## Gate 9:", 1)[0]
if "At the plan level verify:" not in gate8 or "For each recommended skill additionally verify:" not in gate8:
    raise SystemExit("quality Gate 8 is missing plan-level and recommended-skill scopes")
if gate8.index("At the plan level verify:") > gate8.index("For each recommended skill additionally verify:"):
    raise SystemExit("quality Gate 8 scopes plan-level discovery after recommended skills")
if not all(token in readme for token in [
    "every non-trivial plan",
    "one external search per material discipline",
    "Loading a discovered skill is optional",
]):
    raise SystemExit("README is missing strict create-plan skill discovery guidance")
if "It only searches when the plan has a material capability gap" in readme:
    raise SystemExit("README retains stale gap-only create-plan discovery guidance")
technical_design_contract = create_plan + engineering_plan
if not all(token in technical_design_contract for token in [
    "Every coding plan must include a `## Technical / Coding` section",
    "### High-Level Design",
    "### System APIs",
    "### Low-Level Design",
    "Invoke `show-me`",
    "50-80 lines",
    "Tests, generated code, data, and configuration are excluded",
    "one-use interfaces, factories, wrappers, or speculative extension points",
    "inline handlers or orchestration code that mixes responsibilities",
]):
    raise SystemExit("create-plan is missing its technical design contract")
if not all(token in readme for token in ['"smallest correct plan"', '"smallest correct implementation"']):
    raise SystemExit("README is missing the keep-it-simple planning or implementation flow")
pr_babysit_contract = [
    "The main thread never owns the PR watch",
    "PR events never wake the main thread",
    "## Host capabilities",
    "Launch a thread with a chosen model, its own checkout, a title, and a first message",
    "Give that thread a native PR watch",
    "Report a launched thread's first-run outcome, or wait for it with a time limit that does not cancel the run",
    "- T3 Code: [references/t3-code.md](references/t3-code.md)",
    "For another host, map each capability to its own tools and state the mapping",
    "If capability 1, 2, 3, or 4 is missing, report which one and stop",
    "If only capability 6 is missing, launch anyway and tell the user that startup is unverified",
    "If capability 5 is missing, retire threads by settling or archiving them",
    "Try `gpt-6-luna`, then `claude-haiku-5-5`",
    "Check startup once",
    "Wait once, for up to 2 minutes, for the first run's outcome; a timeout does not cancel the babysitter",
    "retire the thread and relaunch with the next model in the order above",
    "On any other failure, retire it and report the error to the user instead of relaunching",
    "When every candidate has been refused, report the refusals to the user and stop",
    "unless its only run failed with a model-access error",
    "with the model after the refused one",
    "Ended without running (cancelled, interrupted, or rolled back): the babysitter is not running. Retire it and report the status",
    "Completed, still running, or the wait timed out: the babysitter started",
    "rename it to `Retired babysitter for <owner>/<repo>#<number> (<reason>)`, then settle or archive it if the host can",
    "Renaming is the required step",
    "One babysitter per PR",
    "Visible notifications are limited to input needed, readiness changes, monitoring failure, or PR closure",
    "Green CI, missing approvals, silence, and a quiet pass do not stop listening",
    "Forward the user's later instructions",
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
for removed in ['mode: "async"', "The parent owns the listener", "Do not wait for it", "settle that thread", "and settle this thread"]:
    if removed in pr_babysit:
        raise SystemExit(f"pr-babysit still contains a retired design: {removed}")
pr_babysit_t3 = (skill_root / "pr-babysit" / "references" / "t3-code.md").read_text(encoding="utf-8")
pr_babysit_t3_contract = [
    "[host capability](../SKILL.md#host-capabilities)",
    "| 1. Launch a thread | `t3_thread_launch` |",
    "| 2. Native PR watch | `link_pull_request`, `watch_pull_request`, `unwatch_pull_request` |",
    "| 3. Message a thread | `t3_thread_send` |",
    "| 4. List threads by title | `t3_thread_list` |",
    "| 5. Rename a thread | `t3_thread_update` with `action: \"rename\"` |",
    "| 6. First-run outcome | `t3_thread_wait`, then `t3_thread_read` |",
    "| Optional: settle | `t3_thread_organize` with `action: \"settle\"` |",
    "keep only a thread whose `title` matches exactly",
    "Call `orchestrator_capabilities` for the runnable catalog",
    '{ "instanceId": "codex", "model": "gpt-6-luna" }',
    '"startFromOrigin": true',
    "use the fetched local ref or head SHA as `baseRef` with `startFromOrigin: false`",
    "`t3_thread_launch` has no retry key",
    "T3 does not notify the launcher when a top-level thread's run ends",
    "Call `t3_thread_wait` once with the launch's `threadId`, `runId`, and `timeoutMs: 120000`",
    "does not cancel the run",
    "| `cancelled`, `interrupted`, `rolled_back` | Ended without running. |",
    "| `completed`, `running`, or `timedOut: true` | Started. |",
    "There's an issue with the selected model",
    "T3 Code's documented orchestrator tool set does not include `t3_thread_organize`",
    "renaming works on every build",
    "Use `t3_thread_send` with `mode: \"auto\"`",
    "`steer` fails on it",
    "confirm with `list_thread_pull_requests`",
    "Only a top-level thread can own a watch",
    "not `delegate_task`",
    "`action: \"rename\"` and no `threadId`",
    "Report an unexpected end as `MONITORING FAILED`",
    "Not observed: a full babysitter following this skill on a real PR",
]
if not all(token in pr_babysit_t3 for token in pr_babysit_t3_contract):
    missing = [token for token in pr_babysit_t3_contract if token not in pr_babysit_t3]
    raise SystemExit(f"pr-babysit T3 Code reference is missing its implementation contract: {missing}")
if re.search(r"Try `claude-haiku-5-5`, then `gpt-6-luna`|gpt-6-luna`?\)? as (a )?fallback", pr_babysit + pr_babysit_t3):
    raise SystemExit("pr-babysit must keep gpt-6-luna first")
if "Leave questions awaiting an answer open" in pr_babysit:
    raise SystemExit("pr-babysit must not leave review questions unresolved")
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
    data = json.loads(manifest.read_text(encoding="utf-8"))
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
    if not manifest.get("description", "").startswith("Eighteen "):
        raise SystemExit(f"stale {harness} plugin skill count")
if manifests["plugins/srulik-toolkit/.codex-plugin/plugin.json"].get("skills") != "./skills/":
    raise SystemExit("wrong Codex skill discovery path")

hook_file = plugin / "hooks" / "hooks.json"
hook_config = json.loads(hook_file.read_text(encoding="utf-8"))
if set(hook_config) != {"hooks"} or set(hook_config["hooks"]) != {"SessionStart", "Stop"}:
    raise SystemExit("hook must contain SessionStart and Stop only")
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
stop_groups = hook_config["hooks"]["Stop"]
if not isinstance(stop_groups, list) or len(stop_groups) != 1 or set(stop_groups[0]) != {"hooks"}:
    raise SystemExit("Stop hook must have one unfiltered group")
stop_hooks = stop_groups[0]["hooks"]
if len(stop_hooks) != 1 or stop_hooks[0] != {
    "type": "command",
    "command": 'node -e "require((process.env.PLUGIN_ROOT || process.env.CLAUDE_PLUGIN_ROOT) + \'/hooks/blocked-stop.js\')"',
    "timeout": 3,
}:
    raise SystemExit("Stop hook must invoke the packaged recovery check")

node = shutil.which("node")
if not node:
    raise SystemExit("Node.js is required by the startup hook")

def stop_check(payload, disabled=False):
    env = os.environ.copy()
    env.pop("SRULIK_TOOLKIT_BLOCKED_STOP", None)
    if disabled:
        env["SRULIK_TOOLKIT_BLOCKED_STOP"] = "0"
    result = subprocess.run(
        [node, str(plugin / "hooks" / "blocked-stop.js")],
        input=payload if isinstance(payload, str) else json.dumps(payload),
        env=env, capture_output=True, text=True, timeout=30, check=True,
    )
    if result.stderr:
        raise SystemExit(f"Stop hook wrote stderr: {result.stderr}")
    return result.stdout.strip()

class ModelsHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.headers.get("x-api-key") != "test-key":
            self.send_response(401); self.end_headers(); return
        def model(slug, intelligence, price):
            return {"slug": slug, "name": slug, "model_creator": {"name": "Lab"},
                    "evaluations": {"artificial_analysis_intelligence_index": intelligence},
                    "pricing": {"price_1m_input_tokens": price, "price_1m_output_tokens": price},
                    "performance": {"median_output_tokens_per_second": 100}}
        pages = {"1": [model("smart", 60, 10), model("cheap", 40, 0.2)],
                 "2": [model("dominated", 39, 5), model("unpriced", 50, None)]}
        page = parse_qs(urlparse(self.path).query).get("page", ["1"])[0]
        body = json.dumps({"data": pages.get(page, []), "pagination": {"page": int(page), "has_more": page == "1"}}).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(body)
    def log_message(self, *_):
        pass

models_server = ThreadingHTTPServer(("127.0.0.1", 0), ModelsHandler)
threading.Thread(target=models_server.serve_forever, daemon=True).start()

def models(*args, key="test-key", data_root):
    env = {k: v for k, v in os.environ.items() if k != "ARTIFICIAL_ANALYSIS_API_KEY"}
    env |= {"PLUGIN_DATA": str(data_root), "ARTIFICIAL_ANALYSIS_URL": f"http://127.0.0.1:{models_server.server_port}/"}
    if key:
        env["ARTIFICIAL_ANALYSIS_API_KEY"] = key
    return subprocess.run([node, str(plugin / "scripts" / "models.js"), *args], env=env, capture_output=True, text=True, timeout=30)

with tempfile.TemporaryDirectory() as temporary:
    if models(key=None, data_root=temporary).returncode != 2:
        raise SystemExit("models.js must exit 2 without an API key")
    ranked = json.loads(models(data_root=temporary).stdout)["models"]
    if [m["slug"] for m in ranked] != ["smart", "cheap", "dominated"]:
        raise SystemExit(f"models.js must rank priced models by intelligence: {ranked}")
    frontier = [m["slug"] for m in json.loads(models("--frontier", data_root=temporary).stdout)["models"]]
    if frontier != ["smart", "cheap"]:
        raise SystemExit(f"models.js frontier must drop dominated models: {frontier}")
    if [m["slug"] for m in json.loads(models("chea", data_root=temporary).stdout)["models"]] != ["cheap"]:
        raise SystemExit("models.js must filter by name or slug")
models_server.shutdown()

stop_input = {"hook_event_name": "Stop", "stop_hook_active": False}
for message in [
    "Blocked: GitHub sign-in needs an approved email code.",
    "Blocked: no access to GitHub.",
    "Blocked: not authenticated.",
    "I'm blocked by a missing repository permission.",
    "I can’t proceed with the available access.",
]:
    output = json.loads(stop_check(stop_input | {"last_assistant_message": message}))
    if output.get("decision") != "block" or "authorized route" not in output.get("reason", ""):
        raise SystemExit(f"Stop hook did not deliver recovery context for {message!r}")
for message in [
    "Completed: the GitHub login works.",
    "Completed: the task was blocked earlier, but the login now works.",
    "Blocked: none; all checks passed.",
    "**Blocked:** none; all checks passed.",
    "Previously blocked by login; this is resolved.",
    "Blocked: missing permission (resolved).",
    "Blocked: missing permission.\nResolved: signed in successfully; task complete.",
    "Example output:\n```text\nBlocked: a missing permission.\n```\nThe task is complete.",
]:
    if stop_check(stop_input | {"last_assistant_message": message}):
        raise SystemExit(f"Stop hook misclassified completed work: {message!r}")
blocked_input = stop_input | {"last_assistant_message": "Blocked: access is unavailable."}
if stop_check(blocked_input | {"stop_hook_active": True}):
    raise SystemExit("Stop hook must allow the second stop")
if stop_check(blocked_input, disabled=True):
    raise SystemExit("Stop hook opt-out must be silent")
if stop_check(stop_input) or stop_check(blocked_input | {"hook_event_name": "SubagentStop"}) or stop_check("{"):
    raise SystemExit("Stop hook must fail open on missing, unrelated, or malformed input")
print("Blocked Stop hook passed")

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
    result = subprocess.run([node, str(plugin / "hooks" / "check-version.js")], env=env, capture_output=True, text=True, timeout=30, check=True)
    if result.stderr or not result.stdout.startswith(hint_start):
        raise SystemExit(f"version checker did not preserve startup hint: {result.stderr or result.stdout}")
    advertised = set(result.stdout.splitlines()[0].split("skills: ", 1)[1].split(". Read", 1)[0].split(", "))
    if advertised != expected:
        raise SystemExit(f"startup hint differs from packaged skills: {sorted(advertised ^ expected)}")
    return result.stdout

with tempfile.TemporaryDirectory() as temporary:
    data = pathlib.Path(temporary)
    startup = check("/equal", data)
    advertised = startup.split(hint_start, 1)[1].split(". Read relevant skills", 1)[0].strip()
    if set(advertised.split(", ")) != expected:
        raise SystemExit("startup hint must advertise every packaged skill")
    if "is available" in startup:
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
    "skills/to-project/GLOSSARY-FORMAT.md",
    "skills/to-project/templates.md",
    "skills/to-project/base-skills/capture-to-project/SKILL.md",
    "skills/to-project/base-skills/recap-project/SKILL.md",
    "skills/to-project/base-skills/tidy-project/SKILL.md",
    "skills/review-pro-max/code-reviewer.md",
    "skills/tdd/tests.md",
    "skills/tdd/mocking.md",
    "skills/stop-slop/LICENSE",
    "skills/show-me/LICENSE",
    "skills/retro/LICENSE",
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
    text = path.read_text(encoding="utf-8", errors="ignore")
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

notice = (root / "NOTICE.md").read_text(encoding="utf-8")
license_text = (plugin / "skills" / "stop-slop" / "LICENSE").read_text(encoding="utf-8")
show_me_license = (plugin / "skills" / "show-me" / "LICENSE").read_text(encoding="utf-8")
retro_license = (plugin / "skills" / "retro" / "LICENSE").read_text(encoding="utf-8")
if not all(token in notice for token in ["2024 Zach Bonfil", "CodeRabbit", "Hardik Pandya", "MIT", "stop-slop/LICENSE", "HumanLayer", "2026", "https://github.com/humanlayer/skills", "show-me/LICENSE"]):
    raise SystemExit("missing source attribution in NOTICE.md")
if not all(token in license_text for token in ["MIT License", "2025 Hardik Pandya", "Permission is hereby granted", "THE SOFTWARE IS PROVIDED"]):
    raise SystemExit("missing retained stop-slop copyright or MIT terms")
if not all(token in show_me_license for token in ["MIT License", "Copyright (c) 2026 HumanLayer", "Permission is hereby granted", "THE SOFTWARE IS PROVIDED"]):
    raise SystemExit("missing retained show-me copyright or MIT terms")
if not all(token in notice for token in ["Matt Pocock", "https://github.com/mattpocock/skills", "retro/LICENSE"]):
    raise SystemExit("missing retro source attribution in NOTICE.md")
if not all(token in retro_license for token in ["MIT License", "Copyright (c) 2026 Matt Pocock", "Permission is hereby granted", "THE SOFTWARE IS PROVIDED"]):
    raise SystemExit("missing retained retro copyright or MIT terms")

tour = (skill_root / "tour" / "SKILL.md").read_text(encoding="utf-8")
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
if "Eighteen focused skills" not in readme or "/hooks" not in readme:
    raise SystemExit("README must document eighteen skills and Codex hook trust")

outcome_dod_contract = "Outcome and Definition of Done gate"
create_plan_text = (skill_root / "create-plan" / "SKILL.md").read_text(encoding="utf-8")
grilling_text = (skill_root / "create-plan" / "references" / "grilling.md").read_text(encoding="utf-8")
for relative, text in [
    ("skills/create-plan/SKILL.md", create_plan_text),
    ("skills/create-plan/references/grilling.md", grilling_text),
]:
    if outcome_dod_contract not in text:
        raise SystemExit(f"missing outcome and Definition of Done gate: {relative}")
    for required_phrase in [
        "Expected outcome",
        "Definition of Done",
        "separate grill questions",
        "occupy two slots",
        "authoritative",
        "Neither item may be deferred",
        "The readiness gate cannot pass while",
    ]:
        if required_phrase not in text:
            raise SystemExit(f"missing {required_phrase!r} from outcome and DoD contract: {relative}")
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
