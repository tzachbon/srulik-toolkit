// Codex TOML editing in setup.js (disableCodex), a pure function. Run through test-mcporter-plugin.js.
const { assert, path, plugin } = require("./mcporter-plugin-test-fixture");
const { disableCodex } = require(path.join(plugin, "scripts", "setup.js"));
// A table with a multi-line string is left alone and reported.
const ml = disableCodex('[mcp_servers.m]\nargs = ["-e", """\nenabled = true;\n"""]\nenabled = true\n', ["m"]);
assert.deepEqual(ml.missed, ["m"]);
assert.match(ml.text, /"""\nenabled = true;\n"""\]\nenabled = true\n$/);
// A multi-line string elsewhere can fake a table header, so the whole file is left alone.
const fakeHeader = '[agent]\nnote = """\n[mcp_servers.inv]\nenabled = true\n[other]\n"""\n\n[mcp_servers.inv]\ncommand = "i"\n';
assert.deepEqual(disableCodex(fakeHeader, ["inv"]), { text: fakeHeader, missed: ["inv"] });
// Codex TOML: indented key, quoted name, header comment, inline table.
const toml = disableCodex("[mcp_servers.a]\n  enabled = true\n\n [ mcp_servers.'b' ] # note\nx = 1\n[mcp_servers.d]\n'enabled' = true\n[mcp_servers]\nc = { command = 'x' }\n", ["a", "b", "c", "d"]);
assert.equal(toml.text, "[mcp_servers.a]\n  enabled = false\n\n [ mcp_servers.'b' ] # note\nenabled = false\nx = 1\n[mcp_servers.d]\nenabled = false\n[mcp_servers]\nc = { command = 'x' }\n");
assert.deepEqual(toml.missed, ["c"]);

// Windows: an npm `mcporter.cmd` shim is found, and its package CLI runs under
// node directly (execFile cannot start a .cmd without a shell).
const { launcher, claudeDir, claudeJson } = require(path.join(plugin, "scripts", "mcporter-common.js"));
const fs = require("node:fs");
const os = require("node:os");
const shim = fs.mkdtempSync(path.join(os.tmpdir(), "mcporter-shim-"));
fs.writeFileSync(path.join(shim, "mcporter.cmd"), "@echo off\n");
fs.mkdirSync(path.join(shim, "node_modules", "mcporter", "dist"), { recursive: true });
fs.writeFileSync(path.join(shim, "node_modules", "mcporter", "dist", "cli.js"), "");
const saved = { PATH: process.env.PATH, MCPORTER_BIN: process.env.MCPORTER_BIN, CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR };
delete process.env.MCPORTER_BIN;
process.env.PATH = shim;
assert.deepEqual(launcher("win32"), [process.execPath, [path.join(shim, "node_modules", "mcporter", "dist", "cli.js")]]);
// Without any install, Windows never asks execFile to start the npx.cmd shim.
process.env.PATH = path.join(shim, "none");
assert.notEqual(launcher("win32")[0], "npx.cmd");
// CLAUDE_CONFIG_DIR moves both Claude Code's settings and its .claude.json.
process.env.CLAUDE_CONFIG_DIR = path.join(shim, "cc");
assert.equal(claudeDir(), path.join(shim, "cc"));
assert.equal(claudeJson(), path.join(shim, "cc", ".claude.json"));
for (const [k, v] of Object.entries(saved)) v === undefined ? delete process.env[k] : (process.env[k] = v);
fs.rmSync(shim, { recursive: true, force: true });
