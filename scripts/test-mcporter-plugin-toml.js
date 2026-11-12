// Codex TOML editing (codex-toml.js disableCodex), a pure function. Run through test-mcporter-plugin.js.
const { assert, path, plugin } = require("./mcporter-plugin-test-fixture");
const { disableCodex } = require(path.join(plugin, "scripts", "codex-toml.js"));
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
// Without any install, Windows never asks execFile to start an npx shim: it
// runs npm's npx-cli.js under node, found beside node or next to npx on PATH.
const npmDir = path.join(shim, "npmdir");
fs.mkdirSync(path.join(npmDir, "node_modules", "npm", "bin"), { recursive: true });
fs.writeFileSync(path.join(npmDir, "npx.cmd"), "@echo off\n");
fs.writeFileSync(path.join(npmDir, "node_modules", "npm", "bin", "npx-cli.js"), "");
process.env.PATH = npmDir;
const noNode = path.join(shim, "no-node");
assert.deepEqual(launcher("win32", noNode), [process.execPath, [path.join(npmDir, "node_modules", "npm", "bin", "npx-cli.js"), "-y", "mcporter@0.17.0"]]);
// Beside node wins over PATH.
const nodeDir = path.join(shim, "nodedir");
fs.mkdirSync(path.join(nodeDir, "node_modules", "npm", "bin"), { recursive: true });
fs.writeFileSync(path.join(nodeDir, "node_modules", "npm", "bin", "npx-cli.js"), "");
assert.equal(launcher("win32", nodeDir)[1][0], path.join(nodeDir, "node_modules", "npm", "bin", "npx-cli.js"));
// No npx-cli.js anywhere: a clear error, never a bare "npx" for execFile.
process.env.PATH = path.join(shim, "none");
assert.throws(() => launcher("win32", noNode), /npx-cli\.js/);
// ...even when the working directory holds a node_modules/npm/bin/npx-cli.js.
{
  const cwd = process.cwd();
  const planted = path.join(shim, "planted");
  fs.mkdirSync(path.join(planted, "node_modules", "npm", "bin"), { recursive: true });
  fs.writeFileSync(path.join(planted, "node_modules", "npm", "bin", "npx-cli.js"), "");
  process.chdir(planted);
  try {
    assert.throws(() => launcher("win32", noNode), /npx-cli\.js/);
    // A relative PATH entry does not find a planted shim either.
    fs.writeFileSync(path.join(planted, "npx.cmd"), "@echo off\n");
    process.env.PATH = ".";
    assert.throws(() => launcher("win32", noNode), /npx-cli\.js/);
  } finally {
    process.chdir(cwd);
  }
}
// CLAUDE_CONFIG_DIR moves both Claude Code's settings and its .claude.json.
process.env.CLAUDE_CONFIG_DIR = path.join(shim, "cc");
assert.equal(claudeDir(), path.join(shim, "cc"));
assert.equal(claudeJson(), path.join(shim, "cc", ".claude.json"));
for (const [k, v] of Object.entries(saved)) v === undefined ? delete process.env[k] : (process.env[k] = v);
fs.rmSync(shim, { recursive: true, force: true });

// Two paths that flatten alike ("a_b/x" and "a/b/x") get different backups.
{
  const { execFileSync } = require("node:child_process");
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "mcporter-bk-"));
  const a = path.join(d, "a_b", "c.toml"), b = path.join(d, "a", "b", "c.toml");
  for (const f of [a, b]) fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(a, "A");
  fs.writeFileSync(b, "B");
  const out = execFileSync(process.execPath, ["-e", `
    process.env.MCPORTER_PLUGIN_DATA = ${JSON.stringify(path.join(d, "data"))};
    const m = require(${JSON.stringify(path.join(plugin, "scripts", "setup.js"))});
    const r = { backups: [] };
    m.backup(${JSON.stringify(a)}, "s", r); m.backup(${JSON.stringify(b)}, "s", r);
    console.log(JSON.stringify(r.backups.map((x) => require("fs").readFileSync(x.backup, "utf8"))));`], { encoding: "utf8" });
  assert.deepEqual(JSON.parse(out), ["A", "B"]);
  fs.rmSync(d, { recursive: true, force: true });
}

// Benchmark: a run counts as following its arm only when it ran the
// arm's command; reading the script or config does not count.
{
  const { followed } = require(path.join(plugin, "benchmark", "followed.js"));
  assert.equal(followed("mcporter", ["Bash: for p in 1 2; do mcporter call inventory.list_items page:$p; done"]), true);
  assert.equal(followed("mcporter", ["Bash: cat config/mcporter.json"]), false);
  assert.equal(followed("mcporter", ["Bash: echo mcporter call inventory.x"]), false);
  assert.equal(followed("saved-script", ["Bash: cd .mcporter/scripts; node inventory-gold-stock.mjs gold"]), true);
  assert.equal(followed("saved-script", ["Bash: cat .mcporter/scripts/inventory-gold-stock.mjs"]), false);
  assert.equal(followed("native", ["mcp__inventory__list_items", "Bash: ls"]), false);
}
