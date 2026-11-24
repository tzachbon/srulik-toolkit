star_contract = [
    ".create-plan-star-suggested",
    "https://github.com/tzachbon/srulik-toolkit",
    "Optional:",
    "machine-persistent state directory",
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
    root / ".cursor-plugin" / "marketplace.json",
    plugin / ".claude-plugin" / "plugin.json",
    plugin / ".codex-plugin" / "plugin.json",
    plugin / ".cursor-plugin" / "plugin.json",
]:
    data = json.loads(manifest.read_text(encoding="utf-8"))
    if data.get("name") != "srulik-toolkit":
        raise SystemExit(f"wrong manifest name: {manifest.relative_to(root)}")
    manifests[manifest.relative_to(root).as_posix()] = data
    if "version" in data and data["version"] != version:
        raise SystemExit(f"wrong version: {manifest.relative_to(root)}")
    if "hooks" in data and manifest not in [plugin / ".cursor-plugin" / "plugin.json", plugin / ".codex-plugin" / "plugin.json"]:
        raise SystemExit(f"hooks must use default discovery: {manifest.relative_to(root)}")

claude_catalog = manifests[".claude-plugin/marketplace.json"]
codex_catalog = manifests[".agents/plugins/marketplace.json"]
cursor_catalog = manifests[".cursor-plugin/marketplace.json"]
for catalog in [claude_catalog, codex_catalog]:
    if [entry.get("name") for entry in catalog.get("plugins", [])] != ["srulik-toolkit", "mcporter-plugin"]:
        raise SystemExit("catalog must list srulik-toolkit, then mcporter-plugin")
if [entry.get("name") for entry in cursor_catalog.get("plugins", [])] != ["srulik-toolkit"]:
    raise SystemExit("Cursor catalog must contain exactly the srulik-toolkit plugin")
if cursor_catalog.get("owner", {}).get("name") != "Zach Bonfil":
    raise SystemExit("Cursor marketplace needs an owner name")
if cursor_catalog["plugins"][0] != {"name": "srulik-toolkit", "source": "plugins/srulik-toolkit"}:
    raise SystemExit("Cursor catalog must point at plugins/srulik-toolkit without restating its manifest")
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
for harness in ["claude", "codex", "cursor"]:
    manifest = manifests[f"plugins/srulik-toolkit/.{harness}-plugin/plugin.json"]
    if manifest.get("version") != version or manifest.get("license") != "MIT":
        raise SystemExit(f"wrong {harness} plugin version or license")
    if not manifest.get("description", "").startswith("Twenty-six "):
        raise SystemExit(f"stale {harness} plugin skill count")
if manifests["plugins/srulik-toolkit/.codex-plugin/plugin.json"].get("skills") != "./skills/":
    raise SystemExit("wrong Codex skill discovery path")
cursor_manifest = manifests["plugins/srulik-toolkit/.cursor-plugin/plugin.json"]
if cursor_manifest.get("skills") != "./skills/":
    raise SystemExit("wrong Cursor skill discovery path")
if cursor_manifest.get("hooks") != "./hooks/hooks-cursor.json" or not (plugin / cursor_manifest["hooks"]).is_file():
    raise SystemExit("Cursor manifest must point at an existing hooks/hooks-cursor.json")
def run_hook(script, mode=None, harness=None):
    tail = f" {mode} {harness}" if mode else ""
    return f'node -e "require((process.env.PLUGIN_ROOT || process.env.CLAUDE_PLUGIN_ROOT) + \'/{script}\')"{tail}'
def command_hook(command):
    return {"type": "command", "command": command, "timeout": 3}
# Codex has no PostToolUseFailure, and its PostToolUse also runs after a failed command.
for name, harness, failure in [("hooks.json", "claude", "PostToolUseFailure"), ("codex-hooks.json", "codex", "PostToolUse")]:
    expected_hooks = {"hooks": {
        "SessionStart": [{"matcher": "startup", "hooks": [command_hook(run_hook("hooks/check-version.js")), command_hook(run_hook("scripts/learn.js", "start", harness))]}],
        "UserPromptSubmit": [{"hooks": [command_hook(run_hook("scripts/learn.js", "capture", harness))]}],
        failure: [{"matcher": "Bash", "hooks": [command_hook(run_hook("scripts/learn.js", "capture", harness))]}],
        "Stop": [{"hooks": [command_hook(run_hook("hooks/blocked-stop.js"))]}],
    }}
    if json.loads((plugin / "hooks" / name).read_text(encoding="utf-8")) != expected_hooks:
        raise SystemExit(f"hooks/{name} must run the version checker and learn start at startup, learn capture on prompts and failed Bash, and the recovery check on Stop")
if manifests["plugins/srulik-toolkit/.codex-plugin/plugin.json"].get("hooks") != "./hooks/codex-hooks.json":
    raise SystemExit("Codex manifest must point at hooks/codex-hooks.json")
cursor_hooks = json.loads((plugin / "hooks" / "hooks-cursor.json").read_text(encoding="utf-8"))
if cursor_hooks != {"version": 1, "hooks": {
    "sessionStart": [{"command": "node ./hooks/check-version.js", "timeout": 3}, {"command": "node ./scripts/learn.js start cursor", "timeout": 3}],
    "beforeSubmitPrompt": [{"command": "node ./scripts/learn.js capture cursor", "timeout": 3}],
    "postToolUseFailure": [{"command": "node ./scripts/learn.js capture cursor", "timeout": 3}],
}}:
    raise SystemExit("Cursor hooks must run the version checker and learn start on sessionStart, and learn capture on prompts and tool failures")
if not all(token in readme for token in ["### Cursor", "~/.cursor/plugins/local/srulik-toolkit", "instead of symlinking", "hooks/hooks-cursor.json"]):
    raise SystemExit("README must document the Cursor local install and startup hook")

node = shutil.which("node")
if not node:
    raise SystemExit("Node.js is required by the startup hook")

def stop_check(payload, disabled=False):
    env = os.environ.copy()
    env.pop("SRULIK_TOOLKIT_BLOCKED_STOP", None)
    env.pop("SRULIK_TOOLKIT_DEFERRED_STOP", None)
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

for surface_name, surface in {
    "models.js": (plugin / "scripts" / "models.js").read_text(encoding="utf-8"),
    "agent-swarm": agent_swarm, "pr-babysit": pr_babysit, "README": readme,
    "NOTICE": (root / "NOTICE.md").read_text(encoding="utf-8"),
}.items():
    if "ARTIFICIAL_ANALYSIS_API_KEY" in surface or "artificialanalysis.ai/api/" in surface:
        raise SystemExit(f"{surface_name} must use the public dataset without an API key")
if "dataset without an API key" not in (root / "NOTICE.md").read_text(encoding="utf-8"):
    raise SystemExit("NOTICE must attribute the keyless public dataset")
if "public Artificial Analysis dataset without an API key" not in pr_babysit:
    raise SystemExit("pr-babysit must use the keyless public dataset")
subprocess.run([node, str(root / "scripts" / "test-models.js")], check=True, timeout=90)
