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

// Keys mcporter 0.17's Codex import drops: `cwd` (the copy would start
// elsewhere) and the tool filters (the copy would expose tools Codex hid).
// Returns the first one the server sets, or null. When the table cannot be
// located (an inline table, or a multi-line string that could fake its
// header), any of them anywhere in the file counts.
const DROPPED = ["cwd", "enabled_tools", "disabled_tools"];
const codexDropped = (s) => {
  try {
    const text = fs.readFileSync(s.path, "utf8");
    const table = /"""|'''/.test(text) ? null : codexTable(text, s.name);
    return DROPPED.find((k) => (table ? new RegExp(`^[ \\t]*["']?${k}["']?[ \\t]*=`, "m").test(table.body) : new RegExp(`(?:^|[{,\\s])["']?${k}["']?[ \\t]*=`, "m").test(text))) ?? null;
  } catch {
    return "cwd";
  }
};
// Names of the [mcp_servers.<name>] tables not switched off with `enabled = false`.
// ponytail: inline-table definitions are not seen. Upgrade: a real TOML parser.
const codexEnabled = (text) =>
  [...text.matchAll(/^[ \t]*\[[ \t]*mcp_servers[ \t]*\.[ \t]*(?:"([^"]+)"|'([^']+)'|([\w-]+))[ \t]*\]/gm)]
    .map((m) => m[1] ?? m[2] ?? m[3])
    .filter((n) => !/^[ \t]*["']?enabled["']?[ \t]*=[ \t]*false\b/m.test(codexTable(text, n)?.body ?? ""));
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = { disableCodex, codexDropped, codexEnabled };
