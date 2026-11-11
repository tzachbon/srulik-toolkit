// Shared helpers for the mcporter plugin. Node.js standard library only.
const { execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const home = () => process.env.HOME || os.homedir();
const dataRoot = () =>
  process.env.PLUGIN_DATA || process.env.CLAUDE_PLUGIN_DATA || path.join(home(), ".mcporter", "plugin");
// Discovery depends on the project (its config/mcporter.json and editor
// files), so the cache is per working directory.
const serverCache = (cwd = process.cwd()) =>
  path.join(dataRoot(), `servers-${crypto.createHash("sha256").update(cwd).digest("hex").slice(0, 16)}.json`);

// MCPORTER_BIN overrides the command (tests use a fake). Otherwise prefer a
// global install and fall back to npx.
function mcporter(args, { timeout = 30_000 } = {}) {
  const bin = process.env.MCPORTER_BIN;
  const [cmd, pre] = bin ? [process.execPath, [bin]] : onPath("mcporter") ? ["mcporter", []] : ["npx", ["-y", "mcporter@0.17.0"]];
  return execFileSync(cmd, [...pre, ...args], { encoding: "utf8", timeout, stdio: ["ignore", "pipe", "pipe"] });
}

function onPath(name) {
  return (process.env.PATH || "").split(path.delimiter).some((dir) => {
    try {
      fs.accessSync(path.join(dir, name), fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

// mcporter's home config, as mcporter 0.17 config/path-discovery.js picks it:
// the first existing of mcporter.json / mcporter.jsonc under
// $XDG_CONFIG_HOME/mcporter (when set), then ~/.mcporter. None: the first candidate.
const mcporterHomeConfig = () => {
  const legacy = path.join(home(), ".mcporter");
  const xdg = (process.env.XDG_CONFIG_HOME || "").trim();
  const dirs = xdg && path.isAbsolute(xdg) ? [path.join(xdg, "mcporter"), legacy] : [legacy];
  const candidates = [...new Set(dirs)].flatMap((d) => [path.join(d, "mcporter.json"), path.join(d, "mcporter.jsonc")]);
  return candidates.find((c) => fs.existsSync(c)) || candidates[0];
};

// Every editor kind mcporter imports from (mcporter 0.17 DEFAULT_IMPORTS).
const IMPORT_KINDS = ["cursor", "claude-code", "claude-desktop", "codex", "windsurf", "opencode", "vscode"];

const importFrom = (kind, file) => {
  try {
    const args = ["config", "import", kind, "--json", ...(file ? ["--path", file] : [])];
    // entry: mcporter's normalized definition, copied as-is by setup apply.
    return JSON.parse(mcporter(args)).entries.map((e) => ({ name: e.name, kind, path: e.source, entry: e.entry }));
  } catch {
    return [];
  }
};

// One entry per source file. mcporter keeps only the first definition of a name,
// even across files of one editor, so Codex files (which setup edits) are read
// one by one; mcporter 0.17 reads <cwd>/.codex and ~/.codex but not $CODEX_HOME.
// Its claude-code import also skips the project's .mcp.json, so that is read too.
function importedSources() {
  const codexFiles = [
    path.resolve(".codex", "config.toml"),
    path.join(process.env.CODEX_HOME || path.join(home(), ".codex"), "config.toml"),
    path.join(home(), ".codex", "config.toml"),
  ];
  const codex = [...new Set(codexFiles)].filter((f) => fs.existsSync(f)).flatMap((f) => importFrom("codex", f));
  const mcpJson = path.resolve(".mcp.json");
  const project = fs.existsSync(mcpJson) ? importFrom("claude-code", mcpJson) : [];
  const all = [...IMPORT_KINDS.filter((k) => k !== "codex").flatMap((k) => importFrom(k)), ...project, ...codex];
  return all.filter((s, i) => all.findIndex((o) => o.name === s.name && o.path === s.path) === i);
}

function listServers(extra = [], opts) {
  return JSON.parse(mcporter(["config", "list", "--json", ...extra], opts)).servers || [];
}

// Claude Code exposes server "my.server" as mcp__my_server__tool.
const toolKey = (name) => name.replace(/[^A-Za-z0-9_-]/g, "_");

// Atomic replace that keeps the original file mode (new files: owner-only),
// or sets `force` when given. A symlinked config (dotfiles) is written
// through, so the link survives.
function writeText(file, text, force) {
  try {
    file = fs.realpathSync(file);
  } catch {}
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let mode = 0o600;
  try {
    mode = fs.statSync(file).mode & 0o777;
  } catch {}
  const tmp = `${file}.${process.pid}`;
  fs.writeFileSync(tmp, text, { mode: 0o600 });
  fs.chmodSync(tmp, force ?? mode);
  fs.renameSync(tmp, file);
}
const writeJson = (file, value, mode) => writeText(file, `${JSON.stringify(value, null, 2)}\n`, mode);

module.exports = { onPath, home, dataRoot, serverCache, mcporter, listServers, importedSources, mcporterHomeConfig, toolKey, writeJson, writeText };
