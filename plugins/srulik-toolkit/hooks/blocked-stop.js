const fs = require("node:fs");

const blockedOn = process.env.SRULIK_TOOLKIT_BLOCKED_STOP !== "0";
const deferredOn = process.env.SRULIK_TOOLKIT_DEFERRED_STOP !== "0";

if (blockedOn || deferredOn) {
  try {
    const event = JSON.parse(fs.readFileSync(0, "utf8"));
    const message = event.last_assistant_message;
    if (event.hook_event_name === "Stop" && event.stop_hook_active === false && typeof message === "string") {
      let fenced = false;
      let currentBlocker = false;
      let listsNext = false;
      let waiting = false;
      for (const line of message.split(/\r?\n/)) {
        const raw = line.trim();
        if (/^(?:```|~~~)/.test(raw)) {
          fenced = !fenced;
          continue;
        }
        if (fenced || raw.startsWith(">")) continue;
        const text = raw.replace(/^(?:#{1,6}\s*|[-*+]\s+)*/, "").replace(/\*\*/g, "").trim();
        if (/^next(?:\s+steps?|\s+up)?\s*(?::|$)/i.test(text)) listsNext = true;
        if (/^(?:waiting|needs_context|stopped)\b/i.test(text)) waiting = true;
        if (/^resolved\s*:|^(?:the )?task (?:is )?(?:complete|completed|done)\b/i.test(text)) {
          currentBlocker = false;
        } else if (!/\b(?:resolved|fixed)\b/i.test(text) && (
          /^blocked\s*:\s*(?!none\b|no\s+blockers?\b|nothing\b|resolved\b|not\s+blocked\b)\S/i.test(text) ||
          /^(?:(?:i(?:['’]m| am)|we(?:['’]re| are)|the (?:task|work) is) blocked\b|(?:i|we) (?:cannot|can['’]t) (?:proceed|continue)\b)/i.test(text)
        )) {
          currentBlocker = true;
        }
      }
      if (blockedOn && currentBlocker) {
        const reason = "Before reporting this task blocked, make one focused recovery pass. Recheck the original request, current permission mode, and failure evidence. Try a materially different authorized route using access already granted, including an approved sign-in or verification method when relevant. Preserve scope, planning or review limits, explicit stop requests, and approval and security boundaries; never grant yourself new access. Verify any recovery and resume the task. If no safe authorized route remains, report the precise prerequisite and what you tried.";
        process.stdout.write(JSON.stringify({ decision: "block", reason }));
      } else if (deferredOn && listsNext && !currentBlocker && !waiting) {
        const reason = "You ended with a Next list. A progress update is not a stopping point: do each listed step that needs nothing from the user, within the task's existing authority and scope, then report. Stop again only if the user asked for a plan, recap or handoff alone, or every remaining step needs the user; then replace Next with Waiting on: naming who must act and why.";
        process.stdout.write(JSON.stringify({ decision: "block", reason }));
      }
    }
  } catch {
    // Malformed or missing hook input must not prevent the agent from stopping.
  }
}
