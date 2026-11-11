# mcporter-plugin: manifests, catalog entries, hook wiring, skill contracts, and
# the behavior test (scripts/test-mcporter-plugin.js) against a fake mcporter.
mcp_plugin = root / "plugins" / "mcporter-plugin"
mcp_version = "0.1.0"
for harness in ["claude", "codex"]:
    data = json.loads((mcp_plugin / f".{harness}-plugin" / "plugin.json").read_text(encoding="utf-8"))
    if data.get("name") != "mcporter-plugin" or data.get("version") != mcp_version or data.get("license") != "MIT":
        raise SystemExit(f"wrong mcporter-plugin {harness} manifest")
if claude_catalog["plugins"][1].get("source") != "./plugins/mcporter-plugin" or claude_catalog["plugins"][1].get("version") != mcp_version:
    raise SystemExit("wrong mcporter-plugin Claude catalog entry")
if codex_catalog["plugins"][1].get("source") != {"source": "local", "path": "./plugins/mcporter-plugin"}:
    raise SystemExit("wrong mcporter-plugin Codex catalog entry")

mcp_hooks = json.loads((mcp_plugin / "hooks" / "hooks.json").read_text(encoding="utf-8"))["hooks"]
if set(mcp_hooks) != {"SessionStart", "PreToolUse"} or mcp_hooks["PreToolUse"][0]["matcher"] != "mcp__.*":
    raise SystemExit("mcporter-plugin hooks must be SessionStart and PreToolUse on mcp__.*")
for event, script in [("SessionStart", "session-hint.js"), ("PreToolUse", "redirect-mcp.js")]:
    if script not in mcp_hooks[event][0]["hooks"][0]["command"] or not (mcp_plugin / "hooks" / script).is_file():
        raise SystemExit(f"mcporter-plugin {event} hook must run hooks/{script}")
if "config\", \"list\", \"--json\"" not in (mcp_plugin / "scripts" / "mcporter-common.js").read_text(encoding="utf-8"):
    raise SystemExit("session hint must read `mcporter config list --json`")

for name, tokens in {
    "mcporter-setup": ["Never delete a harness MCP entry", "Disable only", "deniedMcpServers", "enabled = false", "receipt", "undo", "approves step 3", "mcporter auth", "only after mcporter reached the server", "Never print secret values", "disabledMcpjsonServers", "--force"],
    "mcporter": [".mcporter/scripts/", "README.md", "createRuntime()", "mcporter record", "mcporter replay", "Reuse or extend", "stderr"],
}.items():
    text = (mcp_plugin / "skills" / name / "SKILL.md").read_text(encoding="utf-8")
    if not text.startswith(f"---\nname: {name}\n") or not all(t in text for t in tokens):
        raise SystemExit(f"mcporter-plugin skill {name} is missing its contract")
for example in ["README.md", "inventory-gold-stock.mjs", "inventory-item.sh"]:
    if not (mcp_plugin / "skills" / "mcporter" / "examples" / ".mcporter" / "scripts" / example).is_file():
        raise SystemExit(f"missing mcporter example script {example}")
bench = (mcp_plugin / "benchmark" / "README.md").read_text(encoding="utf-8")
if not all(t in bench for t in ["Input tokens", "Time", "results-20-pages.json", "results-4-pages.json"]):
    raise SystemExit("mcporter benchmark README must report tokens and time with raw data")

subprocess.run([node, str(root / "scripts" / "test-mcporter-plugin.js")], check=True, timeout=60, stdout=subprocess.DEVNULL)
