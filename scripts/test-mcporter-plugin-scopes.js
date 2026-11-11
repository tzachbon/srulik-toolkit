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
