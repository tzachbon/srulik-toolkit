#!/usr/bin/env node
// Rank LLMs by intelligence for the price, using the Artificial Analysis data API
// (https://artificialanalysis.ai/). Needs ARTIFICIAL_ANALYSIS_API_KEY; without it, exit 2 so callers fall back.
// Usage: node models.js [--frontier] [name-or-slug ...]
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const url = process.env.ARTIFICIAL_ANALYSIS_URL || "https://artificialanalysis.ai/api/v2/language/models/free";
const key = process.env.ARTIFICIAL_ANALYSIS_API_KEY;
const dataRoot = process.env.PLUGIN_DATA || process.env.CLAUDE_PLUGIN_DATA || path.join(os.tmpdir(), "srulik-toolkit");
const cache = path.join(dataRoot, "models.json");
const ttl = 86_400_000;

async function load() {
  try {
    if (Date.now() - fs.statSync(cache).mtimeMs < ttl) return JSON.parse(fs.readFileSync(cache, "utf8"));
  } catch {}
  const data = [];
  for (let page = 1; ; page++) {
    const pageUrl = new URL(url);
    pageUrl.searchParams.set("page", page);
    const response = await fetch(pageUrl, { headers: { "x-api-key": key }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Artificial Analysis API returned HTTP ${response.status}`);
    const body = await response.json();
    if (!Array.isArray(body.data)) throw new Error("Artificial Analysis API response has no data array");
    data.push(...body.data);
    if (!body.pagination?.has_more) break;
  }
  fs.mkdirSync(dataRoot, { recursive: true });
  // Replace atomically so an interrupted write never leaves a broken cache.
  const temporary = `${cache}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(data));
  fs.renameSync(temporary, cache);
  return data;
}

// A model is on the frontier when no other model is at least as smart for less, or smarter for the same price.
function rank(raw) {
  const models = raw
    .map((m) => ({
      slug: m.slug,
      name: m.name,
      creator: m.model_creator?.name,
      intelligence: m.evaluations?.artificial_analysis_intelligence_index,
      // The free tier has no blended price; use Artificial Analysis's 3:1 input:output blend.
      price: (3 * m.pricing?.price_1m_input_tokens + m.pricing?.price_1m_output_tokens) / 4,
      input: m.pricing?.price_1m_input_tokens,
      output: m.pricing?.price_1m_output_tokens,
      tokensPerSecond: m.performance?.median_output_tokens_per_second,
    }))
    .filter((m) => Number.isFinite(m.intelligence) && Number.isFinite(m.input) && Number.isFinite(m.output));
  for (const m of models) {
    m.frontier = !models.some((o) => o !== m &&
      ((o.intelligence >= m.intelligence && o.price < m.price) || (o.intelligence > m.intelligence && o.price <= m.price)));
  }
  return models.sort((a, b) => b.intelligence - a.intelligence || a.price - b.price);
}

async function main() {
  if (!key) {
    process.stderr.write("Set ARTIFICIAL_ANALYSIS_API_KEY (free at https://artificialanalysis.ai/) to rank models.\n");
    process.exit(2);
  }
  const args = process.argv.slice(2);
  const frontierOnly = args.includes("--frontier");
  const names = args.filter((a) => a !== "--frontier").map((a) => a.toLowerCase());
  let models = rank(await load());
  if (frontierOnly) models = models.filter((m) => m.frontier);
  if (names.length) models = models.filter((m) => names.some((n) => m.slug.toLowerCase().includes(n) || m.name.toLowerCase().includes(n)));
  process.stdout.write(JSON.stringify({ source: "https://artificialanalysis.ai/", models }, null, 2) + "\n");
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
