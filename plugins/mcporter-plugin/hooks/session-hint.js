// SessionStart: tell the agent which MCP servers to reach through mcporter.
// Reads `mcporter config list --json` (cached for an hour) and lists saved scripts.
const fs = require("node:fs");
const path = require("node:path");
const { serverCache, listServers, writeJson } = require("../scripts/mcporter-common");

const ttl = Number(process.env.MCPORTER_HINT_TTL_MS) || 3_600_000;

function servers() {
  try {
    if (Date.now() - fs.statSync(serverCache()).mtimeMs < ttl) return JSON.parse(fs.readFileSync(serverCache(), "utf8"));
  } catch {}
  const names = [...new Set(listServers().map((s) => s.name))].sort();
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
