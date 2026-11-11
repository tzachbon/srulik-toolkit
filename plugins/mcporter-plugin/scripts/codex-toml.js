// Codex config.toml edits for setup.js. Node.js standard library only.
const fs = require("node:fs");

// Codex: set `enabled = false` inside each [mcp_servers.<name>] table.
// Returns the new text and the names whose table was not found (for example an
// inline-table definition); those are reported for manual action, never as disabled.
function disableCodex(text, names) {
  // ponytail: no TOML parser in the stdlib. A multi-line string anywhere could
  // hide or fake a table header or an `enabled` line, so such a file is left
  // for manual action. Upgrade: a real TOML parser.
  if (text.includes('"""') || text.includes("'''")) return { text, missed: [...names] };
  const missed = [];
  for (const name of names) {
    const table = codexTable(text, name);
    if (!table) {
      missed.push(name);
      continue;
    }
    const { start, end, body } = table;
    const key = /^([ \t]*)(?:enabled|"enabled"|'enabled')[ \t]*=.*$/m;
    const newBody = key.test(body) ? body.replace(key, "$1enabled = false") : `\nenabled = false${body}`;
    text = text.slice(0, start) + newBody + text.slice(end);
  }
  return { text, missed };
}
// The [mcp_servers.<name>] table body, or null.
function codexTable(text, name) {
  const n = escape(name);
  const header = new RegExp(`^[ \\t]*\\[[ \\t]*mcp_servers[ \\t]*\\.[ \\t]*(?:"${n}"|'${n}'|${n})[ \\t]*\\][ \\t]*(?:#.*)?$`, "m");
  const match = header.exec(text);
  if (!match) return null;
  const start = match.index + match[0].length;
  const next = text.slice(start).search(/^[ \t]*\[/m);
  const end = next === -1 ? text.length : start + next;
  return { start, end, body: text.slice(start, end) };
}

// mcporter 0.17's Codex import drops `cwd`, so the copy would start elsewhere.
// When the table cannot be located (an inline table), any `cwd` in the file counts.
const codexHasCwd = (s) => {
  try {
    const text = fs.readFileSync(s.path, "utf8");
    // A multi-line string can fake the table header, so then check the whole file.
    const table = /"""|'''/.test(text) ? null : codexTable(text, s.name);
    return table ? /^[ \t]*(?:cwd|"cwd"|'cwd')[ \t]*=/m.test(table.body) : /(?:^|[{,\s])["']?cwd["']?[ \t]*=/m.test(text);
  } catch {
    return true;
  }
};
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = { disableCodex, codexHasCwd };
