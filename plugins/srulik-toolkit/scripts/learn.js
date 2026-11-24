// Self-learning loop. Hooks log corrections and failed checks without a model
// call; the next session start injects active lessons and, at most once a day per
// project, launches a background review whose deltas are merged here.
// Usage: learn.js capture|start <harness> (hook JSON on stdin)
//        learn.js merge <project-key> <deltas-file> [worktree] | stats [project-key]
const fs = require("node:fs");
const path = require("node:path");
const { DAY, off, now, iso, readJson, writeJson, git, project, active, markApplied, lock } = require("./learn/core");
const { capture, cwdOf } = require("./learn/capture");
const { cli, launch, review } = require("./learn/review");
const { merge, stats } = require("./learn/merge");

function start(harness, event) {
  if (off()) return "";
  const info = project(cwdOf(event));
  const statePath = path.join(info.dir, "state.json");
  const state = readJson(statePath, {});
  const out = [];
  const entries = active(info.dir);
  if (entries.length) {
    out.push("Srulik Toolkit learned lessons (apply when relevant):");
    for (const e of entries) out.push(e.scope === "override" ? `- When using \`${e.skill}\`: ${e.text}` : `- ${e.text}`);
    markApplied(info.dir, entries);
  }
  const branches = (state.branches || []).filter((b) => info.top && git(info.top, ["rev-parse", "--verify", "--quiet", `refs/heads/${b.branch}`]));
  if (branches.length) {
    out.push("Srulik Toolkit proposed project fixes on local branches (tell the user, do not merge them):");
    for (const b of branches) out.push(`- ${b.branch}: ${b.summary}${b.pr ? ` (${b.pr})` : ""}`);
  }
  let size = 0;
  try { size = fs.statSync(path.join(info.dir, "signals.jsonl")).size; } catch {}
  const due = !state.last_review_at || now() - Date.parse(state.last_review_at) >= DAY;
  if (size > 0 && due && lock(info.dir)) {
    state.last_review_at = iso(now());
    state.review_offset = size;
    try { launch(harness, info, state); } catch {
      fs.rmSync(path.join(info.dir, "review.lock"), { recursive: true, force: true });
      writeJson(statePath, state);
    }
  }
  return out.join("\n");
}

function hook(mode, harness) {
  let raw = "";
  try { raw = fs.readFileSync(0, "utf8"); } catch {}
  let event = {};
  try { event = JSON.parse(raw || "{}"); } catch {}
  let text = "";
  try { text = (mode === "start" ? start : capture)(harness, event); } catch {}
  if (harness === "cursor" && mode === "start") process.stdout.write(JSON.stringify({ additional_context: text }));
  else if (harness === "cursor" && event.hook_event_name === "beforeSubmitPrompt") process.stdout.write(JSON.stringify({ continue: true }));
  else if (text) process.stdout.write(`${text}\n`);
}

const args = process.argv.slice(require.main === module ? 2 : 1);
const [mode, ...rest] = args;
if (mode === "capture" || mode === "start") hook(mode, cli[rest[0]] ? rest[0] : "claude");
else if (mode === "merge") console.log(JSON.stringify(merge(rest[0], rest[1], rest[2], true)));
else if (mode === "review" && cli[rest[0]]) review(rest[0], rest[1], rest[2]);
else if (mode === "stats") console.log(stats(rest[0]));
else if (require.main === module) { console.error("usage: learn.js capture|start <claude|cursor|codex> | merge <key> <deltas> [worktree] | stats [key]"); process.exitCode = 2; }
