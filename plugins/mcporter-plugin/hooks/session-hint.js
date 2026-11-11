// SessionStart: tell the agent which MCP servers to reach through mcporter.
// Reads `mcporter config list --json` (cached for an hour) and lists saved scripts.
const fs = require("node:fs");
const path = require("node:path");
const { serverCache, listServers, writeJson, conflicted, toolKey } = require("../scripts/mcporter-common");

const ttl = Number(process.env.MCPORTER_HINT_TTL_MS) || 3_600_000;

// Discovery runs inside the 10 s hook budget, so it gets 5 s. On failure the
// stale cache, if any, is reused and re-dated, so the next sessions skip the
// slow call until the TTL passes again.
// ponytail: without mcporter on PATH the npx fallback may need longer than 5 s
// on first use; setup apply requires a global install.
function servers() {
  let stale;
  try {
    stale = JSON.parse(fs.readFileSync(serverCache(), "utf8"));
    if (Date.now() - fs.statSync(serverCache()).mtimeMs < ttl) return stale;
  } catch {}
  try {
    const here = path.resolve(process.cwd());
    // Native copies this project still loads from its own .mcp.json.
    let native = {};
    let off = [];
    try {
      native = JSON.parse(fs.readFileSync(path.join(here, ".mcp.json"), "utf8")).mcpServers || {};
      off = JSON.parse(fs.readFileSync(path.join(here, ".claude", "settings.local.json"), "utf8")).disabledMcpjsonServers || [];
    } catch {}
    // Not a replacement here: a server bound to another project's folder, or a
    // name this project still defines and loads natively (setup never ran here).
    // ponytail: other per-project sources (.claude.json local scope, .codex) are
    // not checked here. Upgrade: compare against setup's per-project import.
    const elsewhere = (s) => s.cwd && path.resolve(s.cwd) !== here && path.resolve(s.cwd) !== path.dirname(path.resolve(s.source?.path || ""));
    // By tool key: "my.srv" and "my_srv" both reach mcp__my_srv__ natively.
    const loaded = new Set(Object.keys(native).filter((n) => !off.includes(n)).map(toolKey));
    const names = [...new Set(listServers([], { timeout: 5_000 }).filter((s) => !elsewhere(s) && !loaded.has(toolKey(s.name))).map((s) => s.name))].sort();
    writeJson(serverCache(), names);
    return names;
  } catch (err) {
    if (!stale) throw err;
    writeJson(serverCache(), stale);
    return stale;
  }
}

function scripts() {
  try {
    return fs.readdirSync(path.join(process.cwd(), ".mcporter", "scripts")).filter((f) => /\.(sh|ts|js|mjs)$/.test(f));
  } catch {
    return [];
  }
}

// A server that needs a login fails at once with "run 'mcporter auth <name>'"
// instead of opening a browser nobody watches and waiting 5 minutes; the
// auth-notice hook then tells the user. Silent token refresh still works.
// ponytail: Claude Code only (Codex has no env file); Codex relies on the skill rule.
try {
  if (process.env.CLAUDE_ENV_FILE) fs.appendFileSync(process.env.CLAUDE_ENV_FILE, "export MCPORTER_OAUTH_NO_BROWSER=1\n");
} catch {}

try {
  // A name whose native copy is another backend stays on the native tools,
  // and so does any name sharing its tool key ("my.srv" and "my_srv").
  const skip = new Set([...conflicted()].map(toolKey));
  const names = servers().filter((n) => !skip.has(toolKey(n)));
  if (!names.length) {
    console.log("mcporter: no servers configured. Run /mcporter-setup to move harness MCP servers into mcporter.");
  } else {
    const saved = scripts();
    console.log(
      [
        `MCP servers via mcporter (use these through Bash, not native mcp__ tools): ${names.join(", ")}.`,
        "Schema: mcporter list <server> --schema. Call: mcporter call <server>.<tool> key:value --output json.",
        "Two or more calls, a loop, or a repeatable task: write or reuse a script in .mcporter/scripts/ (see the mcporter skill).",
        saved.length ? `Saved scripts: ${saved.join(", ")}. Reuse before writing a new one.` : "",
      ].filter(Boolean).join("\n"),
    );
  }
} catch {
  // mcporter missing or slow: stay silent rather than block startup.
}
