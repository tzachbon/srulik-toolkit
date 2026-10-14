#!/usr/bin/env node
// Run with node scripts/test-models.js; all public data and host usage are local fakes.
const assert = require('node:assert/strict');
const { createCipheriv, createHash } = require('node:crypto');
const { execFile } = require('node:child_process');
const { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, statSync, symlinkSync } = require('node:fs');
const { tmpdir, userInfo } = require('node:os');
const { delimiter, join, resolve } = require('node:path');
const { promisify } = require('node:util');
const { gzipSync } = require('node:zlib');
const models = require('../plugins/srulik-toolkit/scripts/models.js');

const runFile = promisify(execFile);
const script = resolve(__dirname, '../plugins/srulik-toolkit/scripts/models.js');
const directory = mkdtempSync(join(tmpdir(), 'srulik models-'));
const fixture = join(directory, 'fixture.json');
const requests = join(directory, 'requests.txt');
const cache = join(directory, 'data', 'models.json');
const preload = join(directory, 'preload.cjs');
const key = 'ab'.repeat(32);
const manifest = { path: '/data/abc123.txt', key };
const rawModel = (id, score, price, creator = 'OpenAI') => ({
  id, slug: id, name: id, creator: { name: creator }, intelligenceIndex: score,
  price1mInputTokens: price, price1mOutputTokens: price,
});
const raw = [
  { ...rawModel('opus-high', 60, 10, 'Anthropic'), name: 'Opus (High)',
    release: { name: 'Opus' }, releaseDate: '2026-10-01', suffix: 'high',
    deprecated: false, intelligenceIndexIsEstimated: false,
    medianCanonicalAnswerOutputSpeed: 100, terminalBench40: 0.8, scicode: 0.7,
    lcr: 0.6, hle: 0.5, critpt: 0.4, automationBenchPartialScore: 0.3,
    briefcaseElo: 1500, gdpval: 1600 },
  rawModel('cheap', 40, 0.2), rawModel('dominated', 39, 5),
  rawModel('unpriced', 50, null, 'Google'), rawModel('unscored', null, 1, 'SpaceXAI'),
];

function encrypt(plaintext) {
  const bytes = Buffer.from(key, 'hex');
  const nonce = createHash('sha256').update(bytes).digest().subarray(0, 12);
  const cipher = createCipheriv('aes-256-gcm', bytes, nonce);
  return Buffer.concat([cipher.update(gzipSync(plaintext)), cipher.final(), cipher.getAuthTag()]);
}
function html(value = manifest) {
  const flight = `1:${JSON.stringify({ slug: 'artificial-analysis-intelligence-index', initialModels: [], manifest: value })}\n`;
  return `<script>self.__next_f.push(${JSON.stringify([1, flight])})</script>`;
}
function setFixture(data = raw, options = {}) {
  writeFileSync(fixture, JSON.stringify({ html: html(), encrypted: encrypt(JSON.stringify({ models: data })).toString('base64'), ...options }));
}
function fetchCount() {
  return existsSync(requests) ? readFileSync(requests, 'utf8').trim().split('\n').length : 0;
}

// Child refreshes inherit this preload, so validation never contacts the real service or quota adapter.
writeFileSync(preload, `
const fs = require('node:fs');
const cp = require('node:child_process');
if (process.env.TEST_TMPDIR) require('node:os').tmpdir = () => process.env.TEST_TMPDIR;
const originalSpawn = cp.spawnSync;
cp.spawnSync = (command, args, options) => ['aa-models', 'aa-models usage'].includes(command) && !process.env.TEST_REAL_USAGE
  ? { status: 0, stdout: process.env.TEST_USAGE || 'invalid JSON' }
  : originalSpawn(command, args, options);
if (process.env.TEST_NO_FLOCK) {
  const originalExists = fs.existsSync;
  fs.existsSync = path => path === '/usr/bin/flock' ? false : originalExists(path);
}
if (process.env.TEST_WINDOWS) {
  Object.defineProperty(process, 'platform', { value: 'win32' });
  const originalExists = fs.existsSync;
  fs.existsSync = path => {
    if (path === '/usr/bin/flock') throw new Error('Windows must not probe POSIX flock');
    return originalExists(path);
  };
}
global.fetch = async url => {
  const requested = String(url);
  if (requested !== ${JSON.stringify(models.SOURCE)} && requested !== 'https://artificialanalysis.ai/data/abc123.txt') {
    throw new Error('Unexpected request: ' + requested);
  }
  fs.appendFileSync(process.env.TEST_REQUESTS, requested + '\\n');
  const fixture = JSON.parse(fs.readFileSync(process.env.TEST_FIXTURE, 'utf8'));
  return new Response(requested.endsWith('.txt') ? Buffer.from(fixture.encrypted, 'base64') : fixture.html,
    { status: fixture.status || 200 });
};
`);

const env = { ...process.env, PLUGIN_DATA: join(directory, 'data'), TEST_FIXTURE: fixture, TEST_REQUESTS: requests,
  NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --require ${JSON.stringify(preload)}` };
delete env.ARTIFICIAL_ANALYSIS_API_KEY;
delete env.AA_MODELS_CACHE;
delete env.SRULIK_MODELS_USAGE_CHILD;
delete env.TEST_USAGE;
delete env.TEST_REAL_USAGE;
async function cli(args = [], overrides = {}) {
  return runFile(process.execPath, [script, ...args], { cwd: overrides.TEST_CWD || directory,
    env: { ...env, ...overrides }, timeout: 15000, maxBuffer: 1024 * 1024 });
}
async function json(args = [], overrides = {}) {
  const result = await cli(args, overrides);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

async function main() {
  setFixture();
  const normalized = models.normalizeModels({ models: raw });
  assert.deepEqual(normalized[0], {
    id: 'opus-high', slug: 'opus-high', name: 'Opus (High)', creator: 'Anthropic',
    release: 'Opus', release_date: '2026-10-01', effort_variant: 'high', deprecated: false,
    intelligence_index: 60, intelligence_is_estimated: false,
    input_usd_per_million_tokens: 10, output_usd_per_million_tokens: 10, answer_tokens_per_second: 100,
    benchmarks: { terminal_bench_4_0: 0.8, scicode: 0.7, long_context_reasoning: 0.6,
      humanitys_last_exam: 0.5, critpt: 0.4, automation_bench: 0.3, briefcase_elo: 1500, gdpval_elo: 1600 },
  });
  assert.deepEqual(normalized.map(m => m.id), ['opus-high', 'unpriced', 'cheap', 'dominated', 'unscored']);
  assert.deepEqual(models.manifestFromHTML(html()), manifest);
  assert.deepEqual(models.decodeDataset(encrypt(JSON.stringify({ models: raw })), key), { models: raw });
  assert.throws(() => models.manifestFromHTML(html({ ...manifest, path: '//other.example/data/a.txt' })), /manifest/);
  assert.throws(() => models.manifestFromHTML(html({ ...manifest, key: 'bad' })), /manifest/);
  const corrupted = encrypt('{}');
  corrupted[0] ^= 1;
  assert.throws(() => models.decodeDataset(corrupted, key));
  assert.throws(() => models.decodeDataset(encrypt(Buffer.alloc(32 * 1024 * 1024 + 1)), key), /larger than/);
  assert.throws(() => models.normalizeModels({ models: [] }), /empty/);
  assert.throws(() => models.normalizeModels({ models: [raw[0], raw[0]] }), /duplicated/);
  assert.throws(() => models.normalizeModels({ models: [{ ...raw[0], id: 1 }] }), /identifiers/);
  assert.throws(() => models.normalizeModels({ models: [raw[4]] }), /scores/);
  const now = Date.now();
  assert.equal(models.isFresh({ fetched_at: new Date(now - (models.TTL - 1) * 1000).toISOString() }, now), true);
  assert.equal(models.isFresh({ fetched_at: new Date(now - models.TTL * 1000).toISOString() }, now), false);
  assert.equal(models.isFresh({ fetched_at: new Date(now + 1000).toISOString() }, now), false);

  // The previously failing keyless workflow must also work on platforms without flock.
  const first = await json(['--frontier'], { TEST_NO_FLOCK: '1' });
  assert.equal(first.stale, false);
  assert.deepEqual(first.models.map(m => m.id), ['opus-high', 'cheap']);
  assert.match(first.usage.notes.join(' '), /quota remains unknown/);
  assert.equal(fetchCount(), 2);
  if (process.platform !== 'win32') assert.equal(statSync(cache).mode & 0o777, 0o600);
  const list = await json();
  assert.deepEqual(list.models, normalized);
  assert.equal(list.total_models, 5);
  assert.deepEqual(list.providers, ['Anthropic', 'Google', 'OpenAI', 'SpaceXAI']);
  assert.equal(fetchCount(), 2, 'fresh cache must avoid public downloads');
  const usage = { source: 'fake-host', scope: 'account_pool', accounts: [
    { provider: 'codex', windows: [{ label: 'weekly', used_percent: 16, resets_at: 123 }] },
    { provider: 'claude', windows: [{ label: 'weekly', used_percent: 58, resets_at: 456 }] },
  ], notes: ['Other limits remain unknown.'] };
  const codex = await json(['list', '--provider', 'codex'], { TEST_USAGE: JSON.stringify(usage) });
  assert.equal(codex.provider, 'OpenAI');
  assert.deepEqual(codex.models.map(m => m.id), ['cheap', 'dominated']);
  assert.deepEqual(codex.usage.accounts, [usage.accounts[0]]);
  assert.deepEqual((await json(['usage'], { TEST_USAGE: JSON.stringify(usage) })), usage);
  assert.deepEqual((await json(['usage'], { SRULIK_MODELS_USAGE_CHILD: '1' })).accounts, []);
  const hostDirectory = join(directory, 'host-bin');
  const repository = join(directory, 'untrusted-repository');
  const plantedMarker = join(directory, 'planted-command-executed');
  const hostUsage = { source: 'trusted-host', accounts: [], notes: [] };
  for (const location of [hostDirectory, repository]) {
    mkdirSync(location);
    const content = (location === repository
      ? `require('node:fs').writeFileSync(${JSON.stringify(plantedMarker)}, 'executed');\n` : '')
      + `console.log(${JSON.stringify(JSON.stringify(hostUsage))});\n`;
    if (process.platform === 'win32') {
      writeFileSync(join(location, 'usage.cjs'), content);
      writeFileSync(join(location, 'aa-models.cmd'), `@"${process.execPath}" "%~dp0usage.cjs"\r\n`);
    } else {
      writeFileSync(join(location, 'aa-models'), `#!/usr/bin/env node\n${content}`, { mode: 0o700 });
    }
  }
  assert.deepEqual(await json(['usage'], { TEST_REAL_USAGE: '1', TEST_CWD: repository,
    PATH: ['.', hostDirectory, process.env.PATH].join(delimiter) }), hostUsage);
  assert.equal(existsSync(plantedMarker), false, 'usage lookup must not execute repository commands');
  for (const [alias, expected] of [['claudeAgent', 'Anthropic'], ['antigravity', 'Google'], ['xai', 'SpaceXAI']]) {
    assert.equal(models.listModels(list, alias).provider, expected);
  }
  assert.deepEqual((await json(['Opus HIGH'])).models, [normalized[0]]);
  assert.deepEqual((await json(['--frontier', 'dominated'])).models, []);
  assert.deepEqual((await json(['no-such-model'])).models, []);
  for (const args of [['list', '--provider'], ['--invalid'], ['!!!'], ['usage', 'extra']]) {
    await assert.rejects(cli(args), error => error.code === 1);
  }
  await assert.rejects(cli(['list', '--provider', 'unknown']), /Unknown provider/);
  assert.equal(fetchCount(), 2, 'invalid arguments must avoid downloads');

  // Stale readers return their snapshot, then a detached child replaces it atomically.
  const oldCache = { ...models.readCache(cache), fetched_at: '2000-01-01T00:00:00.000Z' };
  writeFileSync(cache, JSON.stringify(oldCache));
  setFixture([{ ...raw[0], intelligenceIndex: 61 }, ...raw.slice(1)]);
  const stale = await json(['--frontier']);
  assert.equal(stale.stale, true);
  assert.equal(stale.refresh_requested, true);
  assert.equal(stale.models[0].intelligence_index, 60);
  const deadline = Date.now() + 10000;
  while (!models.isFresh(models.readCache(cache)) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.equal(models.readCache(cache).models[0].intelligence_index, 61);
  assert.equal(fetchCount(), 4);

  // Failed public refreshes preserve the last usable cache byte for byte.
  const saved = JSON.stringify(oldCache);
  for (const options of [{ html: '<html>changed</html>' }, { status: 503 }, { encrypted: corrupted.toString('base64') }]) {
    writeFileSync(cache, saved);
    setFixture(raw, options);
    await assert.rejects(cli(['--update']));
    assert.equal(readFileSync(cache, 'utf8'), saved);
  }
  setFixture([raw[0], raw[0]]);
  await assert.rejects(cli(['--update']), /duplicated/);
  assert.equal(readFileSync(cache, 'utf8'), saved);
  rmSync(cache);
  setFixture(raw, { status: 503 });
  await assert.rejects(cli(['--frontier']), /Initial fetch failed/);
  assert.equal(models.readCache(cache), null);
  assert.match(readFileSync(`${cache}.refresh.log`, 'utf8'), /HTTP 503/);
  setFixture();
  writeFileSync(cache, 'not JSON');
  assert.equal(models.readCache(cache), null);
  assert.equal((await json(['--frontier'])).stale, false);
  const alternate = join(directory, 'alternate', 'models.json');
  await json(['--frontier'], { AA_MODELS_CACHE: alternate });
  assert.deepEqual(models.readCache(alternate).models, normalized);
  const defaults = { PLUGIN_DATA: '', CLAUDE_PLUGIN_DATA: '', TEST_TMPDIR: directory };
  const privateDirectory = join(directory, `srulik-toolkit-${process.getuid?.() ?? userInfo().username}`);
  await json(['--frontier'], defaults);
  assert.deepEqual(models.readCache(join(privateDirectory, 'models.json')).models, normalized);
  if (process.platform !== 'win32') {
    assert.equal(statSync(privateDirectory).mode & 0o777, 0o700);
    chmodSync(privateDirectory, 0o777);
    await assert.rejects(cli(['--frontier'], defaults), /not private to the current user/);
    chmodSync(privateDirectory, 0o700);
    rmSync(privateDirectory, { recursive: true });
    symlinkSync(join(directory, 'data'), privateDirectory, 'dir');
    await assert.rejects(cli(['--frontier'], defaults), /not private to the current user/);
  }
  const windowsResult = await json(['--frontier'], { TEST_WINDOWS: '1',
    AA_MODELS_CACHE: join(directory, 'windows-data', 'models.json') });
  assert.deepEqual(windowsResult.models, first.models);
  console.log('models.js public-data, cache, filtering and host-usage checks passed');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => rmSync(directory, { recursive: true, force: true }));
