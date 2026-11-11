#!/usr/bin/env node
// Benchmark: the same task through native MCP tools vs. mcporter.
//   node benchmark/run.js [--runs 3] [--model sonnet] [--pages 4]
// Needs `claude` and `mcporter` (or npx). Writes benchmark/results.json.
// Each arm runs `claude -p --output-format json` with hooks, CLAUDE.md and
// other MCP servers turned off, so only the arm's tools differ.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const here = __dirname;
const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i === -1 ? d : process.argv[i + 1];
};
const runs = Number(arg("--runs", 3));
const model = arg("--model", "sonnet");
const pages = Number(arg("--pages", 4));
process.env.INVENTORY_PAGES = String(pages);
const { ITEMS } = require("./fake-inventory-server");
const expected = ITEMS.filter((i) => i.tag === "gold").reduce((s, i) => s + i.stock, 0);
const task =
  `The inventory MCP server lists items in pages (list_items, pages 1-${pages}). ` +
  'What is the total stock of all items with tag "gold"? Reply with only the integer.';

const server = { command: process.execPath, args: [path.join(here, "fake-inventory-server.js")], env: { INVENTORY_PAGES: String(pages) } };
// Node scripts import "mcporter"; ESM resolves it from node_modules only.
const nodeModules = process.env.MCPORTER_NODE_MODULES || execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
const examples = path.join(here, "..", "skills", "mcporter", "examples", ".mcporter", "scripts");

// A fresh project per run, so a script one run writes never reaches another.
// Only the saved-script arm starts with the example scripts.
function project(name) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "mcporter-bench-"));
  fs.mkdirSync(path.join(work, "config"));
  fs.writeFileSync(path.join(work, "config", "mcporter.json"), JSON.stringify({ mcpServers: { inventory: server } }));
  fs.writeFileSync(path.join(work, "native-mcp.json"), JSON.stringify({ mcpServers: { inventory: { type: "stdio", ...server } } }));
  fs.writeFileSync(path.join(work, "no-mcp.json"), JSON.stringify({ mcpServers: {} }));
  if (name === "saved-script") fs.cpSync(examples, path.join(work, ".mcporter", "scripts"), { recursive: true });
  fs.symlinkSync(nodeModules, path.join(work, "node_modules"), "dir");
  return work;
}

const arms = {
  native: {
    args: ["--mcp-config", "native-mcp.json", "--strict-mcp-config", "--allowedTools", "mcp__inventory__list_items,mcp__inventory__get_item", "--tools", ""],
    prompt: task,
  },
  mcporter: {
    args: ["--mcp-config", "no-mcp.json", "--strict-mcp-config", "--allowedTools", "Bash", "--tools", "Bash"],
    prompt:
      `${task}\nThe server is configured in mcporter (cwd has config/mcporter.json). Do not use native MCP tools. ` +
      "Call it from Bash: `mcporter list inventory --schema`, `mcporter call inventory.list_items page:1 --output json`. " +
      "For several calls, write one script that makes them all and prints only the answer.",
  },
  "saved-script": {
    args: ["--mcp-config", "no-mcp.json", "--strict-mcp-config", "--allowedTools", "Bash", "--tools", "Bash"],
    prompt: `${task}\nThe server is configured in mcporter. Saved scripts are listed in .mcporter/scripts/README.md; reuse one if it fits.`,
  },
};
function once(name) {
  const { args, prompt } = arms[name];
  const work = project(name);
  const started = Date.now();
  const out = execFileSync(
    "claude",
    ["-p", prompt, "--output-format", "json", "--model", model, "--setting-sources", "", "--no-session-persistence", "--disable-slash-commands", ...args],
    { cwd: work, encoding: "utf8", timeout: 600_000, maxBuffer: 64 << 20, env: { ...process.env, MCPORTER_CONFIG: path.join(work, "config", "mcporter.json") } },
  );
  fs.rmSync(work, { recursive: true, force: true });
  const r = JSON.parse(out);
  const u = r.usage || {};
  return {
    arm: name,
    correct: String(r.result).trim() === String(expected),
    answer: String(r.result).slice(0, 200),
    turns: r.num_turns,
    wallMs: Date.now() - started,
    durationMs: r.duration_ms,
    inputTokens: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0),
    cacheWriteTokens: u.cache_creation_input_tokens || 0,
    cacheReadTokens: u.cache_read_input_tokens || 0,
    outputTokens: u.output_tokens || 0,
    costUsd: r.total_cost_usd,
  };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

const results = [];
for (let i = 0; i < runs; i++) {
  for (const name of Object.keys(arms)) {
    const r = once(name);
    results.push(r);
    console.error(JSON.stringify(r));
  }
}
const summary = {};
for (const name of Object.keys(arms)) {
  const rs = results.filter((r) => r.arm === name);
  summary[name] = {
    runs: rs.length,
    correct: rs.filter((r) => r.correct).length,
    ...Object.fromEntries(["turns", "durationMs", "inputTokens", "cacheWriteTokens", "cacheReadTokens", "outputTokens", "costUsd"].map((k) => [k, median(rs.map((r) => r[k]))])),
  };
}
const out = { date: new Date().toISOString().slice(0, 10), model, pages, claudeVersion: execFileSync("claude", ["--version"], { encoding: "utf8" }).trim(), expected, summary, results };
fs.writeFileSync(path.join(here, `results-${pages}-pages.json`), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
