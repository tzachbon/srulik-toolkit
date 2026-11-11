// SessionStart: tell the agent which MCP servers to reach through mcporter.
// Reads `mcporter config list --json` (cached for an hour) and lists saved scripts.
const fs = require("node:fs");
const path = require("node:path");
const { serverCache, listServers, writeJson } = require("../scripts/mcporter-common");

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
    const names = [...new Set(listServers([], { timeout: 5_000 }).map((s) => s.name))].sort();
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

try {
  const names = servers();
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
