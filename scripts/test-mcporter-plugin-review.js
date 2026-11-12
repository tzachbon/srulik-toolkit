// Review-round cases: the session hint's native filters, Codex keys mcporter
// drops, Windows containment, and the benchmark trace. Run through test-mcporter-plugin.js.
const { assert, execFileSync, fs, path, plugin, tmp, home, env, run, proj, projectCodex, projectBefore } = require("./mcporter-plugin-test-fixture");

const data = path.join(tmp, "data with 'space");
const homeCfg = path.join(home, ".config", "mcporter", "mcporter.json");
const claudeJsonFile = path.join(home, ".claude.json");
const saved = { cfg: fs.existsSync(homeCfg) ? fs.readFileSync(homeCfg) : null, cj: fs.readFileSync(claudeJsonFile) };
fs.mkdirSync(path.dirname(homeCfg), { recursive: true });
const c = path.join(tmp, "proj-c");
fs.mkdirSync(c, { recursive: true });
const hint = () => execFileSync(process.execPath, [path.join(plugin, "hooks", "session-hint.js")], { env, encoding: "utf8", cwd: c });
const blocked = (tool) => execFileSync(process.execPath, [path.join(plugin, "hooks", "redirect-mcp.js")], { env: { ...env, MCPORTER_HOOK_MODE: "block" }, encoding: "utf8", input: JSON.stringify({ tool_name: tool, tool_input: {}, cwd: c }) });
fs.rmSync(path.join(data, "conflicts.json"), { force: true });

// A native copy added after the cache was written still wins within the TTL.
fs.writeFileSync(homeCfg, JSON.stringify({ mcpServers: { late: { command: "l" }, keep: { command: "k" } } }));
assert.match(hint(), /\blate\b/);
fs.writeFileSync(path.join(c, ".mcp.json"), JSON.stringify({ mcpServers: { late: { command: "other" } } }));
assert.doesNotMatch(hint(), /\blate\b/);
assert.equal(blocked("mcp__late__x"), "");
assert.match(hint(), /\bkeep\b/);
fs.rmSync(path.join(c, ".mcp.json"));

// A Claude Code local-scope server for this project (its ~/.claude.json block) is native too.
fs.writeFileSync(claudeJsonFile, JSON.stringify({ projects: { [c]: { mcpServers: { keep: { command: "mine" } } } } }));
assert.doesNotMatch(hint(), /\bkeep\b/);
assert.equal(blocked("mcp__keep__x"), "");
// ...unless it is switched off there.
fs.writeFileSync(claudeJsonFile, JSON.stringify({ projects: { [c]: { mcpServers: { keep: { command: "mine" } }, disabledMcpServers: ["keep"] } } }));
assert.match(hint(), /\bkeep\b/);
fs.writeFileSync(claudeJsonFile, saved.cj);

// A server bound to another project also hides every name sharing its tool key.
fs.writeFileSync(homeCfg, JSON.stringify({ mcpServers: { "my.srv": { command: "m", cwd: path.join(tmp, "proj-a") }, my_srv: { command: "n" }, keep: { command: "k" } } }));
fs.rmSync(path.join(data, path.basename(require(path.join(plugin, "scripts", "mcporter-common.js")).serverCache(c))), { force: true });
const bound = hint();
assert.match(bound, /\bkeep\b/);
assert.doesNotMatch(bound, /my[._]srv/);
assert.equal(blocked("mcp__my_srv__delete_item"), "");

// A project's enabled .codex/config.toml server is native too, by tool key.
fs.writeFileSync(homeCfg, JSON.stringify({ mcpServers: { "cx.srv": { command: "home" }, off: { command: "o" }, keep: { command: "k" } } }));
fs.mkdirSync(path.join(c, ".codex"), { recursive: true });
fs.writeFileSync(path.join(c, ".codex", "config.toml"), '[mcp_servers.cx_srv]\ncommand = "mine"\n\n[mcp_servers."off"]\ncommand = "o"\nenabled = false\n');
fs.rmSync(path.join(data, path.basename(require(path.join(plugin, "scripts", "mcporter-common.js")).discoveryCache(c))), { force: true });
const cx = hint();
assert.doesNotMatch(cx, /cx\.srv/);
assert.match(cx, /\boff\b/);
assert.match(cx, /\bkeep\b/);
assert.equal(blocked("mcp__cx_srv__delete_item"), "");
fs.rmSync(path.join(c, ".codex"), { recursive: true });

// User-scope native copies count too: ~/.claude.json's top-level servers not
// denied in ~/.claude/settings.json, and enabled $CODEX_HOME servers.
{
  const settingsFile = path.join(home, ".claude", "settings.json");
  const codexUser = path.join(home, ".codex", "config.toml");
  const before = { s: fs.existsSync(settingsFile) ? fs.readFileSync(settingsFile) : null, x: fs.readFileSync(codexUser) };
  fs.writeFileSync(homeCfg, JSON.stringify({ mcpServers: { "us.er": { command: "home" }, cxu: { command: "home" }, keep: { command: "k" } } }));
  fs.writeFileSync(claudeJsonFile, JSON.stringify({ mcpServers: { us_er: { command: "mine" } } }));
  fs.appendFileSync(codexUser, '\n[mcp_servers.cxu]\ncommand = "mine"\n');
  fs.rmSync(path.join(data, path.basename(require(path.join(plugin, "scripts", "mcporter-common.js")).discoveryCache(c))), { force: true });
  const u = hint();
  assert.doesNotMatch(u, /us\.er|\bcxu\b/);
  assert.match(u, /\bkeep\b/);
  assert.equal(blocked("mcp__us_er__delete_item"), "");
  // Denied (as setup does) and switched off: offered again.
  fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
  fs.writeFileSync(settingsFile, JSON.stringify({ deniedMcpServers: [{ serverName: "us_er" }] }));
  fs.appendFileSync(codexUser, "enabled = false\n");
  assert.match(hint(), /us\.er.*\bcxu\b|\bcxu\b.*us\.er/);
  if (before.s) fs.writeFileSync(settingsFile, before.s);
  else fs.rmSync(settingsFile);
  fs.writeFileSync(codexUser, before.x);
  fs.writeFileSync(claudeJsonFile, saved.cj);
}

if (saved.cfg) fs.writeFileSync(homeCfg, saved.cfg);
else fs.rmSync(homeCfg);

// Codex keys mcporter 0.17 does not import (cwd, enabled_tools, disabled_tools):
// the server is not migrated and the hooks leave it native.
for (const key of ["enabled_tools", "disabled_tools"]) {
  fs.writeFileSync(projectCodex, `[mcp_servers.projonly]\ncommand = "p"\n${key} = ["read"]\n`);
  fs.rmSync(path.join(data, "conflicts.json"), { force: true });
  const r = JSON.parse(run("scripts/setup.js", ["apply", "--servers", "projonly"]));
  assert.match(r.failed[0]?.reason ?? "", new RegExp(key));
  assert.deepEqual(r.disabled.codex, []);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(data, "conflicts.json"), "utf8")), ["projonly"]);
  execFileSync("sh", ["-c", r.undo], { env, cwd: proj });
}
fs.writeFileSync(projectCodex, projectBefore);
fs.rmSync(path.join(data, "conflicts.json"), { force: true });

// Windows: a file on another drive is not under the Claude config dir.
const { under } = require(path.join(plugin, "scripts", "setup.js"));
assert.equal(under("C:\\Users\\me\\.claude", "D:\\proj\\.mcp.json", path.win32), false);
assert.equal(under("C:\\Users\\me\\.claude", "C:\\Users\\me\\.claude\\mcp.json", path.win32), true);
assert.equal(under("/a", "/a", path.posix), true);
assert.equal(under("/a", "/b/x", path.posix), false);

// Benchmark trace: any shell whitespace between command words counts.
const { followed } = require(path.join(plugin, "benchmark", "followed.js"));
assert.equal(followed("mcporter", ["Bash: mcporter  call inventory.list_items page:1"]), true);
assert.equal(followed("mcporter", ["Bash: mcporter\tcall\tinventory.list_items"]), true);
assert.equal(followed("mcporter", ["Bash: echo mcporter call inventory.list_items"]), false);
assert.equal(followed("mcporter", ["Bash: set -e\nmcporter call inventory.list_items page:1"]), true);
assert.equal(followed("saved-script", ["Bash: set -e\nnode .mcporter/scripts/inventory-gold-stock.mjs"]), true);
