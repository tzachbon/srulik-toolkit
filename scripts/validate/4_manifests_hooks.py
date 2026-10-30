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
    if "hooks" in data and manifest != plugin / ".cursor-plugin" / "plugin.json":
        raise SystemExit(f"hooks must use default discovery: {manifest.relative_to(root)}")

claude_catalog = manifests[".claude-plugin/marketplace.json"]
codex_catalog = manifests[".agents/plugins/marketplace.json"]
cursor_catalog = manifests[".cursor-plugin/marketplace.json"]
for catalog in [claude_catalog, codex_catalog, cursor_catalog]:
    entries = catalog.get("plugins", [])
    if len(entries) != 1 or entries[0].get("name") != "srulik-toolkit":
        raise SystemExit("catalog must contain exactly the srulik-toolkit plugin")
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
    if not manifest.get("description", "").startswith("Twenty-one "):
        raise SystemExit(f"stale {harness} plugin skill count")
if manifests["plugins/srulik-toolkit/.codex-plugin/plugin.json"].get("skills") != "./skills/":
    raise SystemExit("wrong Codex skill discovery path")
cursor_manifest = manifests["plugins/srulik-toolkit/.cursor-plugin/plugin.json"]
if cursor_manifest.get("skills") != "./skills/":
    raise SystemExit("wrong Cursor skill discovery path")
if cursor_manifest.get("hooks") != "./hooks/hooks-cursor.json" or not (plugin / cursor_manifest["hooks"]).is_file():
    raise SystemExit("Cursor manifest must point at an existing hooks/hooks-cursor.json")
cursor_hooks = json.loads((plugin / "hooks" / "hooks-cursor.json").read_text(encoding="utf-8"))
if cursor_hooks != {"version": 1, "hooks": {"sessionStart": [{"command": "node ./hooks/check-version.js", "timeout": 3}]}}:
    raise SystemExit("Cursor hooks must run the packaged version checker on sessionStart only")
if not all(token in readme for token in ["### Cursor", "~/.cursor/plugins/local/srulik-toolkit", "instead of symlinking", "hooks/hooks-cursor.json"]):
    raise SystemExit("README must document the Cursor local install and startup hook")

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
