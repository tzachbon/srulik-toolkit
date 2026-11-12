// SessionStart: tell the agent which MCP servers to reach through mcporter.
// Reads `mcporter config list --json` (cached for an hour), drops names this
// project still loads natively, and lists saved scripts.
const fs = require("node:fs");
const path = require("node:path");
const { codexEnabled } = require("../scripts/codex-toml");
const { claudeDir, claudeJson, home, discoveryCache, serverCache, listServers, writeJson, conflicted, toolKey } = require("../scripts/mcporter-common");

const ttl = Number(process.env.MCPORTER_HINT_TTL_MS) || 3_600_000;

// Discovery runs inside the 10 s hook budget, so it gets 5 s. Its raw result
// is cached for the TTL; on failure the stale copy, if any, is reused and
// re-dated, so the next sessions skip the slow call until the TTL passes again.
// ponytail: without mcporter on PATH the npx fallback may need longer than 5 s
// on first use; setup apply requires a global install.
function discover() {
  const file = discoveryCache();
  let stale;
  try {
    stale = JSON.parse(fs.readFileSync(file, "utf8"));
    if (Date.now() - fs.statSync(file).mtimeMs < ttl) return stale;
  } catch {}
  try {
    const found = listServers([], { timeout: 5_000 }).map((s) => ({ name: s.name, cwd: s.cwd, path: s.source?.path }));
    writeJson(file, found);
    return found;
  } catch (err) {
    if (!stale) throw err;
    writeJson(file, stale);
    return stale;
  }
}

const read = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return {};
  }
};

// The servers this project should reach through mcporter, rechecked against
// its native config on every start, so a native copy added within the TTL
// still wins. Written for the redirect hook to read.
function servers() {
  const here = path.resolve(process.cwd());
  // Native copies this session still loads: this project's .mcp.json servers
  // and Claude Code local-scope block (in ~/.claude.json), user-scope
  // ~/.claude.json servers not denied in ~/.claude/settings.json, and the
  // enabled servers in this project's and the user's Codex config.toml.
  const off = read(path.join(here, ".claude", "settings.local.json")).disabledMcpjsonServers || [];
  const cj = read(claudeJson());
  const local = cj.projects?.[here] || {};
  const denied = (read(path.join(claudeDir(), "settings.json")).deniedMcpServers || []).map((d) => d?.serverName);
  const codex = [path.join(here, ".codex"), process.env.CODEX_HOME || path.join(home(), ".codex"), path.join(home(), ".codex")].flatMap((d) => {
    try {
      return codexEnabled(fs.readFileSync(path.join(d, "config.toml"), "utf8"));
    } catch {
      return [];
    }
  });
  const native = [
    ...Object.keys(read(path.join(here, ".mcp.json")).mcpServers || {}).filter((n) => !off.includes(n)),
    ...Object.keys(local.mcpServers || {}).filter((n) => !(local.disabledMcpServers || []).includes(n)),
    ...Object.keys(cj.mcpServers || {}).filter((n) => !denied.includes(n)),
    ...codex,
  ];
  const found = discover();
  // A server bound to another project's folder belongs to that project. Its
  // tool key goes too, so a same-key name ("my.srv", "my_srv") is not offered
  // for the other one's native calls.
  const elsewhere = (s) => s.cwd && path.resolve(s.cwd) !== here && path.resolve(s.cwd) !== path.dirname(path.resolve(s.path || ""));
  const taken = new Set([...native, ...found.filter(elsewhere).map((s) => s.name)].map(toolKey));
  const names = [...new Set(found.map((s) => s.name).filter((n) => !taken.has(toolKey(n))))].sort();
  writeJson(serverCache(), names);
  return names;
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
