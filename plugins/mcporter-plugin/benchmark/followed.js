// Whether a run's tool calls used its arm's own path. Matches the invocation,
// not a mention: `cat` of the script or config, or `echo`, does not count.
const start = String.raw`(^|[;&|(\n]|\bdo|\bthen|Bash:)\s*`;
const rules = {
  native: (calls) => calls.length > 0 && calls.every((c) => c.startsWith("mcp__inventory__")),
  mcporter: (calls) => calls.some((c) => new RegExp(`${start}mcporter\\s+call\\s+inventory\\.`).test(c)) && !calls.some((c) => c.startsWith("mcp__")),
  "saved-script": (calls) => calls.some((c) => new RegExp(`${start}node\\s+(\\S*/)?inventory-gold-stock\\.mjs\\b`).test(c)),
};
const followed = (arm, calls) => rules[arm](calls);

module.exports = { followed };
