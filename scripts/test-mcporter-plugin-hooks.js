// Behavior test for the mcporter-plugin hooks. Run through test-mcporter-plugin.js.
const { assert, execFileSync, fs, path, plugin, tmp, env, run, proj } = require("./mcporter-plugin-test-fixture");

// Session hint lists servers from `mcporter config list --json` and caches them.
const hint = run("hooks/session-hint.js", []);
assert.match(hint, /MCP servers via mcporter.*inv/);
const { serverCache, discoveryCache } = require(path.join(plugin, "scripts", "mcporter-common.js"));
assert.ok(fs.existsSync(path.join(tmp, "data with 'space", path.basename(serverCache(proj)))));
// The cache is per project: another directory gets its own list, not proj's.
const other = path.join(tmp, "other");
fs.mkdirSync(other);
fs.writeFileSync(path.join(tmp, "data with 'space", path.basename(discoveryCache(proj))), JSON.stringify([{ name: "only-in-proj" }]));
const otherHint = execFileSync(process.execPath, [path.join(plugin, "hooks", "session-hint.js")], { env, encoding: "utf8", cwd: other });
assert.doesNotMatch(otherHint, /only-in-proj/);
assert.match(run("hooks/session-hint.js", []), /only-in-proj/);

// Redirect hook: warn for mcporter servers, silent for session-only servers.
const { decide } = require(path.join(plugin, "hooks", "redirect-mcp.js"));
// The command hooks.json actually runs must produce output.
const hookCmd = JSON.parse(fs.readFileSync(path.join(plugin, "hooks", "hooks.json"), "utf8")).hooks.PreToolUse[0].hooks[0].command;
const viaHook = execFileSync("sh", ["-c", hookCmd], {
  env: { ...env, CLAUDE_PLUGIN_ROOT: plugin },
  encoding: "utf8",
  cwd: other,
  // Claude Code passes the session cwd; the hook reads that project's cache.
  input: JSON.stringify({ tool_name: "mcp__inv__get_item", tool_input: { id: "a" }, cwd: other }),
});
assert.match(JSON.parse(viaHook).hookSpecificOutput.additionalContext, /mcporter call 'inv\.get_item' 'id:a'/);
const startCmd = JSON.parse(fs.readFileSync(path.join(plugin, "hooks", "hooks.json"), "utf8")).hooks.SessionStart[0].hooks[0].command;
assert.match(execFileSync("sh", ["-c", startCmd], { env: { ...env, CLAUDE_PLUGIN_ROOT: plugin }, encoding: "utf8" }), /MCP servers via mcporter/);
// Suggested commands are shell-safe.
const quoted = decide({ tool_name: "mcp__inv__x", tool_input: { id: "it's $(id) $HOME" } }, ["inv"]).hookSpecificOutput.additionalContext;
const argv = execFileSync("sh", ["-c", `printf '%s\\n' ${quoted.match(/'inv\.x' (.*) --output/)[1]}`], { encoding: "utf8" });
assert.equal(argv, "id:it's $(id) $HOME\n");
const warn = decide({ tool_name: "mcp__inv__list_items", tool_input: { page: 2 } }, ["inv"]);
assert.equal(warn.hookSpecificOutput.permissionDecision, undefined);
assert.match(warn.hookSpecificOutput.additionalContext, /mcporter call 'inv\.list_items' 'page:2'/);
assert.equal(decide({ tool_name: "mcp__t3-code__task_status", tool_input: {} }, ["inv"]), null);
assert.equal(decide({ tool_name: "Bash", tool_input: {} }, ["inv"]), null);
assert.equal(decide({ tool_name: "mcp__my_srv__x", tool_input: {} }, ["my.srv"]).hookSpecificOutput.additionalContext.includes('"my.srv"'), true);
assert.equal(decide({ tool_name: "mcp__inv__x", tool_input: {} }, ["inv"], "block").hookSpecificOutput.permissionDecision, "deny");
// A server name with "__" is matched whole, longest known prefix first.
assert.match(decide({ tool_name: "mcp__my__server__get", tool_input: {} }, ["my", "my__server"]).hookSpecificOutput.additionalContext, /'my__server\.get'/);
assert.equal(decide({ tool_name: "mcp__my__server__get", tool_input: {} }, ["my__server"], "block").hookSpecificOutput.permissionDecision, "deny");
// Only "my" known: the call may belong to an unknown "my__server", so no redirect.
assert.equal(decide({ tool_name: "mcp__my__server__get", tool_input: {} }, ["my"], "block"), null);
assert.equal(decide({ tool_name: "mcp__inv__", tool_input: {} }, ["inv"]), null);
// Two names with the same tool key ("my.srv", "my_srv"): no guess, in either mode.
assert.equal(decide({ tool_name: "mcp__my_srv__x", tool_input: {} }, ["my.srv", "my_srv"]), null);
assert.equal(decide({ tool_name: "mcp__my_srv__x", tool_input: {} }, ["my.srv", "my_srv"], "block"), null);
// Startup discovery: a slow or failing mcporter reuses the stale cache and re-dates it.
const cacheFile = path.join(tmp, "data with 'space", path.basename(discoveryCache(proj)));
fs.writeFileSync(cacheFile, JSON.stringify([{ name: "stale-srv" }]));
fs.utimesSync(cacheFile, 0, 0);
const failEnv = { ...env, MCPORTER_BIN: path.join(tmp, "missing-mcporter.js") };
assert.match(execFileSync(process.execPath, [path.join(plugin, "hooks", "session-hint.js")], { env: failEnv, encoding: "utf8", cwd: proj }), /stale-srv/);
assert.ok(Date.now() - fs.statSync(cacheFile).mtimeMs < 60_000);
fs.rmSync(cacheFile);
// A conflicting name (another backend natively) gets no hint and no redirect.
fs.writeFileSync(path.join(tmp, "data with 'space", "conflicts.json"), JSON.stringify(["inv"]));
assert.equal(run("hooks/redirect-mcp.js", [], JSON.stringify({ tool_name: "mcp__inv__get_item", tool_input: {}, cwd: other })), "");
assert.doesNotMatch(execFileSync(process.execPath, [path.join(plugin, "hooks", "session-hint.js")], { env, encoding: "utf8", cwd: other }), /\binv\b/);
// A conflict on "my_srv" also covers "my.srv": both look like mcp__my_srv__.
const cacheNow = path.join(tmp, "data with 'space", path.basename(serverCache(other)));
const savedCache = fs.readFileSync(cacheNow);
fs.writeFileSync(cacheNow, JSON.stringify(["my.srv", "my_srv"]));
fs.writeFileSync(path.join(tmp, "data with 'space", "conflicts.json"), JSON.stringify(["my_srv"]));
assert.equal(execFileSync(process.execPath, [path.join(plugin, "hooks", "redirect-mcp.js")], { env: { ...env, MCPORTER_HOOK_MODE: "block" }, encoding: "utf8", input: JSON.stringify({ tool_name: "mcp__my_srv__delete_item", tool_input: {}, cwd: other }) }), "");
fs.writeFileSync(cacheNow, savedCache);
fs.rmSync(path.join(tmp, "data with 'space", "conflicts.json"));
// Opening project B (no setup there): a server bound to project A's folder,
// or a name B still loads from its own .mcp.json, is not offered as a redirect.
{
  const b = path.join(tmp, "proj-b");
  fs.mkdirSync(b, { recursive: true });
  const homeCfg = path.join(tmp, "home", ".config", "mcporter", "mcporter.json");
  const saved = fs.existsSync(homeCfg) ? fs.readFileSync(homeCfg) : null;
  fs.mkdirSync(path.dirname(homeCfg), { recursive: true });
  fs.writeFileSync(homeCfg, JSON.stringify({ mcpServers: { pbound: { command: "x", cwd: path.join(tmp, "proj-a") }, both: { command: "y" }, free: { command: "z" } } }));
  fs.writeFileSync(homeCfg, JSON.stringify({ mcpServers: { ...JSON.parse(fs.readFileSync(homeCfg, "utf8")).mcpServers, "my.srv": { command: "m" } } }));
  // B loads "both" and "my_srv" natively; "my.srv" has the same tool key.
  fs.writeFileSync(path.join(b, ".mcp.json"), JSON.stringify({ mcpServers: { both: { command: "y" }, my_srv: { command: "n" } } }));
  const hintB = execFileSync(process.execPath, [path.join(plugin, "hooks", "session-hint.js")], { env, encoding: "utf8", cwd: b });
  assert.match(hintB, /\bfree\b/);
  assert.doesNotMatch(hintB, /pbound|\bboth\b|my\.srv/);
  assert.equal(execFileSync(process.execPath, [path.join(plugin, "hooks", "redirect-mcp.js")], { env: { ...env, MCPORTER_HOOK_MODE: "block" }, encoding: "utf8", input: JSON.stringify({ tool_name: "mcp__my_srv__delete_item", tool_input: {}, cwd: b }) }), "");
  assert.equal(execFileSync(process.execPath, [path.join(plugin, "hooks", "redirect-mcp.js")], { env: { ...env, MCPORTER_HOOK_MODE: "block" }, encoding: "utf8", input: JSON.stringify({ tool_name: "mcp__pbound__delete_item", tool_input: {}, cwd: b }) }), "");
  // Once setup switched B's copy off, the name is a replacement again.
  fs.mkdirSync(path.join(b, ".claude"));
  fs.writeFileSync(path.join(b, ".claude", "settings.local.json"), JSON.stringify({ disabledMcpjsonServers: ["both"] }));
  fs.rmSync(path.join(tmp, "data with 'space", path.basename(serverCache(b))));
  assert.match(execFileSync(process.execPath, [path.join(plugin, "hooks", "session-hint.js")], { env, encoding: "utf8", cwd: b }), /\bboth\b/);
  if (saved) fs.writeFileSync(homeCfg, saved);
  else fs.rmSync(homeCfg);
}
const piped = run("hooks/redirect-mcp.js", [], JSON.stringify({ tool_name: "mcp__inv__get_item", tool_input: { id: "a" }, cwd: other }));
assert.match(JSON.parse(piped).hookSpecificOutput.additionalContext, /'id:a'/);

fs.rmSync(tmp, { recursive: true, force: true });
console.log("mcporter-plugin tests passed");

// One data dir for setup and the hooks: a PLUGIN_DATA or CLAUDE_PLUGIN_DATA
// inherited from another plugin's session is never used.
assert.ok(!fs.existsSync(path.join(tmp, "foreign-data")));
{
  const common = path.join(plugin, "scripts", "mcporter-common.js");
  const probe = (extra) => execFileSync(process.execPath, ["-e", `console.log(require(${JSON.stringify(common)}).dataRoot())`], { env: { ...env, MCPORTER_PLUGIN_DATA: "", ...extra }, encoding: "utf8" }).trim();
  assert.equal(probe({}), path.join(env.HOME, ".mcporter", "plugin"));
  assert.equal(probe({ MCPORTER_PLUGIN_DATA: path.join(tmp, "own") }), path.join(tmp, "own"));
}
