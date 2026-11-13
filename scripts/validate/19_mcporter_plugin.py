# mcporter-plugin: manifests, catalog entries, hook wiring, skill contracts, and
# the behavior test (scripts/test-mcporter-plugin.js) against a fake mcporter.
mcp_plugin = root / "plugins" / "mcporter-plugin"
mcp_version = "0.1.2"
for harness in ["claude", "codex"]:
    data = json.loads((mcp_plugin / f".{harness}-plugin" / "plugin.json").read_text(encoding="utf-8"))
    if data.get("name") != "mcporter-plugin" or data.get("version") != mcp_version or data.get("license") != "MIT":
        raise SystemExit(f"wrong mcporter-plugin {harness} manifest")
if claude_catalog["plugins"][1].get("source") != "./plugins/mcporter-plugin" or claude_catalog["plugins"][1].get("version") != mcp_version:
    raise SystemExit("wrong mcporter-plugin Claude catalog entry")
if codex_catalog["plugins"][1].get("source") != {"source": "local", "path": "./plugins/mcporter-plugin"}:
    raise SystemExit("wrong mcporter-plugin Codex catalog entry")

mcp_hooks = json.loads((mcp_plugin / "hooks" / "hooks.json").read_text(encoding="utf-8"))["hooks"]
codex_hooks = json.loads((mcp_plugin / "hooks" / "codex-hooks.json").read_text(encoding="utf-8"))["hooks"]
# Codex has no PostToolUseFailure; its PostToolUse also runs after a failed command.
for hooks, failure in [(mcp_hooks, "PostToolUseFailure"), (codex_hooks, "PostToolUse")]:
    if set(hooks) != {"SessionStart", "PreToolUse", failure} or hooks["PreToolUse"][0]["matcher"] != "mcp__.*" or hooks[failure][0]["matcher"] != "Bash":
        raise SystemExit(f"mcporter-plugin hooks must be SessionStart, PreToolUse on mcp__.* and {failure} on Bash")
    for event, script in [("SessionStart", "session-hint.js"), ("PreToolUse", "redirect-mcp.js"), (failure, "auth-notice.js")]:
        if script not in hooks[event][0]["hooks"][0]["command"] or not (mcp_plugin / "hooks" / script).is_file():
            raise SystemExit(f"mcporter-plugin {event} hook must run hooks/{script}")
if "config\", \"list\", \"--json\"" not in (mcp_plugin / "scripts" / "mcporter-common.js").read_text(encoding="utf-8"):
    raise SystemExit("session hint must read `mcporter config list --json`")

for name, tokens in {
    "mcporter-setup": ["Never delete a harness MCP entry", "Disable only", "receipt", "undo", "approves step 3", "mcporter auth", "only after mcporter reached the server", "Never print secret values", "--force", "narrowest scope", "references/claude-code.md", "references/codex.md"],
    "mcporter": [".mcporter/scripts/", "README.md", "createRuntime()", "mcporter record", "mcporter replay", "Reuse or extend", "stderr", "mcporter auth <name>", "MCPORTER_OAUTH_NO_BROWSER=1"],
}.items():
    text = (mcp_plugin / "skills" / name / "SKILL.md").read_text(encoding="utf-8")
    if not text.startswith(f"---\nname: {name}\n") or not all(t in text for t in tokens):
        raise SystemExit(f"mcporter-plugin skill {name} is missing its contract")
# Generic core, host-specific references (CODING_STANDARDS.md): the setup core
# names no host switch; each reference carries its own contract.
setup_refs = mcp_plugin / "skills" / "mcporter-setup" / "references"
setup_core = (mcp_plugin / "skills" / "mcporter-setup" / "SKILL.md").read_text(encoding="utf-8")
if any(t in setup_core for t in ["deniedMcpServers", "disabledMcpjsonServers", "disabledMcpServers", "enabled = false", "settings.local.json", ".claude.json"]):
    raise SystemExit("mcporter-setup core must keep host switches in its references")
for ref, tokens in {
    "claude-code.md": ["deniedMcpServers", "disabledMcpjsonServers", "disabledMcpServers", "CLAUDE_CONFIG_DIR", ".mcp.json", "manual"],
    "codex.md": ["enabled = false", "$CODEX_HOME", "inline table", "multi-line string", "with `cwd`, `enabled_tools` or `disabled_tools` is not migrated"],
}.items():
    text = (setup_refs / ref).read_text(encoding="utf-8")
    if not all(t in text for t in tokens):
        raise SystemExit(f"mcporter-setup reference {ref} is missing its contract")
for example in ["README.md", "inventory-gold-stock.mjs", "inventory-item.sh"]:
    if not (mcp_plugin / "skills" / "mcporter" / "examples" / ".mcporter" / "scripts" / example).is_file():
        raise SystemExit(f"missing mcporter example script {example}")
bench = (mcp_plugin / "benchmark" / "README.md").read_text(encoding="utf-8")
if not all(t in bench for t in ["Input tokens", "Time", "results-20-pages.json", "results-4-pages.json"]):
    raise SystemExit("mcporter benchmark README must report tokens and time with raw data")

subprocess.run([node, str(root / "scripts" / "test-mcporter-plugin.js")], check=True, timeout=300, stdout=subprocess.DEVNULL)
