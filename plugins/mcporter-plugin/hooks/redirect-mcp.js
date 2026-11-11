// PreToolUse on mcp__*: when the server is also configured in mcporter, allow the
// call but add a hint to use mcporter instead (warn mode). Servers mcporter does
// not know, such as harness-injected session servers, pass through silently.
// MCPORTER_HOOK_MODE=block denies the call instead.
const fs = require("node:fs");
const { serverCache, toolKey } = require("../scripts/mcporter-common");

function decide(input, names, mode = "warn") {
  const match = /^mcp__(.+?)__(.+)$/.exec(input.tool_name || "");
  if (!match) return null;
  const [, key, tool] = match;
  const server = names.find((n) => toolKey(n) === key);
  if (!server) return null;
  const quote = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
  const args = Object.entries(input.tool_input || {})
    .map(([k, v]) => quote(`${k}:${typeof v === "string" ? v : JSON.stringify(v)}`))
    .join(" ");
  const hint = `"${server}" is available through mcporter. Prefer Bash: mcporter call ${quote(`${server}.${tool}`)} ${args} --output json. For several calls, write a script in .mcporter/scripts/.`;
  return mode === "block"
    ? { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: hint } }
    : { hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: hint } };
}

if (require.main === module) {
  let raw = "";
  process.stdin.on("data", (c) => (raw += c));
  process.stdin.on("end", () => {
    try {
      const input = JSON.parse(raw);
      const names = JSON.parse(fs.readFileSync(serverCache(input.cwd || process.cwd()), "utf8"));
      const out = decide(input, names, process.env.MCPORTER_HOOK_MODE);
      if (out) console.log(JSON.stringify(out));
    } catch {}
  });
}

module.exports = { decide };
