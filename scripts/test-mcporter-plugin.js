// Behavior test for plugins/mcporter-plugin setup against a fake mcporter and a temp HOME.
// The hook tests (test-mcporter-plugin-hooks.js) run last, on the state left here.
const { assert, execFileSync, fs, path, plugin, tmp, home, env, run, proj, codexHome, projectCodex, imports, codexBefore, projectBefore } = require("./mcporter-plugin-test-fixture");

require("./test-mcporter-plugin-toml");
fs.writeFileSync(path.join(home, ".codex", "config.toml"), codexBefore);

// Setup with no Claude settings file: undo removes the files it created.
const first = JSON.parse(run("scripts/setup.js", ["apply", "--servers", "inv,linear"]));
run("scripts/setup.js", ["undo", first.receipt]);
assert.ok(!fs.existsSync(path.join(home, ".claude", "settings.json")));
assert.ok(!fs.existsSync(path.join(home, ".config", "mcporter", "mcporter.json")));
assert.equal(fs.readFileSync(path.join(home, ".codex", "config.toml"), "utf8"), codexBefore);
// Without an installed mcporter, apply refuses before anything is read or written.
const { MCPORTER_BIN: _bin, ...noBin } = env;
assert.throws(
  () => execFileSync(process.execPath, [path.join(plugin, "scripts", "setup.js"), "apply", "--servers", "inv"], { env: { ...noBin, PATH: path.dirname(process.execPath) }, stdio: "pipe", cwd: proj }),
  (err) => err.status === 1 && /mcporter is not installed/.test(err.stderr),
);
// MCPORTER_BIN alone is not enough: daily calls use the bare `mcporter`.
assert.throws(
  () => execFileSync(process.execPath, [path.join(plugin, "scripts", "setup.js"), "apply", "--servers", "inv"], { env: { ...env, PATH: path.dirname(process.execPath) }, stdio: "pipe", cwd: proj }),
  (err) => err.status === 1 && /mcporter is not installed/.test(err.stderr),
);
assert.ok(!fs.existsSync(path.join(home, ".config", "mcporter", "mcporter.json")));
// Malformed Claude settings: apply fails before writing anything.
fs.writeFileSync(path.join(home, ".claude", "settings.json"), "{ not json");
assert.throws(
  () => execFileSync(process.execPath, [path.join(plugin, "scripts", "setup.js"), "apply", "--servers", "inv"], { env, stdio: "pipe" }),
  (err) => err.status === 1 && /settings\.json is not valid JSON/.test(err.stderr),
);
assert.ok(!fs.existsSync(path.join(home, ".config", "mcporter", "mcporter.json")));
fs.writeFileSync(path.join(home, ".claude", "settings.json"), JSON.stringify({ model: "keep" }), { mode: 0o600 });
fs.chmodSync(path.join(home, ".claude", "settings.json"), 0o600);

// Inventory lists every importable server.
// The project .mcp.json is read too, and no definition (which may hold secrets) is printed.
const inv = JSON.parse(run("scripts/setup.js", ["inventory"])).importable;
assert.deepEqual(inv.map((s) => s.name), ["cur", "inv", "linear", "cc", "oauth", "cc", "bound", "projmcp", "desk", "projonly", "twice", "split", "linear", "broken", "twice", "split", "bound"]);
assert.ok(inv.every((s) => !("entry" in s)));

// Dry run writes nothing.
fs.rmSync(path.join(home, ".config"), { recursive: true, force: true });
run("scripts/setup.js", ["apply", "--servers", "inv,linear", "--dry-run"]);
assert.equal(fs.readFileSync(path.join(home, ".codex", "config.toml"), "utf8"), codexBefore);
assert.ok(!fs.existsSync(path.join(home, ".config", "mcporter")));

// Apply: migrate, verify, disable only what answered, keep entries.
const receipt = JSON.parse(run("scripts/setup.js", ["apply", "--servers", "inv,linear,broken,cur,desk,projonly,twice,missing"]));
assert.deepEqual(receipt.migrated.map((m) => m.name), ["inv", "linear", "cur", "desk", "projonly", "twice"]);
assert.deepEqual(receipt.failed.map((m) => m.name), ["broken", "missing"]);
// "linear" exists in Codex and Claude Code: both native copies are disabled.
assert.deepEqual(receipt.disabled, { claude: ["inv", "linear"], codex: [`linear (${codexHome})`, `projonly (${projectCodex})`, `twice (${projectCodex})`] });
// "twice" is defined in the project and the home Codex config: the copy is bound
// to this project, so only the project one is disabled and the home one is a conflict.
assert.ok(receipt.conflicts.some((c) => c.startsWith(`twice (codex: ${codexHome})`)));
assert.equal(fs.readFileSync(projectCodex, "utf8"), '[mcp_servers.projonly]\nenabled = false\ncommand = "p"\n\n[mcp_servers.twice]\nenabled = false\ncommand = "t"\n');
assert.match(fs.readFileSync(codexHome, "utf8"), /\[mcp_servers\.twice\]\ncommand = "t"/);
// A server that did not answer is removed from mcporter again.
const mcpCfg = JSON.parse(fs.readFileSync(path.join(home, ".config", "mcporter", "mcporter.json"), "utf8"));
assert.deepEqual(Object.keys(mcpCfg.mcpServers).sort(), ["cur", "desk", "inv", "linear", "projonly", "twice"]);
// The copied definition is the one from the first source file.
assert.deepEqual(mcpCfg.mcpServers.linear, { command: "run-linear" });
assert.deepEqual(receipt.manual.map((m) => m.split(" ")[0]), ["cur", "desk"]);
if (process.platform !== "win32") assert.equal(fs.statSync(path.join(home, ".claude", "settings.json")).mode & 0o777, 0o600);
const settings = JSON.parse(fs.readFileSync(path.join(home, ".claude", "settings.json"), "utf8"));
assert.deepEqual(settings, { model: "keep", deniedMcpServers: [{ serverName: "inv" }, { serverName: "linear" }] });
const codexAfter = fs.readFileSync(path.join(home, ".codex", "config.toml"), "utf8");
assert.match(codexAfter, /\[mcp_servers\.linear\]\nenabled = false\ncommand = "npx"/);
assert.doesNotMatch(codexAfter, /\[mcp_servers\.broken\]\nenabled/);
assert.ok(fs.existsSync(receipt.receipt));

// An OAuth server that needs a login stays in mcporter, and its native copy stays enabled.
const auth = JSON.parse(run("scripts/setup.js", ["apply", "--servers", "oauth"]));
assert.deepEqual(auth.authRequired.map((a) => a.name), ["oauth"]);
assert.equal(auth.authRequired[0].next, "mcporter auth 'oauth', then rerun apply --servers 'oauth'");
assert.deepEqual(auth.disabled.claude, []);
assert.ok("oauth" in JSON.parse(fs.readFileSync(path.join(home, ".config", "mcporter", "mcporter.json"), "utf8")).mcpServers);
run("scripts/setup.js", ["undo", auth.receipt]);
// An existing world-readable mcporter config never holds secrets at that mode:
// the write itself is owner-only (a chmod after the rename would leave a window).
if (process.platform !== "win32") {
  const cfg = path.join(home, ".config", "mcporter", "mcporter.json");
  const saved = fs.readFileSync(cfg);
  const savedMode = fs.statSync(cfg).mode & 0o777;
  fs.writeFileSync(cfg, '{"mcpServers":{}}');
  fs.chmodSync(cfg, 0o644);
  const realChmod = fs.chmodSync;
  const modes = [];
  const common = require(path.join(plugin, "scripts", "mcporter-common.js"));
  fs.chmodSync = (f, m) => (modes.push(m), realChmod(f, m));
  common.writeJson(cfg, { mcpServers: { s: { env: { TOKEN: "x" } } } }, 0o600);
  fs.chmodSync = realChmod;
  assert.deepEqual(modes, [0o600]);
  assert.equal(fs.statSync(cfg).mode & 0o777, 0o600);
  fs.writeFileSync(cfg, saved);
  fs.chmodSync(cfg, savedMode);
}

// Re-migrating a server already in mcporter that then fails keeps the old definition.
const cfgPath = path.join(home, ".config", "mcporter", "mcporter.json");
const custom = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
custom.mcpServers.broken = { command: "mine", env: { KEY: "keep" } };
fs.writeFileSync(cfgPath, JSON.stringify(custom));
run("scripts/setup.js", ["apply", "--servers", "broken"]);
assert.deepEqual(JSON.parse(fs.readFileSync(cfgPath, "utf8")).mcpServers.broken, { command: "mine", env: { KEY: "keep" } });

// Re-applying does not duplicate the denylist entry.
run("scripts/setup.js", ["apply", "--servers", "inv"]);
assert.equal(JSON.parse(fs.readFileSync(path.join(home, ".claude", "settings.json"), "utf8")).deniedMcpServers.length, 2);

// Undo restores the original files, through the receipt's own command, and
// drops the cached server lists so hints stop naming moved servers.
const staleCache = path.join(tmp, "data with 'space", "servers-stale.json");
fs.writeFileSync(staleCache, "[]");
// Files changed by later applies: undo refuses and changes nothing, unless forced.
assert.throws(() => execFileSync("sh", ["-c", receipt.undo], { env, cwd: proj, stdio: "pipe" }), (err) => /changed since this apply/.test(err.stderr));
assert.ok(fs.existsSync(staleCache));
execFileSync("sh", ["-c", `${receipt.undo} --force`], { env, cwd: proj });
assert.ok(!fs.existsSync(staleCache));
assert.equal(fs.readFileSync(projectCodex, "utf8"), projectBefore);
assert.equal(fs.readFileSync(path.join(home, ".codex", "config.toml"), "utf8"), codexBefore);
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(home, ".claude", "settings.json"), "utf8")), { model: "keep" });

// Without XDG_CONFIG_HOME, mcporter's home config is ~/.mcporter/mcporter.json:
// apply writes there, removes failures there, and undo deletes it.
const noXdg = { ...env, XDG_CONFIG_HOME: "" };
const legacy = JSON.parse(execFileSync(process.execPath, [path.join(plugin, "scripts", "setup.js"), "apply", "--servers", "inv,broken"], { env: noXdg, encoding: "utf8", cwd: proj }));
const legacyCfg = path.join(home, ".mcporter", "mcporter.json");
assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(legacyCfg, "utf8")).mcpServers), ["inv"]);
execFileSync(process.execPath, [path.join(plugin, "scripts", "setup.js"), "undo", legacy.receipt], { env: noXdg, cwd: proj });
assert.ok(!fs.existsSync(legacyCfg));

// An existing ~/.mcporter/mcporter.jsonc is the home config: setup adds to it,
// rather than creating a mcporter.json that would hide it.
fs.mkdirSync(path.join(home, ".mcporter"), { recursive: true });
const jsonc = path.join(home, ".mcporter", "mcporter.jsonc");
fs.writeFileSync(jsonc, JSON.stringify({ mcpServers: { existing: { command: "e" } } }));
execFileSync(process.execPath, [path.join(plugin, "scripts", "setup.js"), "apply", "--servers", "inv"], { env: noXdg, cwd: proj });
assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(jsonc, "utf8")).mcpServers), ["existing", "inv"]);
assert.ok(!fs.existsSync(legacyCfg));
// A .jsonc home config with comments is refused before anything is written.
const commented = '{ // mine\n "mcpServers": {} }';
fs.writeFileSync(jsonc, commented);
assert.throws(
  () => execFileSync(process.execPath, [path.join(plugin, "scripts", "setup.js"), "apply", "--servers", "inv"], { env: noXdg, stdio: "pipe", cwd: proj }),
  (err) => err.status === 1 && /mcporter\.jsonc is not valid JSON \(comments/.test(err.stderr),
);
assert.equal(fs.readFileSync(jsonc, "utf8"), commented);
fs.rmSync(path.join(home, ".mcporter"), { recursive: true });

// A server defined only under a custom CODEX_HOME, and one in the project .mcp.json, migrate.
const customCodex = path.join(tmp, "codex-home", "config.toml");
fs.mkdirSync(path.dirname(customCodex), { recursive: true });
fs.writeFileSync(customCodex, '[mcp_servers.custom]\ncommand = "c"\n');
const customEnv = { ...env, CODEX_HOME: path.dirname(customCodex), IMPORTS: JSON.stringify([...imports, { name: "custom", kind: "codex", path: customCodex }]) };
const custom2 = JSON.parse(execFileSync(process.execPath, [path.join(plugin, "scripts", "setup.js"), "apply", "--servers", "custom,projmcp"], { env: customEnv, encoding: "utf8", cwd: proj }));
assert.deepEqual(custom2.migrated.map((m) => m.name), ["custom", "projmcp"]);
assert.deepEqual(JSON.parse(fs.readFileSync(cfgPath, "utf8")).mcpServers.custom, { command: "run-custom" }); // user scope: no fixed cwd
assert.equal(fs.readFileSync(customCodex, "utf8"), '[mcp_servers.custom]\nenabled = false\ncommand = "c"\n');
assert.deepEqual(custom2.disabled.claude, ["projmcp"]);
// A .mcp.json server is switched off for this project only, not on the user denylist.
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(proj, ".claude", "settings.local.json"), "utf8")).disabledMcpjsonServers, ["projmcp"]);
assert.ok(!JSON.stringify(JSON.parse(fs.readFileSync(path.join(home, ".claude", "settings.json"), "utf8")).deniedMcpServers ?? []).includes("projmcp"));
// Backups are owner-only under the plugin data dir, none inside the project.
assert.ok(custom2.backups.every((b) => !b.backup || b.backup.startsWith(path.join(tmp, "data with 'space", "backups"))));
assert.ok(!fs.readdirSync(path.join(proj, ".codex")).some((f) => f.includes("backup")));
// A project-file stdio server keeps the project as its working directory.
assert.equal(JSON.parse(fs.readFileSync(cfgPath, "utf8")).mcpServers.projmcp.cwd, proj);
execFileSync("sh", ["-c", custom2.undo], { env: customEnv, cwd: proj });

// Same name, different definitions: the first (project) one is copied and
// disabled; the home one is another backend, so it stays enabled and is reported.
fs.appendFileSync(projectCodex, '\n[mcp_servers.split]\ncommand = "p"\n');
fs.appendFileSync(codexHome, '\n[mcp_servers.split]\ncommand = "h"\n');
const homeSplit = fs.readFileSync(codexHome, "utf8");
const split = JSON.parse(run("scripts/setup.js", ["apply", "--servers", "split"]));
assert.deepEqual(JSON.parse(fs.readFileSync(cfgPath, "utf8")).mcpServers.split, { command: "run-split", args: [projectCodex], cwd: proj });
assert.deepEqual(split.disabled.codex, [`split (${projectCodex})`]);
assert.equal(fs.readFileSync(codexHome, "utf8"), homeSplit);
assert.equal(split.conflicts.length, 1);
// The hooks leave a conflicting name to the native tools.
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(tmp, "data with 'space", "conflicts.json"), "utf8")), ["split"]);
assert.match(split.conflicts[0], new RegExp(`^split \\(codex: ${codexHome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`));
execFileSync("sh", ["-c", split.undo], { env, cwd: proj });
// Two Claude Code definitions of one name: the name-wide denylist would block
// both, so neither is denied and the copy is left for the user.
const cc = JSON.parse(run("scripts/setup.js", ["apply", "--servers", "cc"]));
assert.deepEqual(cc.disabled.claude, []);
assert.equal(cc.conflicts.length, 1);
assert.deepEqual(cc.manual.map((m) => m.split(" ")[0]), ["cc"]);
execFileSync("sh", ["-c", cc.undo], { env, cwd: proj });
fs.writeFileSync(projectCodex, projectBefore);
fs.writeFileSync(codexHome, codexBefore);

require("./test-mcporter-plugin-scopes");

// A Codex server with `cwd` is not migrated: mcporter's import drops it.
fs.writeFileSync(projectCodex, '[mcp_servers.projonly]\ncommand = "p"\ncwd = "sub"\n');
const conflictsFile = path.join(tmp, "data with 'space", "conflicts.json");
fs.rmSync(conflictsFile, { force: true });
const withCwd = JSON.parse(run("scripts/setup.js", ["apply", "--servers", "projonly"]));
assert.match(withCwd.failed[0]?.reason ?? "", /cwd/);
// The hooks leave it native: mcporter's import would run in the wrong folder.
assert.deepEqual(JSON.parse(fs.readFileSync(conflictsFile, "utf8")), ["projonly"]);
execFileSync("sh", ["-c", withCwd.undo], { env, cwd: proj });
assert.equal(fs.readFileSync(projectCodex, "utf8"), '[mcp_servers.projonly]\ncommand = "p"\ncwd = "sub"\n');
fs.writeFileSync(projectCodex, projectBefore);

// A project config/mcporter.json defining the name shadows the home copy:
// not migrated, native copy left enabled.
fs.mkdirSync(path.join(proj, "config"));
fs.writeFileSync(path.join(proj, "config", "mcporter.json"), JSON.stringify({ mcpServers: { inv: { command: "other" } } }));
fs.rmSync(path.join(tmp, "data with 'space", "conflicts.json"), { force: true });
const shadow = JSON.parse(run("scripts/setup.js", ["apply", "--servers", "inv"]));
assert.match(shadow.failed[0]?.reason ?? "", /shadowed by .*config[\\/]mcporter\.json/);
assert.deepEqual(shadow.disabled.claude, []);
// The hooks then leave the native inv alone.
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(tmp, "data with 'space", "conflicts.json"), "utf8")), ["inv"]);
execFileSync("sh", ["-c", shadow.undo], { env, cwd: proj });
// A server that needs a login is checked for shadowing too.
fs.writeFileSync(path.join(proj, "config", "mcporter.json"), JSON.stringify({ mcpServers: { oauth: { command: "other" } } }));
const shadowAuth = JSON.parse(run("scripts/setup.js", ["apply", "--servers", "oauth"]));
assert.deepEqual(shadowAuth.authRequired, []);
assert.match(shadowAuth.failed[0]?.reason ?? "", /shadowed by/);
execFileSync("sh", ["-c", shadowAuth.undo], { env, cwd: proj });
fs.rmSync(path.join(proj, "config"), { recursive: true });

// A server that ordinary mcporter discovery cannot find (MCPORTER_CONFIG points
// elsewhere) is not migrated.
const elsewhere = JSON.parse(execFileSync(process.execPath, [path.join(plugin, "scripts", "setup.js"), "apply", "--servers", "inv"], { env: { ...env, FAKE_LOCAL_EMPTY: "1" }, encoding: "utf8", cwd: proj }));
assert.match(elsewhere.failed[0]?.reason ?? "", /not found by ordinary mcporter discovery/);
assert.deepEqual(elsewhere.disabled.claude, []);
execFileSync("sh", ["-c", elsewhere.undo], { env, cwd: proj });

// Ordinary discovery failing (a broken project config) also blocks the migration.
const errEnv = { ...env, FAKE_LOCAL_THROW: "1" };
const discoveryErr = JSON.parse(execFileSync(process.execPath, [path.join(plugin, "scripts", "setup.js"), "apply", "--servers", "inv"], { env: errEnv, encoding: "utf8", cwd: proj }));
assert.match(discoveryErr.failed[0]?.reason ?? "", /not found by ordinary/);
execFileSync("sh", ["-c", discoveryErr.undo], { env, cwd: proj });

// A fake header in a multi-line string cannot hide the real table's `cwd`.
fs.writeFileSync(projectCodex, '[agent]\nnote = """\n[mcp_servers.projonly]\n"""\n\n[mcp_servers.projonly]\ncommand = "p"\ncwd = "/x"\n');
assert.match(JSON.parse(run("scripts/setup.js", ["apply", "--servers", "projonly"])).failed[0]?.reason ?? "", /cwd/);
fs.writeFileSync(projectCodex, projectBefore);

// A symlinked settings.json stays a symlink through apply and undo.
const settingsFile = path.join(home, ".claude", "settings.json");
const dotfile = path.join(tmp, "dotfiles-settings.json");
const settingsSaved = fs.readFileSync(settingsFile, "utf8");
fs.writeFileSync(dotfile, JSON.stringify({ model: "keep" }));
fs.rmSync(settingsFile);
fs.symlinkSync(dotfile, settingsFile);
const dotBefore = fs.readFileSync(dotfile, "utf8");
const linked = JSON.parse(run("scripts/setup.js", ["apply", "--servers", "inv"]));
assert.ok(fs.lstatSync(settingsFile).isSymbolicLink());
assert.notEqual(fs.readFileSync(dotfile, "utf8"), dotBefore);
execFileSync("sh", ["-c", linked.undo], { env, cwd: proj });
assert.ok(fs.lstatSync(settingsFile).isSymbolicLink());
assert.equal(fs.readFileSync(dotfile, "utf8"), dotBefore);
fs.rmSync(settingsFile);
fs.writeFileSync(settingsFile, settingsSaved);

// An inline-table Codex server with `cwd` is refused too.
fs.writeFileSync(projectCodex, '[mcp_servers]\nprojonly = { command = "p", cwd = "/x" }\n');
assert.match(JSON.parse(run("scripts/setup.js", ["apply", "--servers", "projonly"])).failed[0]?.reason ?? "", /cwd/);
fs.writeFileSync(projectCodex, projectBefore);

// Identical commands in the project .mcp.json and the home Codex config: the
// copy is bound to this project, so the home copy stays enabled for others.
fs.appendFileSync(codexHome, '\n[mcp_servers.bound]\ncommand = "b"\n');
const homeBound = fs.readFileSync(codexHome, "utf8");
const bound = JSON.parse(run("scripts/setup.js", ["apply", "--servers", "bound"]));
assert.equal(fs.readFileSync(codexHome, "utf8"), homeBound);
assert.equal(bound.conflicts.length, 1);
assert.deepEqual(bound.disabled.claude, ["bound"]);
execFileSync("sh", ["-c", bound.undo], { env, cwd: proj });
fs.writeFileSync(codexHome, codexBefore);

require("./test-mcporter-plugin-auth");
require("./test-mcporter-plugin-hooks");
