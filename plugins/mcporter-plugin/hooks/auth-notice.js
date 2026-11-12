// After a failed Bash call: when mcporter says a server needs a login, tell the
// user (the harness login prompt does not cover servers moved to mcporter) and
// tell the agent to stop retrying. Claude Code: PostToolUseFailure (`error`);
// Codex: PostToolUse, which also runs after a failed command (`tool_response`).
// Only a plain server name is copied, so other output cannot put a shell
// command into the notice; and only a command that runs mcporter (directly or
// through a saved script) counts.
const login = (text) => {
  const name = String(text).match(/run 'mcporter auth ([\w.-]+)'/i)?.[1];
  return name && `mcporter auth ${name}`;
};

function decide(input) {
  if (input?.tool_name !== "Bash") return null;
  if (!/\bmcporter\b/.test(input.tool_input?.command ?? "")) return null;
  const cmd = login(input.error ?? JSON.stringify(input.tool_response ?? ""));
  if (!cmd) return null;
  return {
    systemMessage: `An MCP server needs a login: run \`${cmd}\` in a terminal, then retry.`,
    hookSpecificOutput: {
      hookEventName: input.hook_event_name || "PostToolUseFailure",
      additionalContext: `mcporter needs the user to log in (\`${cmd}\`). Do not retry or work around it; ask the user to run that command, then continue.`,
    },
  };
}

if (require.main === module) {
  let raw = "";
  process.stdin.on("data", (c) => (raw += c));
  process.stdin.on("end", () => {
    try {
      const out = decide(JSON.parse(raw));
      if (out) console.log(JSON.stringify(out));
    } catch {} // never break the session over a notice
  });
}

module.exports = { decide };
