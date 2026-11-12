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
// servers-*: the names the hint offered (the redirect hook reads them);
// discovery-*: mcporter's raw list, rechecked against native config each start.
const projectId = (cwd) => crypto.createHash("sha256").update(cwd).digest("hex").slice(0, 16);
const serverCache = (cwd = process.cwd()) => path.join(dataRoot(), `servers-${projectId(cwd)}.json`);
const discoveryCache = (cwd = process.cwd()) => path.join(dataRoot(), `discovery-${projectId(cwd)}.json`);

// Claude Code's config dir and global config, moved by CLAUDE_CONFIG_DIR.
const claudeDir = () => process.env.CLAUDE_CONFIG_DIR || path.join(home(), ".claude");
const claudeJson = () => path.join(process.env.CLAUDE_CONFIG_DIR || home(), ".claude.json");

// MCPORTER_BIN overrides the command (tests use a fake). Otherwise prefer a
// global install and fall back to npx. Windows npm installs are .cmd shims,
// which execFile cannot start without a shell, so there the package's CLI (or
// npm's npx-cli.js) runs under node directly and no argument passes a shell.
function launcher(platform = process.platform, nodeDir = path.dirname(process.execPath)) {
  if (process.env.MCPORTER_BIN) return [process.execPath, [process.env.MCPORTER_BIN]];
  const found = which("mcporter", platform);
  if (found && platform !== "win32") return [found, []];
  const cli = found && path.join(path.dirname(found), "node_modules", "mcporter", "dist", "cli.js");
  if (cli && fs.existsSync(cli)) return [process.execPath, [cli]];
  if (platform !== "win32") return ["npx", ["-y", "mcporter@0.17.0"]];
  // npm's npx-cli.js sits beside node, or beside the npx shim on PATH.
  // Only a found shim's folder: path.dirname("") is ".", the project itself.
  const npxShim = which("npx", platform);
  const dirs = npxShim ? [nodeDir, path.dirname(npxShim)] : [nodeDir];
  const npx = dirs.map((d) => path.join(d, "node_modules", "npm", "bin", "npx-cli.js")).find((f) => fs.existsSync(f));
  if (!npx) throw new Error("mcporter not found: install it (npm install -g mcporter@0.17.0); npx-cli.js was not found beside node or npx");
  return [process.execPath, [npx, "-y", "mcporter@0.17.0"]];
}
function mcporter(args, { timeout = 30_000 } = {}) {
  const [cmd, pre] = launcher();
  return execFileSync(cmd, [...pre, ...args], { encoding: "utf8", timeout, stdio: ["ignore", "pipe", "pipe"] });
}

// The first PATH entry for `name` (with .cmd/.exe on Windows), or undefined.
function which(name, platform = process.platform) {
  const exts = platform === "win32" ? ["", ".cmd", ".exe"] : [""];
  // Absolute entries only: a relative one (".") would search the project.
  for (const dir of (process.env.PATH || "").split(path.delimiter).filter((d) => path.isAbsolute(d))) {
    for (const ext of exts) {
      const file = path.join(dir, name + ext);
      try {
        fs.accessSync(file, platform === "win32" ? fs.constants.F_OK : fs.constants.X_OK);
        return file;
      } catch {}
    }
  }
}
const onPath = (name) => Boolean(which(name));

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

// Import failures for a named existing file are recorded, so a broken config
// is reported instead of its servers silently missing. Default-path imports
// fail when an editor is not installed, which is not an error.
const importErrors = [];
const importFrom = (kind, file) => {
  try {
    const args = ["config", "import", kind, "--json", ...(file ? ["--path", file] : [])];
    // entry: mcporter's normalized definition, copied as-is by setup apply.
    return JSON.parse(mcporter(args)).entries.map((e) => ({ name: e.name, kind, path: e.source, entry: e.entry }));
  } catch (err) {
    if (file) importErrors.push({ kind, path: file, error: String(err.stderr || err.message).split("\n")[0] });
    return [];
  }
};

// One entry per source file. mcporter keeps only the first definition of a name,
// even across files of one editor, so the Codex and Claude Code files (which
// setup edits) are read one by one, in mcporter 0.17's order. mcporter misses
// $CODEX_HOME, CLAUDE_CONFIG_DIR and the project's .mcp.json; those are read too.
function importedSources() {
  const codexFiles = [
    path.resolve(".codex", "config.toml"),
    path.join(process.env.CODEX_HOME || path.join(home(), ".codex"), "config.toml"),
    path.join(home(), ".codex", "config.toml"),
  ];
  const codex = [...new Set(codexFiles)].filter((f) => fs.existsSync(f)).flatMap((f) => importFrom("codex", f));
  const claudeFiles = [
    ...["settings.local.json", "settings.json", "mcp.json"].map((f) => path.resolve(".claude", f)),
    ...["settings.local.json", "settings.json", "mcp.json"].map((f) => path.join(claudeDir(), f)),
    claudeJson(),
    path.resolve(".mcp.json"),
  ];
  // Read in mcporter's own order, so the first copy listed is the one it would pick.
  const claude = [...new Set(claudeFiles)].filter((f) => fs.existsSync(f)).flatMap((f) => importFrom("claude-code", f));
  const all = IMPORT_KINDS.flatMap((k) => (k === "claude-code" ? claude : k === "codex" ? codex : importFrom(k)));
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

// Names whose native copy is defined differently from the mcporter one: the
// hint and the redirect hook leave those to the native tools.
const conflictFile = () => path.join(dataRoot(), "conflicts.json");
const conflicted = () => {
  try {
    return new Set(JSON.parse(fs.readFileSync(conflictFile(), "utf8")));
  } catch {
    return new Set();
  }
};

module.exports = { importErrors, launcher, which, claudeDir, claudeJson, conflictFile, conflicted, onPath, home, dataRoot, serverCache, discoveryCache, mcporter, listServers, importedSources, mcporterHomeConfig, toolKey, writeJson, writeText };
