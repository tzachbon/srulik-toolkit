// Shared state paths, JSON and git helpers for the self-learning loop.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DAY = 86_400_000;
const MARKER = "srulik-learn-review";
const CAP = 10;
const ACTIVE_AT = 2;
const PRUNE_DAYS = 60;
const LOCK_STALE = 2 * 3_600_000;
const INBOX = ".srulik-learn";
const root = () => process.env.SRULIK_TOOLKIT_LEARN_HOME || path.join(os.homedir(), ".srulik-toolkit", "learn");
const off = () => process.env.SRULIK_TOOLKIT_LEARN === "0";
const now = () => Number(process.env.SRULIK_TOOLKIT_LEARN_NOW) || Date.now();
const iso = (ms) => new Date(ms).toISOString();

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
// Signals hold prompts and command output, so state is owner-only.
const PRIVATE_DIR = { recursive: true, mode: 0o700 };
const PRIVATE_FILE = { mode: 0o600 };
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), PRIVATE_DIR);
  const temporary = `${file}.${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, PRIVATE_FILE);
  fs.renameSync(temporary, file);
}
function git(cwd, args, timeout = 5000) {
  try { return cp.execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", timeout, stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return null; }
}
function project(cwd) {
  const top = git(cwd, ["rev-parse", "--show-toplevel"]);
  // Keyed by the shared git dir, so every worktree of one repository shares its lessons.
  const common = top && git(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  const key = crypto.createHash("sha1").update(path.resolve(common || top || cwd)).digest("hex").slice(0, 12);
  return { top: top ? path.resolve(top) : null, key, dir: path.join(root(), "projects", key) };
}
const stores = (projectDir) => ({
  user: path.join(root(), "user", "lessons.json"),
  override: path.join(root(), "user", "overrides.json"),
  project: path.join(projectDir, "lessons.json"),
});

function active(projectDir) {
  const entries = [];
  for (const [scope, file] of Object.entries(stores(projectDir))) {
    for (const entry of Object.values(readJson(file, { entries: {} }).entries || {})) {
      const fresh = now() - Date.parse(entry.last_seen) <= PRUNE_DAYS * DAY;
      if (entry.seen >= ACTIVE_AT && !entry.archived && fresh) entries.push({ ...entry, scope });
    }
  }
  return entries.sort((a, b) => b.seen - a.seen || String(b.last_seen).localeCompare(String(a.last_seen))).slice(0, CAP);
}

// The user stores are shared by every project, so their read-modify-write runs under one lock.
function withStores(waitMs, fn) {
  const file = path.join(root(), "stores.lock");
  fs.mkdirSync(root(), PRIVATE_DIR);
  const until = Date.now() + waitMs;
  for (;;) {
    try { fs.mkdirSync(file, 0o700); break; } catch (error) {
      if (error.code !== "EEXIST") return false;
      try {
        if (Date.now() - fs.statSync(file).mtimeMs > 10 * 60_000) { fs.rmSync(file, { recursive: true, force: true }); continue; }
      } catch {}
      if (Date.now() >= until) return false;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  try { fn(); } finally { fs.rmSync(file, { recursive: true, force: true }); }
  return true;
}

// Recurrence only counts once a lesson has actually been in session context.
function markApplied(projectDir, entries) {
  const pending = entries.filter((e) => !e.applied_at);
  if (!pending.length) return;
  withStores(500, () => {
    for (const [scope, file] of Object.entries(stores(projectDir))) {
      const data = readJson(file, null);
      const hits = pending.filter((e) => e.scope === scope && data?.entries?.[e.id] && !data.entries[e.id].applied_at);
      for (const e of hits) data.entries[e.id].applied_at = iso(now());
      if (hits.length) writeJson(file, data);
    }
  });
}

function lock(dir) {
  const file = path.join(dir, "review.lock");
  try {
    fs.mkdirSync(file, 0o700);
    return true;
  } catch {
    try {
      if (now() - fs.statSync(file).mtimeMs < LOCK_STALE) return false;
      fs.rmSync(file, { recursive: true, force: true });
      fs.mkdirSync(file, 0o700);
      return true;
    } catch { return false; }
  }
}

function real(file) {
  // native expands Windows 8.3 short names, which git never reports.
  try {
    const full = fs.realpathSync.native(file);
    return process.platform === "win32" ? full.toLowerCase() : full;
  } catch { return null; }
}

function onPath(name) {
  const extensions = process.platform === "win32" ? (process.env.PATHEXT || ".EXE;.CMD").split(";") : [""];
  for (const directory of (process.env.PATH || "").split(path.delimiter)) {
    for (const extension of extensions) {
      if (directory && fs.existsSync(path.join(directory, name + extension))) return true;
    }
  }
  return false;
}

module.exports = { DAY, MARKER, INBOX, CAP, ACTIVE_AT, PRUNE_DAYS, LOCK_STALE, PRIVATE_DIR, PRIVATE_FILE, root, off, now, iso, readJson, writeJson, git, project, stores, active, withStores, markApplied, lock, real, onPath };
