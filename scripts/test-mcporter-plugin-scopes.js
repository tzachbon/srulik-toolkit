// Claude Code ~/.claude.json scopes (user, local, several projects) and a run from $HOME.
// Run through test-mcporter-plugin.js, on the state left there.
const { assert, execFileSync, fs, path, plugin, tmp, home, env, run, proj, codexHome, codexBefore } = require("./mcporter-plugin-test-fixture");

// ~/.claude.json with different user and project definitions of one name:
// mcporter shows only one, but the name-wide denylist would block both.
fs.writeFileSync(path.join(home, ".claude.json"), JSON.stringify({ mcpServers: { inv: { command: "u" } }, projects: { [proj]: { mcpServers: { inv: { command: "p" } } } } }));
const scoped = JSON.parse(run("scripts/setup.js", ["apply", "--servers", "inv"]));
assert.deepEqual(scoped.disabled.claude, []);
assert.match(scoped.conflicts.join(), /inv \(claude-code: .*more than one scope/);
execFileSync("sh", ["-c", scoped.undo], { env, cwd: proj });
// Identical local-scope copies in two projects: each runs in its own folder,
// so the name-wide denylist would break the other project.
fs.writeFileSync(path.join(home, ".claude.json"), JSON.stringify({ projects: { [proj]: { mcpServers: { inv: { command: "p" } } }, [path.join(tmp, "b")]: { mcpServers: { inv: { command: "p" } } } } }));
const twoProj = JSON.parse(run("scripts/setup.js", ["apply", "--servers", "inv"]));
assert.deepEqual(twoProj.disabled.claude, []);
assert.match(twoProj.conflicts.join(), /inv \(claude-code: .*more than one scope/);
execFileSync("sh", ["-c", twoProj.undo], { env, cwd: proj });
// A local-scope server (only under this project's block) keeps the project as cwd.
fs.writeFileSync(path.join(home, ".claude.json"), JSON.stringify({ projects: { [proj]: { mcpServers: { inv: { command: "p" } } } } }));
const local = JSON.parse(run("scripts/setup.js", ["apply", "--servers", "inv"]));
// A local-scope server is switched off in this project's block only.
const cj = JSON.parse(fs.readFileSync(path.join(home, ".claude.json"), "utf8"));
assert.deepEqual(cj.projects[proj].disabledMcpServers, ["inv"]);
assert.deepEqual(local.disabled.claude, ["inv"]);
assert.equal(JSON.parse(fs.readFileSync(path.join(home, ".config", "mcporter", "mcporter.json"), "utf8")).mcpServers.inv.cwd, proj);
execFileSync("sh", ["-c", local.undo], { env, cwd: proj });
fs.writeFileSync(path.join(home, ".claude.json"), "{}");
// Run from $HOME: the user-level Codex copy is not pinned to $HOME, so it
// matches the identical copy and is disabled too.
fs.appendFileSync(codexHome, '\n[mcp_servers.bound]\ncommand = "b"\n');
const fromHome = JSON.parse(execFileSync(process.execPath, [path.join(plugin, "scripts/setup.js"), "apply", "--servers", "bound"], { env, encoding: "utf8", cwd: home }));
assert.deepEqual(fromHome.conflicts, []);
assert.equal(JSON.parse(fs.readFileSync(path.join(home, ".config", "mcporter", "mcporter.json"), "utf8")).mcpServers.bound.cwd, undefined);
execFileSync("sh", ["-c", fromHome.undo], { env, cwd: proj });
fs.writeFileSync(codexHome, codexBefore);

// A different definition already in mcporter (another project's server) is
// not overwritten, and nothing is disabled.
const homeCfg = path.join(home, ".config", "mcporter", "mcporter.json");
const keepCfg = fs.existsSync(homeCfg) ? fs.readFileSync(homeCfg) : null;
const prev = keepCfg ? JSON.parse(keepCfg) : { mcpServers: {} };
fs.mkdirSync(path.dirname(homeCfg), { recursive: true });
prev.mcpServers.projmcp = { command: "run-projmcp", cwd: path.join(tmp, "project-a") };
fs.writeFileSync(homeCfg, JSON.stringify(prev));
fs.rmSync(path.join(tmp, "data with 'space", "conflicts.json"), { force: true });
const clash = JSON.parse(run("scripts/setup.js", ["apply", "--servers", "projmcp"]));
assert.deepEqual(clash.migrated, []);
assert.deepEqual(clash.disabled.claude, []);
assert.match(clash.conflicts.join(), /projmcp \(mcporter: .*already defined differently/);
assert.equal(JSON.parse(fs.readFileSync(homeCfg, "utf8")).mcpServers.projmcp.cwd, path.join(tmp, "project-a"));
// The hooks then leave this project's native projmcp alone.
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(tmp, "data with 'space", "conflicts.json"), "utf8")), ["projmcp"]);
execFileSync("sh", ["-c", `${clash.undo} --force`], { env, cwd: proj });
if (keepCfg) fs.writeFileSync(homeCfg, keepCfg);
else fs.rmSync(homeCfg);

// Unreadable config: inventory names the file instead of silently dropping it.
fs.writeFileSync(path.join(home, ".claude", "mcp.json"), "broken-editor");
const unreadable = JSON.parse(run("scripts/setup.js", ["inventory"])).unreadable;
assert.deepEqual(unreadable.map((u) => u.path), [path.join(home, ".claude", "mcp.json")]);
fs.rmSync(path.join(home, ".claude", "mcp.json"));

// Run from $HOME, a ~/.claude/mcp.json server is user scope: no fixed cwd.
const userMcp = path.join(home, ".claude", "mcp.json");
fs.writeFileSync(userMcp, "{}");
const userEnv = { ...env, IMPORTS: JSON.stringify([{ name: "usr", kind: "claude-code", path: userMcp }]) };
const usr = JSON.parse(execFileSync(process.execPath, [path.join(plugin, "scripts/setup.js"), "apply", "--servers", "usr"], { env: userEnv, encoding: "utf8", cwd: home }));
assert.equal(JSON.parse(fs.readFileSync(path.join(home, ".config", "mcporter", "mcporter.json"), "utf8")).mcpServers.usr.cwd, undefined);
execFileSync("sh", ["-c", usr.undo], { env: userEnv, cwd: proj });
fs.rmSync(userMcp);

// Same definition in a different key order counts as the same, not a conflict.
const cfgK = path.join(home, ".config", "mcporter", "mcporter.json");
const keepK = fs.existsSync(cfgK) ? fs.readFileSync(cfgK) : null;
fs.mkdirSync(path.dirname(cfgK), { recursive: true });
fs.writeFileSync(cfgK, JSON.stringify({ mcpServers: { projmcp: { cwd: proj, command: "run-projmcp" } } }));
const reordered = JSON.parse(run("scripts/setup.js", ["apply", "--servers", "projmcp"]));
assert.deepEqual(reordered.conflicts, []);
assert.deepEqual(reordered.migrated.map((m) => m.name), ["projmcp"]);
execFileSync("sh", ["-c", `${reordered.undo} --force`], { env, cwd: proj });
if (keepK) fs.writeFileSync(cfgK, keepK);
else fs.rmSync(cfgK);
