const fs = require("node:fs");

if (process.env.SRULIK_TOOLKIT_BLOCKED_STOP !== "0") {
  try {
    const event = JSON.parse(fs.readFileSync(0, "utf8"));
    const message = event.last_assistant_message;
    if (event.hook_event_name === "Stop" && event.stop_hook_active === false && typeof message === "string") {
      let fenced = false;
      let currentBlocker = false;
      for (const line of message.split(/\r?\n/)) {
        const raw = line.trim();
        if (/^(?:```|~~~)/.test(raw)) {
          fenced = !fenced;
          continue;
        }
        if (fenced || raw.startsWith(">")) continue;
        const text = raw.replace(/^(?:#{1,6}\s*|[-*+]\s+)*/, "").replace(/\*\*/g, "").trim();
        if (/^resolved\s*:|^(?:the )?task (?:is )?(?:complete|completed|done)\b/i.test(text)) {
          currentBlocker = false;
        } else if (!/\b(?:resolved|fixed)\b/i.test(text) && (
          /^blocked\s*:\s*(?!none\b|no\s+blockers?\b|nothing\b|resolved\b|not\s+blocked\b)\S/i.test(text) ||
          /^(?:(?:i(?:['’]m| am)|we(?:['’]re| are)|the (?:task|work) is) blocked\b|(?:i|we) (?:cannot|can['’]t) (?:proceed|continue)\b)/i.test(text)
        )) {
          currentBlocker = true;
        }
      }
      if (currentBlocker) {
        const reason = "Before reporting this task blocked, make one focused recovery pass. Recheck the original request, current permission mode, and failure evidence. Try a materially different authorized route using access already granted, including an approved sign-in or verification method when relevant. Preserve scope, planning or review limits, explicit stop requests, and approval and security boundaries; never grant yourself new access. Verify any recovery and resume the task. If no safe authorized route remains, report the precise prerequisite and what you tried.";
        process.stdout.write(JSON.stringify({ decision: "block", reason }));
      }
    }
  } catch {
    // Malformed or missing hook input must not prevent the agent from stopping.
  }
}
