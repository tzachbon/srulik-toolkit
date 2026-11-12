#!/usr/bin/env node
// Consolidate harness MCP servers into the mcporter home config.
//   setup.js inventory                       -> JSON: importable servers, home servers
//   setup.js apply --servers a,b [--dry-run]  -> copy to home config, verify, disable native copies
//   setup.js undo <receipt.json>              -> restore every backed-up file
// Node.js standard library only.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { disableCodex, codexDropped } = require("./codex-toml");
const { importErrors, claudeDir, claudeJson, conflictFile, conflicted, onPath, home, dataRoot, mcporter, listServers, importedSources, mcporterHomeConfig, writeJson, writeText } = require("./mcporter-common");

const claudeSettings = () => path.join(claudeDir(), "settings.json");
// Per-project switches Claude Code reads (as `/mcp disable` writes them).
const projectClaudeLocal = () => path.resolve(".claude", "settings.local.json");
const hash = (f) => {
  try {
    return crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
  } catch {
    return null;
  }
};

function inventory() {
  const local = listServers(["--source", "local"]);
  const localNames = new Set(local.map((s) => s.name));
  return {
    // One row per source file: the same name in two editors appears twice.
    // The definition (entry) stays out of the output: it can hold secrets.
    importable: importedSources().map(({ entry, ...s }) => ({ ...s, inMcporter: localNames.has(s.name) })),
    // Config files mcporter could not read: their servers are missing above.
    unreadable: importErrors,
    alreadyInMcporter: local.map((s) => ({ name: s.name, path: s.source?.path })),
  };
}

// Back up once per file before the first write. A file that did not exist is
// recorded with backup: null so undo deletes it. Backups can hold inline
// secrets, so they go owner-only under the plugin data dir, never beside a
// project file where `git add` could pick them up.
// ponytail: backups are kept for undo and never pruned; delete old ones by hand.
function backup(file, stamp, receipt) {
  if (receipt.backups.some((b) => b.file === file)) return;
  if (!fs.existsSync(file)) return receipt.backups.push({ file, backup: null });
  // The path hash keeps two files with similar paths from sharing a backup.
  const id = crypto.createHash("sha256").update(path.resolve(file)).digest("hex").slice(0, 12);
  const copy = path.join(dataRoot(), "backups", stamp, `${id}-${path.basename(file)}`);
  fs.mkdirSync(path.dirname(copy), { recursive: true, mode: 0o700 });
  fs.copyFileSync(file, copy);
  fs.chmodSync(copy, 0o600);
  receipt.backups.push({ file, backup: copy });
}

// Claude Code: user-level denylist blocks the server in every scope; the entry stays.
function disableClaude(names) {
  const file = claudeSettings();
  const settings = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const denied = Array.isArray(settings.deniedMcpServers) ? settings.deniedMcpServers : [];
  for (const serverName of names) if (!denied.some((d) => d.serverName === serverName)) denied.push({ serverName });
  writeJson(file, { ...settings, deniedMcpServers: denied });
}
// Add names to a string list in a JSON file, at `at(value)` (created if missing).
function addNames(file, at, names) {
  const value = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const [obj, key] = at(value);
  obj[key] = [...new Set([...(Array.isArray(obj[key]) ? obj[key] : []), ...names])];
  writeJson(file, value);
}


// ~/.claude.json holds user-scope servers and one block per project, but
// mcporter returns only one definition per name. The denylist is name-wide,
// and each project's copy runs in its own folder, so a name defined in more
// than one block (user or project) is a conflict, even with equal definitions.
function claudeJsonCopies(name) {
  try {
    const raw = JSON.parse(fs.readFileSync(claudeJson(), "utf8"));
    return [raw.mcpServers?.[name], ...Object.values(raw.projects || {}).map((p) => p?.mcpServers?.[name])].filter(Boolean).length;
  } catch {
    return 0;
  }
}

// Whether f is dir or inside it. path.relative gives an absolute path across
// Windows drives, which is never inside.
const under = (dir, f, p = path) => {
  const rel = p.relative(dir, f);
  return !p.isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${p.sep}`);
};

// A source that runs only in this project: a file under it (not a user-level
// config, even when setup runs from $HOME), or a Claude Code local-scope server
// in ~/.claude.json's block for this project with no user-scope copy.
// ponytail: other editors' user files under $HOME (e.g. ~/.cursor) still count
// as project files when setup runs from $HOME; those copies are manual anyway.
function projectBound(s) {
  const user = [claudeJson(), path.join(process.env.CODEX_HOME || path.join(home(), ".codex"), "config.toml"), path.join(home(), ".codex", "config.toml")];
  if (s.path === claudeJson()) {
    try {
      const raw = JSON.parse(fs.readFileSync(claudeJson(), "utf8"));
      return !raw.mcpServers?.[s.name] && Boolean(raw.projects?.[process.cwd()]?.mcpServers?.[s.name]);
    } catch {
      return false;
    }
  }
  return !user.includes(s.path) && !under(claudeDir(), s.path) && under(process.cwd(), s.path);
}

// JSON with sorted object keys, so key order never makes two definitions differ.
const canon = (v) => JSON.stringify(v, (_, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
const groupBy =(xs, key) => {
  const m = new Map();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) || []), x]);
  return m;
};

function apply(names, dryRun) {
  // After setup the hint, hook and skill call a bare `mcporter`. The npx
  // fallback adds it to PATH only for its own process, so without an install
  // the native copies would be disabled with nothing left to call them.
  // MCPORTER_BIN does not count: daily calls use the bare command.
  if (!dryRun && !onPath("mcporter")) {
    throw new Error("mcporter is not installed. Run `npm install -g mcporter@0.17.0`, then rerun. Nothing was changed.");
  }
  // Every source of each name; the first one is the definition that is copied.
  const found = new Map();
  for (const s of importedSources()) found.set(s.name, [...(found.get(s.name) || []), s]);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const receipt = { createdAt: new Date().toISOString(), migrated: [], authRequired: [], failed: [], conflicts: [], disabled: { claude: [], codex: [] }, backups: [] };
  const mcporterHome = mcporterHomeConfig();
  const receiptFile = path.join(dataRoot(), `setup-receipt-${stamp}.json`);
  const sh = (x) => `'${x.replace(/'/g, `'\\''`)}'`;
  receipt.undo = `node ${sh(__filename)} undo ${sh(receiptFile)}`;
  // Saved after every backup, so a crash part-way still leaves an undo path.
  const save = () => dryRun || writeJson(receiptFile, receipt);
  const keep = (file) => {
    backup(file, stamp, receipt);
    save();
  };
  // Fail before any write when a file we must edit is unreadable.
  // ponytail: a .jsonc home config with comments is refused (no JSONC parser in
  // the stdlib); mcporter itself drops comments when it rewrites the file.
  for (const file of [claudeSettings(), claudeJson(), projectClaudeLocal(), mcporterHome]) {
    if (!fs.existsSync(file)) continue;
    try {
      JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      throw new Error(`${file} is not valid JSON (comments are not supported); fix it, then rerun. Nothing was changed.`);
    }
  }

  const conflictNames = new Set();
  for (const name of names) {
    const sources = found.get(name);
    if (!sources) {
      const unread = importErrors.map((e) => `${e.kind}: ${e.path}`).join(", ");
      receipt.failed.push({ name, reason: `not found in any harness config${unread ? ` (unreadable: ${unread})` : ""}` });
      continue;
    }
    const ref = `${sources[0].kind}:${sources[0].path}`;
    // Disable every native copy with the same definition. A same-name server
    // defined differently elsewhere is another backend: it stays enabled and is
    // reported, so the user can pick one or give it another name.
    // A project-file stdio server runs from the project natively; in the home
    // config mcporter would start it from the config's folder instead, so it
    // gets the project as cwd. That makes it differ from a user-scope copy.
    // ponytail: user-scope servers run from whatever project the session is in,
    // so they get no fixed cwd. Upgrade: per-project mcporter configs.
    const resolved = (s) => {
      const def = { ...s.entry };
      if (def.command && !def.baseUrl && !def.cwd && projectBound(s)) def.cwd = process.cwd();
      return def;
    };
    const same = (s) => canon(resolved(s)) === canon(resolved(sources[0]));
    const native = sources.filter(same).map((s) => ({ kind: s.kind, path: s.path }));
    const other = sources.filter((x) => !same(x));
    if (other.length) conflictNames.add(name);
    for (const s of other) receipt.conflicts.push(`${name} (${s.kind}: ${s.path}): defined differently from ${ref} (or bound to another project folder); left enabled`);
    // Claude Code's denylist is by name, so it would also block a different
    // Claude Code definition: leave those copies for the user.
    let nameOnly = other.some((x) => x.kind === "claude-code");
    const dropped = sources.filter((x) => x.kind === "codex").map(codexDropped).find(Boolean);
    if (dropped) {
      // Its mcporter import would run in the wrong folder or expose tools
      // Codex hid, so the hooks must not point calls at it either.
      conflictNames.add(name);
      receipt.failed.push({ name, from: ref, reason: `Codex \`${dropped}\` is not imported by mcporter; add it to mcporter by hand, then disable the native copy` });
      continue;
    }
    if (claudeJsonCopies(name) > 1) {
      nameOnly = true;
      conflictNames.add(name);
      receipt.conflicts.push(`${name} (claude-code: ${claudeJson()}): defined in more than one scope (user or project); not denied`);
    }
    if (!sources[0].entry) {
      receipt.failed.push({ name, from: ref, reason: "mcporter returned no definition" });
      continue;
    }
    if (dryRun) {
      receipt.migrated.push({ name, from: ref, native, dryRun: true, ...(nameOnly && { claudeConflict: true }) });
      continue;
    }
    keep(mcporterHome);
    // Exact bytes before this server's add, so a failed check restores any
    // definition it replaced instead of deleting it.
    const before = fs.existsSync(mcporterHome) ? fs.readFileSync(mcporterHome, "utf8") : null;
    // Copy the definition read from the exact source file. `config add
    // --copy-from` would search mcporter's default paths only and miss
    // $CODEX_HOME and .mcp.json.
    // ponytail: inline env/header secrets are copied as-is (they were already
    // plain text in the harness config); the file is made owner-only. Move them
    // to ${VAR} placeholders by hand when sharing the config.
    const config = before === null ? {} : JSON.parse(before);
    const def = resolved(sources[0]);
    // A different definition already in mcporter (for example another
    // project's same-name server, bound to its folder) is not replaced.
    const existing = config.mcpServers?.[name];
    if (existing && canon(existing) !== canon(def)) {
      conflictNames.add(name);
      receipt.conflicts.push(`${name} (mcporter: ${mcporterHome}): already defined differently there; not replaced, native copies left enabled`);
      continue;
    }
    // Owner-only before the secret-bearing file appears, not after.
    writeJson(mcporterHome, { ...config, mcpServers: { ...config.mcpServers, [name]: def } }, 0o600);
    let status = "unknown";
    try {
      status = JSON.parse(mcporter(["--config", mcporterHome, "list", name, "--json"], { timeout: 60_000 })).status;
    } catch (err) {
      status = `error: ${String(err.stderr || err.message).split("\n")[0]}`;
    }
    // A project config/mcporter.json defining the same name wins over the home
    // config, so ordinary calls would not reach the copy just checked.
    // Also for a server that needs a login: `mcporter auth` would log in to
    // whichever definition ordinary discovery finds.
    if (status === "ok" || status === "auth") {
      let effective;
      try {
        effective = listServers(["--source", "local"]).find((x) => x.name === name)?.source?.path;
      } catch {} // a discovery error leaves `effective` unset, which fails below
      // Only a positive match counts: no result means ordinary calls (for
      // example with MCPORTER_CONFIG set) would not find the server at all.
      if (!effective) status = "not found by ordinary mcporter discovery (is MCPORTER_CONFIG set?)";
      else if (path.resolve(effective) !== path.resolve(mcporterHome)) {
        status = `shadowed by ${effective}`;
        // Ordinary calls reach that other definition, not this native server.
        conflictNames.add(name);
      }
    }
    const entry = { name, from: ref, native, status, ...(nameOnly && { claudeConflict: true }) };
    if (status === "ok") receipt.migrated.push(entry);
    else if (status === "auth") {
      // Keep the definition so `mcporter auth <name>` can log in; the native copy
      // stays enabled until a later apply sees the server answer.
      receipt.authRequired.push({ ...entry, next: `mcporter auth ${sh(name)}, then rerun apply --servers ${sh(name)}` });
    } else {
      // Keep the session hint truthful: put mcporter's config back as it was.
      if (before === null) fs.rmSync(mcporterHome, { force: true });
      else writeText(mcporterHome, before);
      receipt.failed.push({ ...entry, reason: `${/^(shadowed|not found)/.test(status) ? status : "did not answer through mcporter"}; mcporter config restored, native copy left enabled` });
    }
  }

  const ok = receipt.migrated.filter((m) => !m.dryRun);
  const copies = ok.flatMap((m) => m.native.map((n) => ({ name: m.name, conflict: m.claudeConflict, ...n })));
  // Claude Code, by where the copy lives. A user-scope server loads in every
  // project, so it goes on the user denylist. A project's .mcp.json server and
  // a local-scope server (this project's block in ~/.claude.json) are switched
  // off for this project only, so another project's same-name server is untouched.
  // Project .claude/*.json copies and same-name conflicts are left for the user.
  // ponytail: a user-scope deny also hides another project's same-name project
  // server, which setup does not see. Upgrade: scan every project for the name.
  const userClaude = [claudeJson(), ...["settings.local.json", "settings.json", "mcp.json"].map((f) => path.join(claudeDir(), f))];
  const claudeCopies = copies.filter((c) => c.kind === "claude-code" && !c.conflict);
  const scope = (c) =>
    c.path === path.resolve(".mcp.json") ? "mcpjson" : c.path === claudeJson() && projectBound(c) ? "local" : userClaude.includes(c.path) ? "user" : "manual";
  const manual = copies.filter((c) => (c.kind !== "claude-code" || c.conflict || scope(c) === "manual") && c.kind !== "codex");
  const named = (s) => [...new Set(claudeCopies.filter((c) => scope(c) === s).map((c) => c.name))];
  if (named("user").length) {
    keep(claudeSettings());
    disableClaude(named("user"));
  }
  if (named("mcpjson").length) {
    keep(projectClaudeLocal());
    addNames(projectClaudeLocal(), (v) => [v, "disabledMcpjsonServers"], named("mcpjson"));
  }
  if (named("local").length) {
    keep(claudeJson());
    addNames(claudeJson(), (v) => [v.projects[process.cwd()], "disabledMcpServers"], named("local"));
  }
  receipt.disabled.claude = [...new Set(claudeCopies.filter((c) => scope(c) !== "manual").map((c) => c.name))];
  // Codex: edit each config.toml that defines the server (home or project).
  for (const [file, names] of groupBy(copies.filter((c) => c.kind === "codex"), (c) => c.path)) {
    if (!fs.existsSync(file)) {
      manual.push(...names);
      continue;
    }
    keep(file);
    const { text, missed } = disableCodex(fs.readFileSync(file, "utf8"), names.map((c) => c.name));
    writeText(file, text);
    for (const c of names) (missed.includes(c.name) ? manual : receipt.disabled.codex).push(missed.includes(c.name) ? c : `${c.name} (${file})`);
  }
  receipt.manual = manual.map((c) => `${c.name} (${c.kind}: ${c.path}): disable it in that editor`);

  if (!dryRun) {
    // Names whose native copy here is another backend than the one mcporter
    // reaches (defined differently, already held differently, or shadowed by a
    // project config): the hint and the redirect hook leave those native.
    // ponytail: the list is shared by all projects, so a name skipped for one
    // project is skipped everywhere (safe: the native tool keeps working).
    // Upgrade: a per-project list.
    const next = new Set([...conflicted(), ...conflictNames]);
    if (next.size !== conflicted().size || [...next].some((n) => !conflicted().has(n))) {
      keep(conflictFile());
      writeJson(conflictFile(), [...next].sort());
    }
    // State after apply, so undo can refuse to overwrite later changes.
    for (const b of receipt.backups) b.after = hash(b.file);
    save();
    receipt.receipt = receiptFile;
    clearHintCaches();
  }
  return receipt;
}

// Refresh every project's session hint and redirect hook.
function clearHintCaches() {
  try {
    for (const f of fs.readdirSync(dataRoot())) if (/^(servers|discovery)-.*\.json$/.test(f)) fs.rmSync(path.join(dataRoot(), f), { force: true });
  } catch {}
}

function undo(file, force) {
  const receipt = JSON.parse(fs.readFileSync(file, "utf8"));
  // A later apply or edit would be lost by restoring the older snapshot.
  // An entry without an after-state is from an apply that stopped part-way, so
  // whether it changed since is unknown: refused too.
  const unverified = receipt.backups.filter((b) => !("after" in b)).map((b) => b.file);
  const changed = receipt.backups.filter((b) => "after" in b && hash(b.file) !== b.after).map((b) => b.file);
  if (unverified.length && !force) {
    throw new Error(`not verified (the apply stopped part-way): ${unverified.join(", ")}. Check them, then rerun with --force to restore. Nothing was changed.`);
  }
  if (changed.length && !force) {
    throw new Error(`changed since this apply: ${changed.join(", ")}. Undo newer receipts first, or rerun with --force to restore anyway. Nothing was changed.`);
  }
  for (const { file: target, backup: copy } of receipt.backups) {
    if (copy) fs.copyFileSync(copy, target);
    else fs.rmSync(target, { force: true });
  }
  clearHintCaches();
  return { restored: receipt.backups.map((b) => b.file) };
}

if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2);
  const flag = (n) => {
    const i = rest.indexOf(n);
    return i === -1 ? undefined : rest[i + 1];
  };
  const commands = {
    inventory: () => inventory(),
    apply: () => flag("--servers") && apply(flag("--servers").split(",").filter(Boolean), rest.includes("--dry-run")),
    undo: () => rest[0] && undo(rest[0], rest.includes("--force")),
  };
  let out;
  try {
    out = commands[cmd]?.();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  if (!out) {
    console.error("usage: setup.js inventory | apply --servers a,b [--dry-run] | undo <receipt.json>");
    process.exit(2);
  }
  console.log(JSON.stringify(out, null, 2));
}

module.exports = { backup, under };
