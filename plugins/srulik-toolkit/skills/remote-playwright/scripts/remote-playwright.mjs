#!/usr/bin/env node
// Run a repository's own Playwright tests on this machine against Chromium on a Windows PC.
// remote-playwright <start|run|stop|status|check> [options] [-- playwright args]. Node stdlib only.
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { psProbe, psStart, psStop, parseResult } from './windows.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const EXIT = { ineligible: 3, version: 4, unreachable: 5, refused: 6, cleanup: 7, conflict: 8, leak: 9, depot: 10, setup: 11 };
class Fail extends Error { constructor(code, message) { super(message); this.code = code; } }

export function parseArgs(argv) {
  const opts = { arg: [] }, rest = [];
  const dash = argv.indexOf('--');
  const own = dash < 0 ? argv : argv.slice(0, dash);
  if (dash >= 0) rest.push(...argv.slice(dash + 1));
  const command = own[0];
  for (let i = 1; i < own.length; i++) {
    let key = own[i];
    if (!key.startsWith('--')) throw new Fail(EXIT.refused, `Unexpected argument ${key}; put Playwright arguments after --`);
    key = key.slice(2);
    let value;
    if (key.includes('=')) [key, value] = [key.slice(0, key.indexOf('=')), key.slice(key.indexOf('=') + 1)];
    else if (['capture', 'force', 'local'].includes(key)) value = true;
    else value = own[++i];
    if (value === undefined) throw new Fail(EXIT.refused, `--${key} needs a value`);
    if (key === 'arg') opts.arg.push(value); else opts[key] = value;
  }
  return { command, opts, rest };
}

// One physical engine is (adapter LUID, physical GPU, engine index): sum processes per engine and sample,
// average the samples, then take the busiest engine.
export function gpuMax(samples) {
  const perEngineSample = new Map();
  for (const { i, v, t } of samples) {
    const m = /luid_(0x[0-9a-f]+_0x[0-9a-f]+)_phys_(\d+)_eng_(\d+)/i.exec(i);
    if (!m || !Number.isFinite(v)) continue;
    const key = `${m[1]}/${m[2]}/${m[3]}`;
    const bySample = perEngineSample.get(key) ?? new Map();
    bySample.set(t, (bySample.get(t) ?? 0) + v);
    perEngineSample.set(key, bySample);
  }
  let max = 0;
  for (const bySample of perEngineSample.values()) {
    const values = [...bySample.values()];
    max = Math.max(max, values.reduce((a, b) => a + b, 0) / values.length);
  }
  return max;
}

export function eligibility(probe) {
  // Any malformed value makes that telemetry unavailable (not eligible), never an exception or an idle reading.
  const cpu = Array.isArray(probe?.cpu) && probe.cpu.length && probe.cpu.every(Number.isFinite) ? probe.cpu : [];
  const cpuPct = cpu.length ? cpu.reduce((a, b) => a + b, 0) / cpu.length : NaN;
  const gpu = Array.isArray(probe?.gpu) ? probe.gpu : [];
  // gpuSamples counts every counter read, idle ones included; each reported busy sample must be well formed.
  const gpuValid = Array.isArray(probe?.gpu) && gpu.every(s => typeof s?.i === 'string' && /luid_0x[0-9a-f]+_0x[0-9a-f]+_phys_\d+_eng_\d+/i.test(s.i) && Number.isFinite(s.v) && s.v >= 0);
  const gpuSamples = gpuValid && Number.isInteger(probe?.gpuSamples) && probe.gpuSamples >= gpu.length ? probe.gpuSamples : 0;
  const gpuMaxPct = gpuSamples ? gpuMax(gpu) : NaN;
  const freeMB = Number(probe?.freeMB);
  const reasons = [];
  if (!Number.isFinite(cpuPct)) reasons.push('CPU telemetry unavailable');
  else if (cpuPct > 60) reasons.push(`CPU ${cpuPct.toFixed(1)}% > 60%`);
  if (!(gpuSamples > 0)) reasons.push('GPU telemetry unavailable');
  else if (gpuMaxPct > 60) reasons.push(`GPU engine ${gpuMaxPct.toFixed(1)}% > 60%`);
  if (!Number.isFinite(freeMB)) reasons.push('memory telemetry unavailable');
  else if (freeMB < 4096) reasons.push(`${freeMB} MB free < 4096 MB`);
  return { ok: reasons.length === 0, cpuPct, gpuMaxPct, freeMB, reasons };
}

// Replace every secret, including one split across chunk boundaries.
export function redactor(secrets, write) {
  const list = secrets.filter(Boolean);
  const keep = Math.max(0, ...list.map(s => s.length - 1));
  let tail = '';
  const scrub = text => list.reduce((t, s) => t.replaceAll(s, '[redacted]'), text);
  return {
    push(chunk) { const text = scrub(tail + chunk); tail = text.slice(Math.max(0, text.length - keep)); write(text.slice(0, text.length - tail.length)); },
    end() { write(scrub(tail)); tail = ''; },
  };
}

// Redact secrets in text files written during the run, wherever the config put them. Walks the given roots,
// skipping dependency and VCS folders, and rewrites only files modified since `since` (ms). Returns the files changed.
export function scanReports(roots, secrets, since = 0) {
  const changed = [];
  const list = secrets.filter(Boolean);
  const walk = dir => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!['node_modules', '.git'].includes(e.name)) walk(p); continue; }
      if (!e.isFile() || !/\.(txt|md|json|html?|log|xml|ya?ml|csv)$/i.test(e.name)) continue;
      const st = fs.statSync(p);
      if (st.mtimeMs < since || st.size > 64 * 1024 * 1024) continue;
      const text = fs.readFileSync(p, 'utf8');
      const clean = list.reduce((t, s) => t.replaceAll(s, '[redacted]'), text);
      if (clean !== text) { fs.writeFileSync(p, clean); changed.push(p); }
    }
  };
  roots.forEach(walk);
  return changed;
}

export function refuseArgs(env, args) {
  const inherited = Object.keys(env).filter(k => k.startsWith('PW_TEST_CONNECT_'));
  if (inherited.length) throw new Fail(EXIT.refused, `Unset ${inherited.join(', ')} first: it would override the selected browser`);
  if (args.some(a => /^(-j.*|--workers(=.*)?)$/.test(a))) throw new Fail(EXIT.refused, 'Remote runs use exactly one worker; remove -j/--workers');
}

export const shQuote = s => `'${String(s).replaceAll("'", `'\\''`)}'`;

export function captureConfig(configPath) {
  const name = './' + path.basename(configPath);
  return `import base from ${JSON.stringify(name)};
const cap = u => ({ ...u, screenshot: 'on', trace: 'on' });
export default { ...base, use: cap(base.use), ...(base.projects ? { projects: base.projects.map(p => ({ ...p, use: cap(p.use) })) } : {}) };
`;
}

export function findConfig(cwd, args) {
  const i = args.findIndex(a => a === '-c' || a === '--config' || a.startsWith('--config='));
  if (i >= 0) {
    const value = args[i].startsWith('--config=') ? args[i].slice(9) : args[i + 1];
    return { path: path.resolve(cwd, value), args: args.filter((_, j) => j !== i && (args[i].startsWith('--config=') || j !== i + 1)) };
  }
  for (const n of ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mts', 'playwright.config.mjs', 'playwright.config.cts', 'playwright.config.cjs']) {
    if (fs.existsSync(path.join(cwd, n))) return { path: path.join(cwd, n), args };
  }
  throw new Fail(EXIT.refused, 'No Playwright config found; pass --config after --');
}

export function depotCommand(args) {
  const pw = ['npx', 'playwright', 'test', '--workers=1', ...args, '--output=.rp/out'].map(shQuote).join(' ');
  return 'mkdir -p .rp; (npm ci && npx playwright install --with-deps chromium) > .rp/setup.log 2>&1; s=$?; '
    + `if [ $s -eq 0 ]; then ${pw}; s=$?; else s=100; fi; echo $s > .rp/status; `
    + 'tar -czf .rp/artifacts.tgz .rp/status .rp/setup.log $( [ -d .rp/out ] && echo .rp/out ) $( [ -d playwright-report ] && echo playwright-report ) || exit 101; exit 0';
}

function repoPlaywright(cwd) {
  const req = createRequire(path.join(cwd, 'noop.js'));
  try { return { version: req('playwright-core/package.json').version, core: req('playwright-core') }; }
  catch { throw new Fail(EXIT.version, 'This repository has no installed playwright-core; install its dependencies first'); }
}

function stateDir(opts) {
  const dir = opts.state ?? path.join(process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state'), 'remote-playwright');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
  return dir;
}

function readState(dir) {
  const file = path.join(dir, 'endpoint.json');
  if (!fs.existsSync(file)) return null;
  if ((fs.statSync(file).mode & 0o077) !== 0) throw new Fail(EXIT.refused, `${file} must be private (mode 0600)`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeState(dir, state) {
  const file = path.join(dir, 'endpoint.json');
  fs.writeFileSync(file + '.tmp', JSON.stringify(state), { mode: 0o600 });
  fs.renameSync(file + '.tmp', file);
}

function lock(dir) {
  const file = path.join(dir, 'run.lock');
  try {
    const fd = fs.openSync(file, 'wx', 0o600); fs.writeSync(fd, String(process.pid)); fs.closeSync(fd);
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const pid = Number(fs.readFileSync(file, 'utf8'));
    try { process.kill(pid, 0); throw new Fail(EXIT.conflict, `Another run (pid ${pid}) is using this browser server`); }
    catch (err) { if (err instanceof Fail) throw err; fs.rmSync(file); return lock(dir); }
  }
  return () => fs.rmSync(file, { force: true });
}

function locked(dir) {
  const file = path.join(dir, 'run.lock');
  if (!fs.existsSync(file)) return false;
  try { process.kill(Number(fs.readFileSync(file, 'utf8')), 0); return true; } catch { return false; }
}

// Runs a user-supplied command line through the platform shell.
const shell = (line, options) => process.platform === 'win32'
  ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `"${line}"`], { windowsVerbatimArguments: true, ...options })
  : spawnSync('/bin/sh', ['-c', line], options);

// The adapter runs PowerShell on the Windows PC: script on stdin, its stdout on ours.
function windowsExec(adapter, script) {
  if (!adapter) throw new Fail(EXIT.unreachable, 'No --windows-exec adapter: run the printed PowerShell on the PC yourself');
  const r = shell(adapter, { input: script, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Fail(EXIT.unreachable, `Windows adapter failed (exit ${r.status}): ${(r.stderr || '').trim().slice(0, 300)}`);
  // 7: a malformed reply is an unreachable PC, so run can still fall back.
  try { return parseResult(r.stdout); } catch (e) { throw new Fail(EXIT.unreachable, `Windows adapter reply unreadable: ${e.message}`); }
}

async function probeLoopback(core, state) {
  if (process.env.REMOTE_PLAYWRIGHT_TEST_CMD) return; // self-test: no real browser
  const http = await import('node:http');
  const server = http.createServer((_q, s) => s.end('rp-ok'));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    const browser = await core.chromium.connect(`ws://${state.ip}:${state.port}/`, { headers: { 'x-rp-token': state.token }, exposeNetwork: '<loopback>', timeout: 20_000 });
    try {
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}/`, { timeout: 20_000 });
      if ((await page.textContent('body'))?.trim() !== 'rp-ok') throw Error('unexpected page content');
    } finally { await browser.close(); }
  } catch (e) {
    throw new Fail(EXIT.unreachable, `Remote browser probe failed: ${String(e.message).replaceAll(state.token, '[redacted]').split('\n')[0]}`);
  } finally { server.close(); }
}

function checkEligible(opts) {
  const e = eligibility(windowsExec(opts['windows-exec'], psProbe()));
  if (!e.ok) throw new Fail(EXIT.ineligible, `Windows PC not eligible: ${e.reasons.join('; ')}`);
  return e;
}

async function start(opts, cwd) {
  const dir = stateDir(opts);
  const version = opts.version ?? repoPlaywright(cwd).version;
  const port = Number(opts.port ?? 39173);
  if (locked(dir)) throw new Fail(EXIT.conflict, 'A run is in progress');
  const e = checkEligible(opts);
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const proxySource = fs.readFileSync(path.join(here, 'proxy.cjs'), 'utf8');
  const r = windowsExec(opts['windows-exec'], psStart({ version, port, args: opts.arg, tokenHash, proxySource }));
  if (r.error) throw new Fail(r.error === 'conflict' ? EXIT.conflict : r.error === 'stage' ? EXIT.version : EXIT.unreachable, `Windows start failed: ${r.detail}`);
  const state = { ip: r.ip, port: r.port, version: r.version, token, args: opts.arg, startedAt: new Date().toISOString() };
  writeState(dir, state);
  try { await probeLoopback(repoPlaywright(cwd).core, state); }
  catch (err) { await stop({ ...opts, force: true }); throw err; }
  console.log(`Started Playwright ${version} on ${r.ip}:${r.port} (CPU ${e.cpuPct.toFixed(0)}%, GPU ${e.gpuMaxPct.toFixed(0)}%, ${e.freeMB} MB free). Loopback probe passed.`);
}

async function stop(opts) {
  const dir = stateDir(opts);
  if (locked(dir) && !opts.force) throw new Fail(EXIT.cleanup, 'A run is in progress; wait for it or pass --force');
  const r = windowsExec(opts['windows-exec'], psStop({ port: Number(opts.port ?? readState(dir)?.port ?? 39173) }));
  fs.rmSync(path.join(dir, 'endpoint.json'), { force: true });
  if (!r.ok) throw new Fail(EXIT.cleanup, `Not fully cleaned up: ${r.left.join('; ')}`);
  console.log('Stopped: browser server, its Serve route and its token removed.');
}

function runPlaywright(cwd, args, env, secrets) {
  return new Promise((resolve, reject) => {
    // REMOTE_PLAYWRIGHT_TEST_CMD (JSON argv) lets the self-test stand in for Playwright.
    const cmd = process.env.REMOTE_PLAYWRIGHT_TEST_CMD ? JSON.parse(process.env.REMOTE_PLAYWRIGHT_TEST_CMD)
      : process.platform === 'win32' ? ['npx.cmd', 'playwright', 'test'] : ['nice', '-n', '10', 'npx', 'playwright', 'test'];
    const child = spawn(cmd[0], [...cmd.slice(1), '--workers=1', ...args], { cwd, env, stdio: ['inherit', 'pipe', 'pipe'] });
    const out = redactor(secrets, t => process.stdout.write(t)), err = redactor(secrets, t => process.stderr.write(t));
    child.stdout.on('data', d => out.push(String(d)));
    child.stderr.on('data', d => err.push(String(d)));
    child.on('error', reject);
    child.on('close', code => { out.end(); err.end(); resolve(code ?? 1); });
  });
}

// Whole-job fallback to a short-lived Depot workspace this invocation owns.
async function depot(opts, cwd, args) {
  // argv, not a shell line: no local quoting, so paths and test filters pass through unchanged on any OS.
  const bin = opts['depot-bin'] ? JSON.parse(opts['depot-bin'])
    : process.getuid?.() === 0 ? ['depot-workspace'] : ['sudo', '-n', '/usr/local/libexec/depot-workspace-user'];
  const owner = `rp-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${randomBytes(3).toString('hex')}`;
  const call = (...a) => {
    const r = spawnSync(bin[0], [...bin.slice(1), ...a], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] });
    return { status: r.status, out: r.stdout ?? '' };
  };
  console.error(`Falling back to Depot workspace ${owner} (${opts['depot-minutes'] ?? 30}-minute lease).`);
  const up = call('up', '--owner', owner, '--repo', cwd, '--minutes', String(opts['depot-minutes'] ?? 30));
  if (up.status !== 0) throw new Fail(EXIT.depot, 'Depot up failed');
  let parsed; try { parsed = JSON.parse(up.out); } catch { parsed = {}; }
  if (parsed.reused) throw new Fail(EXIT.depot, `Depot reused an existing workspace for ${owner}; left untouched`);
  try {
    const run = call('run', '--owner', owner, '--seconds', String(opts['depot-seconds'] ?? 1500), '--command', depotCommand(args));
    if (run.status !== 0) throw new Fail(EXIT.depot, 'Depot run failed (remote command or archive)');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const local = path.join(cwd, 'test-results', `depot-${stamp}.tgz`);
    fs.mkdirSync(path.dirname(local), { recursive: true });
    const exp = call('export', '--owner', owner, '--remote', '.rp/artifacts.tgz', '--out', local);
    if (exp.status !== 0) throw new Fail(EXIT.depot, 'Depot export failed');
    let file = local;
    try { const j = JSON.parse(exp.out); if (j.path) file = j.path; } catch { /* root export writes --out */ }
    const dest = path.join(cwd, 'test-results', `depot-${stamp}`);
    fs.mkdirSync(dest, { recursive: true });
    if (spawnSync('tar', ['-xzf', file, '-C', dest, '--no-same-owner']).status !== 0) throw new Fail(EXIT.depot, 'Could not extract Depot artifacts');
    const status = Number(fs.readFileSync(path.join(dest, '.rp', 'status'), 'utf8'));
    console.error(`Depot artifacts: ${dest}`);
    if (status === 100) throw new Fail(EXIT.setup, `Depot setup failed; see ${path.join(dest, '.rp', 'setup.log')}`);
    return status;
  } finally {
    call('stop', '--owner', owner);
  }
}

async function run(opts, cwd, args) {
  refuseArgs(process.env, args);
  const dir = stateDir(opts);
  const release = lock(dir);
  const capture = opts.capture ? findConfig(cwd, args) : null;
  const wrapper = capture ? path.join(path.dirname(capture.path), `.rp-capture-${process.pid}.config.mjs`) : null;
  const testArgs = capture ? ['--config', wrapper, ...capture.args] : args;
  let state = null;
  try {
    if (wrapper) fs.writeFileSync(wrapper, captureConfig(capture.path));
    if (opts.local) return await runPlaywright(cwd, testArgs, process.env, []);
    try {
      checkEligible(opts);
      state = readState(dir);
      if (!state) throw new Fail(EXIT.unreachable, 'No browser server started; run start first');
      const { version, core } = process.env.REMOTE_PLAYWRIGHT_TEST_CMD ? { version: state.version, core: null } : repoPlaywright(cwd);
      if (state.version !== version) throw new Fail(EXIT.version, `Windows server runs Playwright ${state.version}, this repository ${version}; restart with --version ${version}`);
      await probeLoopback(core, state);
    } catch (e) {
      if (!(e instanceof Fail) || (opts.fallback ?? 'depot') === 'none') throw e;
      console.error(e.message);
      return await depot(opts, cwd, testArgs.map(a => (a === wrapper ? path.relative(cwd, wrapper).split(path.sep).join('/') : a)));
    }
    // From here on the tests have started: no fallback and no retry.
    const env = { ...process.env, PW_TEST_CONNECT_WS_ENDPOINT: `ws://${state.ip}:${state.port}/`, PW_TEST_CONNECT_HEADERS: JSON.stringify({ 'x-rp-token': state.token }), PW_TEST_CONNECT_EXPOSE_NETWORK: '<loopback>' };
    const startedAt = Date.now() - 2000;
    const code = await runPlaywright(cwd, testArgs, env, [state.token]);
    // Reports can land anywhere the config says; scan everything written under the repository and any --output.
    const extra = testArgs.flatMap((a, i) => a.startsWith('--output=') ? [a.slice(9)] : a === '--output' && testArgs[i + 1] ? [testArgs[i + 1]] : []);
    const leaked = scanReports([cwd, ...extra.map(d => path.resolve(cwd, d))], [state.token], startedAt);
    if (leaked.length) { console.error(`Redacted the access token from ${leaked.length} report file(s); run stop to rotate it.`); return EXIT.leak; }
    return code;
  } finally {
    if (wrapper) fs.rmSync(wrapper, { force: true });
    release();
  }
}

function status(opts) {
  const s = readState(stateDir(opts));
  console.log(s ? `Started: Playwright ${s.version} on ${s.ip}:${s.port} since ${s.startedAt}${s.args?.length ? ` with ${s.args.join(' ')}` : ''}.` : 'Not started.');
}

async function main() {
  const { command, opts, rest } = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  if (command === 'start') return start(opts, cwd);
  if (command === 'stop') return stop(opts);
  if (command === 'status') return status(opts);
  if (command === 'run') { process.exitCode = await run(opts, cwd, rest); return; }
  // Playwright's connect can leave a closed socket handle behind; exit once the self-test settles.
  if (command === 'check') { const { check } = await import('./check.mjs'); process.exit(await check()); }
  console.log(`remote-playwright <start|run|stop|status|check>
  start  --windows-exec CMD [--port 39173] [--version X] [--arg FLAG ...]
  run    --windows-exec CMD [--fallback depot|none] [--capture] [--local] [--depot-minutes 30] -- <playwright test args>
  stop   --windows-exec CMD [--force]
  status
  check  offline self-test`);
}

export { run, depot, stop, start, Fail };
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e.message); process.exit(e instanceof Fail ? e.code : 1); });
}
