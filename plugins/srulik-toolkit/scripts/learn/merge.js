// Deterministic merge of review deltas into the lesson stores, and recurrence stats.
const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DAY, INBOX, PRUNE_DAYS, PRIVATE_FILE, root, now, iso, readJson, writeJson, git, stores, withStores, real } = require("./core");

const ops = new Set(["add", "seen", "edit", "archive", "project_fix"]);
const idPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
function invalid(delta, fixes) {
  if (!delta || typeof delta !== "object" || !ops.has(delta.op)) return "unknown op";
  if (delta.op === "project_fix") {
    if (!/^[a-z0-9][a-z0-9-]{0,49}$/.test(delta.slug || "")) return "bad slug";
    if (typeof delta.summary !== "string" || !delta.summary || delta.summary.length > 200) return "bad summary";
    return fixes > 0 ? "only one project_fix per review" : null;
  }
  if (!["user", "project", "override"].includes(delta.scope)) return "bad scope";
  if (!idPattern.test(delta.id || "")) return "bad id";
  if (delta.scope === "override" && delta.op === "add" && !/^[a-z0-9-]{1,64}$/.test(delta.skill || "")) return "override needs a skill";
  if (["add", "edit"].includes(delta.op) && (typeof delta.text !== "string" || !delta.text.trim() || delta.text.length > 200)) return "text must be 1 to 200 characters";
  return null;
}

function commitFix(worktree, delta, info, state, fromCli) {
  const top = worktree && git(worktree, ["rev-parse", "--show-toplevel"]);
  if (!top) return "no worktree";
  // Only the review's own linked worktree, never the main checkout or another worktree with the user's work.
  const gitDir = git(worktree, ["rev-parse", "--path-format=absolute", "--git-dir"]);
  if (!gitDir || gitDir === git(worktree, ["rev-parse", "--path-format=absolute", "--git-common-dir"])) return "not a linked worktree";
  const cwd = real(process.cwd());
  const tree = real(top);
  if (!tree || (state.review_source && tree === real(state.review_source))) return "the user's own worktree";
  // A worktree made for this review is always newer than the launch.
  const born = fs.statSync(gitDir).birthtimeMs;
  if (born > 0 && state.last_launch?.at && born < Date.parse(state.last_launch.at)) return "worktree predates the review";
  if (fromCli && (!cwd || (cwd !== tree && !cwd.startsWith(tree + path.sep)))) return "not run from the review worktree";
  if (!state.review_head || git(worktree, ["rev-parse", "HEAD"]) !== state.review_head) return "worktree is not at the review commit";
  if (!git(worktree, ["status", "--porcelain"], 60_000)) return "no changes";
  const branch = `srulik-learn/${delta.slug}`;
  // The review could edit files that repository hooks run, so no hook may run outside its sandbox.
  const noHooks = ["-c", `core.hooksPath=${os.devNull}`];
  const run = (args, timeout) => git(worktree, [...noHooks, ...args], timeout);
  if (run(["checkout", "-b", branch]) === null) return "branch exists";
  run(["add", "-A"], 60_000);
  if (run(["commit", "--no-verify", "-m", `chore(learn): ${delta.summary}`], 120_000) === null) {
    run(["checkout", "--detach"]);
    run(["branch", "-D", branch]);
    return "commit failed";
  }
  const record = { branch, summary: delta.summary, at: iso(now()) };
  if (process.env.SRULIK_TOOLKIT_LEARN_PRS === "1" && info.top && git(info.top, ["remote"])) {
    const steps = [["git", ["-C", worktree, ...noHooks, "push", "--no-verify", "-u", "origin", branch]], ["gh", ["pr", "create", "--draft", "--head", branch, "--title", `Learned: ${delta.summary}`, "--body", "Proposed by the Srulik Toolkit self-learning review from repeated session signals."]]];
    if (process.env.SRULIK_TOOLKIT_LEARN_DRY === "1") record.pr_dry = steps.map(([c, a]) => [c, ...a].join(" "));
    else {
      try {
        cp.execFileSync("gh", ["auth", "status"], { stdio: "ignore", timeout: 10000 });
        for (const [c, a] of steps) record.pr = cp.execFileSync(c, a, { cwd: worktree, encoding: "utf8", timeout: 60000 }).trim();
      } catch { delete record.pr; }
    }
  }
  state.branches = [...(state.branches || []).filter((b) => b.branch !== branch), record];
  return null;
}

function merge(key, deltasFile, worktree, fromCli) {
  if (!/^[0-9a-f]{12}$/.test(key || "")) throw new Error("bad project key");
  const dir = path.join(root(), "projects", key);
  const info = { key, dir, top: worktree ? path.resolve(git(worktree, ["rev-parse", "--path-format=absolute", "--git-common-dir"]) || worktree, "..") : null };
  const statePath = path.join(dir, "state.json");
  const input = readJson(deltasFile, null);
  fs.rmSync(deltasFile, { force: true });
  if (worktree) fs.rmSync(path.join(worktree, INBOX), { recursive: true, force: true });
  const at = iso(now());
  const keep = (reason) => {
    // The signals stay for the next review.
    const state = readJson(statePath, {});
    delete state.review_offset;
    state.rejected = [...(state.rejected || []), { at, reason }].slice(-20);
    writeJson(statePath, state);
    fs.rmSync(path.join(dir, "review.lock"), { recursive: true, force: true });
    return { applied: 0, rejected: [reason] };
  };
  if (!Array.isArray(input?.deltas)) return keep("invalid deltas file");
  let result;
  if (!withStores(30_000, () => { result = apply(input.deltas, dir, info, worktree, fromCli, at); })) return keep("stores busy");
  return result;
}

// Moves the reviewed prefix aside by rename, so a concurrent capture append is never truncated.
function consume(dir, offset) {
  const live = path.join(dir, "signals.jsonl");
  const aside = path.join(dir, `signals.consumed.${process.pid}`);
  try { fs.renameSync(live, aside); } catch { return; }
  try {
    const rest = fs.readFileSync(aside).subarray(offset);
    if (rest.length) fs.appendFileSync(live, rest, PRIVATE_FILE);
  } finally { fs.rmSync(aside, { force: true }); }
}

function batchTimes(dir, offset) {
  let bytes;
  try { bytes = fs.readFileSync(path.join(dir, "signals.jsonl")); } catch { return []; }
  const times = [];
  for (const line of bytes.subarray(0, offset ?? bytes.length).toString("utf8").split("\n")) {
    try { const ts = JSON.parse(line).ts; if (typeof ts === "string") times.push(ts); } catch {}
  }
  return times;
}

function apply(deltas, dir, info, worktree, fromCli, at) {
  const statePath = path.join(dir, "state.json");
  const state = readJson(statePath, {});
  const known = new Set(batchTimes(dir, state.review_offset));
  const files = stores(dir);
  const data = Object.fromEntries(Object.entries(files).map(([scope, file]) => [scope, readJson(file, { entries: {} })]));
  const applied = [];
  const rejected = [];
  let fixes = 0;
  const touched = new Set();
  for (const delta of deltas) {
    const reason = invalid(delta, fixes);
    if (reason) { rejected.push({ delta, reason }); continue; }
    if (delta.op === "project_fix") {
      fixes++;
      const why = commitFix(worktree, delta, info, state, fromCli);
      (why ? rejected : applied).push(why ? { delta, reason: why } : delta);
      continue;
    }
    // One review may move an entry once, so a single signal cannot reach two sightings.
    if (touched.has(`${delta.scope}/${delta.id}`)) { rejected.push({ delta, reason: "duplicate id in one review" }); continue; }
    touched.add(`${delta.scope}/${delta.id}`);
    const entries = (data[delta.scope].entries ||= {});
    const entry = entries[delta.id];
    if (!entry && delta.op !== "add") { rejected.push({ delta, reason: "unknown id" }); continue; }
    if (!entry) {
      entries[delta.id] = { id: delta.id, text: delta.text.trim(), ...(delta.skill ? { skill: delta.skill } : {}), seen: 1, first_seen: at, last_seen: at, applied_at: null, recurred_after_apply: 0, archived: false };
    } else if (delta.op === "edit") {
      entry.text = delta.text.trim();
    } else if (delta.op === "archive") {
      entry.archived = true;
    } else {
      // Only a signal captured after the lesson was injected shows it recurring.
      if (entry.applied_at && known.has(delta.ts) && delta.ts > entry.applied_at) entry.recurred_after_apply++;
      entry.seen++;
      entry.last_seen = at;
      entry.archived = false;
    }
    applied.push(delta);
  }
  for (const store of Object.values(data)) {
    for (const entry of Object.values(store.entries || {})) {
      if (!entry.archived && now() - Date.parse(entry.last_seen) > PRUNE_DAYS * DAY) entry.archived = true;
    }
  }
  for (const [scope, file] of Object.entries(files)) writeJson(file, data[scope]);
  try { consume(dir, state.review_offset || 0); } catch {}
  delete state.review_offset;
  state.last_merge_at = at;
  state.rejected = [...(state.rejected || []), ...rejected.map((r) => ({ at, ...r }))].slice(-20);
  writeJson(statePath, state);
  fs.rmSync(path.join(dir, "review.lock"), { recursive: true, force: true });
  return { applied: applied.length, rejected: rejected.map((r) => r.reason) };
}

function stats(key) {
  const dirs = key ? [key] : (() => { try { return fs.readdirSync(path.join(root(), "projects")); } catch { return []; } })();
  const rows = [];
  const seen = new Set();
  for (const k of dirs.length ? dirs : [""]) {
    for (const [scope, file] of Object.entries(stores(path.join(root(), "projects", k)))) {
      if (seen.has(file)) continue;
      seen.add(file);
      for (const e of Object.values(readJson(file, { entries: {} }).entries || {})) rows.push({ scope, ...e });
    }
  }
  const appliedRows = rows.filter((r) => r.applied_at);
  return [
    `lessons: ${rows.length}, applied: ${appliedRows.length}, applied with zero recurrences: ${appliedRows.filter((r) => !r.recurred_after_apply).length}`,
    ...rows.map((r) => `${r.scope}/${r.id}: seen ${r.seen}, applied ${r.applied_at ? "yes" : "no"}, recurred_after_apply ${r.recurred_after_apply}${r.archived ? ", archived" : ""}`),
  ].join("\n");
}

module.exports = { merge, stats };
