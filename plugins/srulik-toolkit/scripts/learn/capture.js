// Hook capture: classify a prompt or failed check and log a redacted signal.
const fs = require("node:fs");
const path = require("node:path");
const { MARKER, PRIVATE_DIR, PRIVATE_FILE, off, now, iso, project } = require("./core");

const SECRET_NAME = "(?:password|passwd|token|secret|api[_-]?key|access[_-]?key|private[_-]?key|credentials?)";
const VALUE = `("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|\\S+)`;
function redact(text) {
  return String(text)
    // Greedy to the last @, since a password may itself contain @ or /.
    .replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]*:\S*@/gi, "$1[redacted]@")
    .replace(/\b(?:sk-|ghp_|gho_|ghs_|github_pat_|xox[abpr]-|AKIA|glpat-)[A-Za-z0-9_-]{8,}/g, "[redacted]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\b(Authorization["']?\s*:\s*["']?)(?:[A-Za-z]+\s+)?[^\s"']+/gi, "$1[redacted]")
    .replace(/(\s(?:-u\s*|--user(?:\s+|=)))("[^"]*"|'[^']*'|[^\s:'"]+:\S+)/g, "$1[redacted]")
    // Whole names such as NPM_TOKEN or a JSON "api_key", and quoted values as one token.
    .replace(new RegExp(`(\\b[A-Za-z0-9_]*${SECRET_NAME}[A-Za-z0-9_]*)(["']?\\s*[=:]\\s*)${VALUE}`, "gi"), "$1$2[redacted]")
    .replace(new RegExp(`(--?[A-Za-z0-9-]*${SECRET_NAME}[A-Za-z0-9-]*)(\\s+)${VALUE}`, "gi"), "$1$2[redacted]")
    .slice(0, 500);
}

const correction = /^(?:no\b[,.!:\s]|nope\b|don['’]?t\b|do not\b|stop\b|actually\b|wrong\b|that['’]?s (?:wrong|not)\b|not like that\b|why did you\b|i said\b|instead\b)/i;
const remember = /^remember\s*:/i;
const checkCommand = /(?:^|[\s/;&|(])(?:test|tests|lint|eslint|tsc|typecheck|build|validate(?:\.sh)?|pytest|jest|vitest|cargo\s+(?:test|build|check|clippy)|go\s+(?:test|vet|build))\b/;

function failed(event) {
  if (/failure/i.test(String(event.hook_event_name || ""))) return true;
  const response = event.tool_response;
  for (const value of [event.exit_code, response?.exit_code, response?.exitCode, response?.metadata?.exit_code]) {
    if (typeof value === "number") return value !== 0;
  }
  const text = typeof response === "string" ? response : JSON.stringify(response ?? "");
  return /exit code:?\s*[1-9]\d*/i.test(text) || /"exit_?code"\s*:\s*[1-9]/i.test(text);
}

function classify(event) {
  const prompt = event.prompt ?? event.user_prompt;
  if (typeof prompt === "string") {
    if (prompt.includes(MARKER)) return null;
    const text = prompt.trim();
    if (remember.test(text)) return { kind: "remember", text };
    if (correction.test(text)) return { kind: "correction", text };
    return null;
  }
  const command = event.tool_input?.command ?? event.tool_input?.cmd;
  if (typeof command === "string" && checkCommand.test(command) && failed(event)) {
    const detail = event.error ?? event.error_message ?? "";
    return { kind: "failed_check", text: detail ? `${command}\n${detail}` : command };
  }
  return null;
}

const cwdOf = (event) => event.cwd || event.workspace_roots?.[0] || process.cwd();

function capture(harness, event) {
  if (off()) return "";
  const signal = classify(event);
  if (!signal) return "";
  const { dir } = project(cwdOf(event));
  fs.mkdirSync(dir, PRIVATE_DIR);
  const line = { ts: iso(now()), harness, session: String(event.session_id || event.conversation_id || ""), kind: signal.kind, text: redact(signal.text) };
  fs.appendFileSync(path.join(dir, "signals.jsonl"), `${JSON.stringify(line)}\n`, PRIVATE_FILE);
  return "";
}

module.exports = { capture, cwdOf };
