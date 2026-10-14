#!/usr/bin/env node
// Public Artificial Analysis dataset reader, matching aa-models metadata and filtering.
const { createDecipheriv, createHash } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir, userInfo } = require('node:os');
const { dirname, isAbsolute, join } = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const SOURCE = 'https://artificialanalysis.ai/evaluations/artificial-analysis-intelligence-index';
const TTL = 86400;
const MAX_BYTES = 32 * 1024 * 1024;
const SELF = realpathSync(__filename);

// shortcut: follows the public page's data format; update the reader if that format changes.
function manifestFromHTML(html) {
  const stream = [...html.matchAll(/<script[^>]*>self\.__next_f\.push\(([\s\S]*?)\)<\/script>/g)]
    .map(m => JSON.parse(m[1]))
    .filter(v => v[0] === 1 && typeof v[1] === 'string')
    .map(v => v[1]).join('');
  let manifest;
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (value.slug === 'artificial-analysis-intelligence-index' && value.initialModels && value.manifest) {
      manifest = value.manifest;
    }
    for (const child of Object.values(value)) walk(child);
  }
  for (const line of stream.split('\n')) {
    const json = line.slice(line.indexOf(':') + 1);
    if (!json.startsWith('{') && !json.startsWith('[')) continue;
    let value;
    try { value = JSON.parse(json); } catch { continue; }
    walk(value);
  }
  if (!manifest || !/^\/data\/[a-f0-9]+\.txt$/.test(manifest.path) || !/^[a-f0-9]{64}$/.test(manifest.key)) {
    throw new Error('Public data manifest is missing or changed; cache was preserved.');
  }
  return manifest;
}

function decodeDataset(encrypted, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const nonce = createHash('sha256').update(key).digest().subarray(0, 12);
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(encrypted.subarray(-16));
  const compressed = Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]);
  return JSON.parse(gunzipSync(compressed, { maxOutputLength: MAX_BYTES }).toString('utf8'));
}

async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Artificial Analysis returned HTTP ${response.status}.`);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > MAX_BYTES) throw new Error('Artificial Analysis response exceeded 32 MiB.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function normalizeModels(data) {
  if (!Array.isArray(data.models) || !data.models.length) throw new Error('Model data is empty or changed.');
  const seen = new Set();
  const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const models = data.models.map(m => {
    if (!m || typeof m.id !== 'string' || typeof m.slug !== 'string' || typeof m.name !== 'string' || seen.has(m.id)) {
      throw new Error('Model identifiers are invalid or duplicated.');
    }
    seen.add(m.id);
    return {
      id: m.id, slug: m.slug, name: m.name, creator: m.creator?.name ?? null,
      release: m.release?.name ?? null, release_date: m.releaseDate ?? null,
      effort_variant: m.suffix ?? null, deprecated: m.deprecated ?? null,
      intelligence_index: number(m.intelligenceIndex), intelligence_is_estimated: m.intelligenceIndexIsEstimated ?? null,
      input_usd_per_million_tokens: number(m.price1mInputTokens),
      output_usd_per_million_tokens: number(m.price1mOutputTokens),
      answer_tokens_per_second: number(m.medianCanonicalAnswerOutputSpeed),
      benchmarks: {
        terminal_bench_4_0: number(m.terminalBench40), scicode: number(m.scicode),
        long_context_reasoning: number(m.lcr), humanitys_last_exam: number(m.hle),
        critpt: number(m.critpt), automation_bench: number(m.automationBenchPartialScore),
        briefcase_elo: number(m.briefcaseElo), gdpval_elo: number(m.gdpval),
      },
    };
  });
  if (!models.some(m => m.intelligence_index !== null)) throw new Error('Intelligence scores are missing.');
  const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  return models.sort((a, b) => (b.intelligence_index ?? -Infinity) - (a.intelligence_index ?? -Infinity)
    || order(a.slug, b.slug) || order(a.id, b.id));
}

function readCache(path) {
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'));
    if (value.source !== SOURCE || !Number.isFinite(Date.parse(value.fetched_at)) || !Array.isArray(value.models) || !value.models.length) return null;
    return value;
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return null;
    throw error;
  }
}

function isFresh(cache, now = Date.now()) {
  const age = cache ? (now - Date.parse(cache.fetched_at)) / 1000 : Infinity;
  return age >= 0 && age < TTL;
}

async function updateCache(path, load = async () => {
  const manifest = manifestFromHTML((await download(SOURCE)).toString('utf8'));
  return decodeDataset(await download(new URL(manifest.path, SOURCE)), manifest.key);
}) {
  // The caller holds flock; checking again avoids duplicate refreshes from concurrent readers.
  if (isFresh(readCache(path))) return;
  const models = normalizeModels(await load());
  const cache = { source: SOURCE, fetched_at: new Date().toISOString(), models };
  const temp = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temp, JSON.stringify(cache), { flag: 'wx', mode: 0o600 });
    renameSync(temp, path);
  } finally {
    rmSync(temp, { force: true });
  }
}

const searchKey = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
function selectModels(models, queries) {
  const terms = queries.map(searchKey);
  if (terms.some(q => !q)) throw new Error('Model queries must contain letters or digits.');
  return models.filter(m => !terms.length || terms.some(q => [m.id, m.slug, m.name, m.release ?? ''].some(v => searchKey(v).includes(q))));
}

const providerAliases = new Map([
  ['codex', 'openai'], ['claude', 'anthropic'], ['claudeagent', 'anthropic'],
  ['gemini', 'google'], ['antigravity', 'google'], ['grok', 'spacexai'], ['xai', 'spacexai'],
]);
const providerKey = value => providerAliases.get(searchKey(value)) ?? searchKey(value);

function listModels(catalog, provider = null) {
  const providers = [...new Set(catalog.models.map(m => m.creator).filter(Boolean))].sort();
  const creator = provider === null ? null : providers.find(name => providerKey(name) === providerKey(provider));
  if (provider !== null && !creator) throw new Error(`Unknown provider: ${provider}. Providers: ${providers.join(', ')}.`);
  const models = creator === null ? catalog.models : catalog.models.filter(m => m.creator === creator);
  return { ...catalog, providers, provider: creator, matched_models: models.length, models };
}

async function readUsage(provider = null) {
  const unavailable = { source: 'host', scope: 'account_pool', checked_at: new Date().toISOString(),
    accounts: [], notes: ['Host usage unavailable; quota remains unknown.'] };
  if (process.env.SRULIK_MODELS_USAGE_CHILD) return unavailable;
  const windows = process.platform === 'win32';
  const result = spawnSync(windows ? 'aa-models usage' : 'aa-models', windows ? [] : ['usage'], {
    cwd: dirname(SELF),
    encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'], shell: windows,
    env: { ...process.env, SRULIK_MODELS_USAGE_CHILD: '1' },
  });
  if (result.error || result.status !== 0) return unavailable;
  try {
    const usage = JSON.parse(result.stdout);
    if (!usage || !Array.isArray(usage.accounts) || !Array.isArray(usage.notes)) return unavailable;
    if (provider !== null) {
      usage.accounts = usage.accounts.filter(account => providerKey(account.provider) === providerKey(provider));
      if (!usage.accounts.length) usage.notes.push(`Usage unavailable for ${provider}; quota remains unknown.`);
    }
    return usage;
  } catch { return unavailable; }
}

function frontier(models) {
  const price = m => (3 * m.input_usd_per_million_tokens + m.output_usd_per_million_tokens) / 4;
  const priced = models.filter(m => [m.intelligence_index, m.input_usd_per_million_tokens,
    m.output_usd_per_million_tokens].every(Number.isFinite));
  return priced.filter(m => !priced.some(other =>
    (other.intelligence_index >= m.intelligence_index && price(other) < price(m)) ||
    (other.intelligence_index > m.intelligence_index && price(other) <= price(m))));
}

function serveCache(path, refresh, queries = [], now = Date.now()) {
  let cache = readCache(path);
  if (!cache) {
    refresh(true);
    cache = readCache(path);
    if (!cache) throw new Error(`No cached data; inspect ${path}.refresh.log.`);
    now = Date.now();
  }
  const stale = !isFresh(cache, now);
  if (stale) refresh(false);
  const models = selectModels(cache.models, queries);
  return {
    source: SOURCE, fetched_at: cache.fetched_at, ttl_seconds: TTL,
    age_seconds: Math.max(0, Math.floor((now - Date.parse(cache.fetched_at)) / 1000)),
    stale, refresh_requested: stale, total_models: cache.models.length, matched_models: models.length, models,
  };
}

async function main() {
  process.umask(0o077);
  const frontierOnly = process.argv.slice(2).includes('--frontier');
  const args = process.argv.slice(2).filter(arg => arg !== '--frontier');
  if (args.includes('--help')) {
    console.log('Usage: node models.js list [--provider <name>] [--frontier]\n       node models.js usage\n       node models.js [--frontier] [model-name-or-slug ...]\nList returns all benchmark models and live usage, optionally filtered by provider. No arguments means list.\nProvider names come from the catalog; aliases include codex/OpenAI, claude/Anthropic, antigravity/Google.\nUsage comes from the host\'s aa-models usage command when available; otherwise quota remains unknown. The host\'s runnable-model catalog determines availability.\nModel facts come from Artificial Analysis, cached for 24 hours with background refresh.');
    return;
  }
  if (args[0] === 'usage') {
    if (args.length !== 1 || frontierOnly) throw new Error('Usage: node models.js usage');
    console.log(JSON.stringify(await readUsage(), null, 2));
    return;
  }
  const providedData = process.env.PLUGIN_DATA || process.env.CLAUDE_PLUGIN_DATA;
  const dataRoot = providedData || join(tmpdir(), `srulik-toolkit-${process.getuid?.() ?? userInfo().username}`);
  const path = process.env.AA_MODELS_CACHE || join(dataRoot, 'models.json');
  const updating = args[0] === '--update' && args.length === 1 && !frontierOnly;
  const listing = !args.length || args[0] === 'list';
  let provider = null;
  if (listing && args.length > 1) {
    if (args.length !== 3 || args[1] !== '--provider' || args[2].startsWith('-') || !searchKey(args[2])) {
      throw new Error('Usage: node models.js list [--provider <name>]');
    }
    provider = args[2];
  } else if (!updating && args.some(a => a.startsWith('-'))) throw new Error('Unknown option; use --help.');
  const queries = listing || updating ? [] : args;
  selectModels([], queries); // Reject invalid queries before any network request.
  if (!isAbsolute(path)) throw new Error('Model cache path must be absolute.');
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  if (!providedData && !process.env.AA_MODELS_CACHE) {
    const info = lstatSync(dataRoot);
    if (!info.isDirectory() || (process.getuid && (info.uid !== process.getuid() || (info.mode & 0o077)))) {
      throw new Error('Default model cache directory is not private to the current user; set PLUGIN_DATA to a private directory.');
    }
  }
  if (updating) {
    await updateCache(path);
    return;
  }
  const refresh = blocking => {
    const log = openSync(`${path}.refresh.log`, 'a', 0o600);
    const locking = process.platform !== 'win32' && existsSync('/usr/bin/flock');
    const executable = locking ? '/usr/bin/flock' : process.execPath;
    // shortcut: without native flock, concurrent starts may duplicate public downloads; add a portable lock if contention matters.
    const command = locking
      ? [blocking ? '-w' : '-n', ...(blocking ? ['45'] : []), `${path}.lock`, process.execPath, SELF, '--update']
      : [SELF, '--update'];
    try {
      if (blocking) {
        const result = spawnSync(executable, command, { stdio: ['ignore', 'ignore', log], timeout: 55000 });
        if (result.error || result.status !== 0) throw new Error(`Initial fetch failed; inspect ${path}.refresh.log.`);
      } else {
        const child = spawn(executable, command, { detached: true, stdio: ['ignore', 'ignore', log] });
        child.on('error', error => console.error(`Background refresh could not start: ${error.message}`));
        child.unref();
      }
    } finally { closeSync(log); }
  };
  let result = serveCache(path, refresh);
  if (listing) {
    result = listModels(result, provider);
    result.usage = await readUsage(result.provider);
  }
  if (frontierOnly) result.models = frontier(result.models);
  if (!listing) result.models = selectModels(result.models, queries);
  result.matched_models = result.models.length;
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { SOURCE, TTL, manifestFromHTML, decodeDataset, normalizeModels,
  readCache, isFresh, updateCache, selectModels, listModels, readUsage, serveCache, frontier };

if (require.main === module) {
  main().catch(error => { console.error(`models.js: ${error.message}`); process.exitCode = 1; });
}
