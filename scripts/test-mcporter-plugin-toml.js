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
