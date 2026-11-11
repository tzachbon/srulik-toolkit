// PreToolUse on mcp__*: when the server is also configured in mcporter, allow the
// call but add a hint to use mcporter instead (warn mode). Servers mcporter does
// not know, such as harness-injected session servers, pass through silently.
// MCPORTER_HOOK_MODE=block denies the call instead.
const fs = require("node:fs");
const { serverCache, toolKey, conflicted } = require("../scripts/mcporter-common");

function decide(input, names, mode = "warn") {
  const name = input.tool_name || "";
  // A server name may itself contain "__": take the longest known prefix.
  const server = names
    .filter((n) => name.startsWith(`mcp__${toolKey(n)}__`) && name.length > `mcp__${toolKey(n)}__`.length)
    .sort((a, b) => toolKey(b).length - toolKey(a).length)[0];
  if (!server) return null;
  const tool = name.slice(`mcp__${toolKey(server)}__`.length);
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
      // A name whose native copy is another backend is not the same server.
      const skip = conflicted();
      const names = JSON.parse(fs.readFileSync(serverCache(input.cwd || process.cwd()), "utf8")).filter((n) => !skip.has(n));
      const out = decide(input, names, process.env.MCPORTER_HOOK_MODE);
      if (out) console.log(JSON.stringify(out));
    } catch {}
  });
}

module.exports = { decide };
