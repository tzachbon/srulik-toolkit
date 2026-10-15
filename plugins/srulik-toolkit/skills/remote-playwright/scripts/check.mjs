// Offline self-test for remote-playwright: node remote-playwright.mjs check. Fakes only; no network, no PC, no Depot.
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { eligibility, gpuMax, redactor, scanReports, refuseArgs, parseArgs, captureConfig, depotCommand, packageManager, run, EXIT, Fail } from './remote-playwright.mjs';
import { psStart, psStop, psProbe, parseResult } from './windows.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const proxy = require('./proxy.cjs');

const g = (i, v, t = 1) => ({ i: `pid_${i[0]}_luid_0x00000000_0x0000abcd_phys_0_eng_${i[1]}_engtype_3d`, v, t });
const probe = (o = {}) => ({ cpu: [20, 30], gpu: [], gpuSamples: 100, freeMB: 8000, ...o });

async function cases() {
  // Eligibility boundaries.
  assert.equal(eligibility(probe({ cpu: [60] })).ok, true);
  assert.equal(eligibility(probe({ cpu: [60.1] })).ok, false);
  assert.equal(eligibility(probe({ freeMB: 4096 })).ok, true);
  assert.equal(eligibility(probe({ freeMB: 4095 })).ok, false);
  assert.equal(eligibility(probe({ gpuSamples: 0 })).ok, false);
  assert.equal(eligibility(probe({ cpu: ['x'] })).ok, false);
  assert.equal(eligibility({}).ok, false);
  assert.equal(eligibility(probe({ gpu: [g([1, 0], 60)] })).ok, true);
  assert.equal(eligibility(probe({ gpu: [g([1, 0], 60.1)] })).ok, false);
  // Malformed GPU telemetry is unavailable telemetry, not an idle GPU.
  assert.equal(eligibility(probe({ gpu: [{ i: 'garbage', v: 99, t: 1 }] })).ok, false);
  assert.equal(eligibility(probe({ gpu: [g([1, 0], NaN)] })).ok, false);
  assert.equal(eligibility(probe({ gpuSamples: 1, gpu: [g([1, 0], 5), g([2, 0], 5)] })).ok, false);
  assert.equal(eligibility(probe({ gpuSamples: 2.5 })).ok, false);
  assert.equal(eligibility(probe({ gpu: [null] })).ok, false);
  assert.equal(eligibility(probe({ cpu: [20, NaN] })).ok, false);
  assert.equal(eligibility(probe({ cpu: [20, null] })).ok, false);
  for (const gpu of [null, undefined, {}, 'invalid']) assert.equal(eligibility(probe({ gpu })).ok, false, String(gpu));
  // One physical engine sums its processes; separate engines do not add up.
  assert.equal(gpuMax([g([1, 0], 40), g([1, 1], 40)]), 40);
  assert.equal(gpuMax([g([1, 0], 30), g([2, 0], 35)]), 65);
  assert.equal(gpuMax([g([1, 0], 50, 1), g([1, 0], 10, 2)]), 30);

  // Inherited connection overrides and extra workers are refused.
  for (const k of ['PW_TEST_CONNECT_WS_ENDPOINT', 'PW_TEST_CONNECT_HEADERS', 'PW_TEST_CONNECT_EXPOSE_NETWORK'])
    assert.throws(() => refuseArgs({ [k]: 'x' }, []), e => e.code === EXIT.refused);
  for (const a of [['--workers', '2'], ['-j2'], ['--workers=3'], ['-j', '4'], ['-j100%'], ['--workers=50%']])
    assert.throws(() => refuseArgs({}, a), e => e.code === EXIT.refused);
  refuseArgs({}, ['boot.spec.js', '--grep', 'workers']);
  assert.deepEqual(parseArgs(['start', '--arg=--use-gl=angle', '--arg', '--x', '--port', '1', '--', '-g', 'a']).opts.arg, ['--use-gl=angle', '--x']);
  assert.deepEqual(parseArgs(['run', '--capture', '--', 'a']).rest, ['a']);

  // Redaction across chunk boundaries and in reports.
  const token = 'a'.repeat(32) + 'b'.repeat(32);
  let out = '';
  const r = redactor([token], t => { out += t; });
  r.push('x ' + token.slice(0, 20)); r.push(token.slice(20) + ' y'); r.end();
  assert.equal(out, 'x [redacted] y');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-check-'));
  fs.mkdirSync(path.join(tmp, 'out', 'deep'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'out', 'deep', 'error-context.md'), `connect ${token}`);
  fs.writeFileSync(path.join(tmp, 'out', 'clean.txt'), 'nothing');
  assert.equal(scanReports([path.join(tmp, 'out')], [token]).length, 1);
  // Only files written since the run started are rewritten; dependency folders are skipped.
  const old = path.join(tmp, 'out', 'old.md');
  fs.writeFileSync(old, `old ${token}`); fs.utimesSync(old, new Date(0), new Date(0));
  fs.mkdirSync(path.join(tmp, 'out', 'node_modules'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'out', 'node_modules', 'x.json'), `"${token}"`);
  fs.writeFileSync(path.join(tmp, 'out', 'cfg-dir.yml'), `t: ${token}`);
  assert.deepEqual(scanReports([path.join(tmp, 'out')], [token], Date.now() - 60_000).map(f => path.basename(f)), ['cfg-dir.yml']);
  assert.ok(!fs.readFileSync(path.join(tmp, 'out', 'deep', 'error-context.md'), 'utf8').includes(token));

  // The capture wrapper forces screenshots and traces at the top level and in every project.
  fs.writeFileSync(path.join(tmp, 'playwright.config.mjs'), "export default { use: { trace: 'retain-on-failure' }, projects: [{ name: 'a', use: { trace: 'off', screenshot: 'off' } }, { name: 'b' }] };\n");
  fs.writeFileSync(path.join(tmp, 'wrap.mjs'), captureConfig(path.join(tmp, 'playwright.config.mjs')));
  const wrapped = (await import(pathToFileURL(path.join(tmp, 'wrap.mjs')).href)).default;
  assert.equal(wrapped.use.trace, 'on');
  assert.deepEqual(wrapped.projects.map(p => [p.use.trace, p.use.screenshot]), [['on', 'on'], ['on', 'on']]);

  // PowerShell builders: stop removes only what start recorded; probe and start keep their contracts.
  const stop = psStop({ port: 39173 });
  assert.match(stop, /if\(\$o\.serveAdded\)\{ & \$ts serve --tcp=\$\(\$o\.port\) off/);
  assert.match(stop, /CreationDate[\s\S]*taskkill\.exe \/PID \$o\.pid \/T \/F/);
  assert.doesNotMatch(stop, /Stop-Process -Name|taskkill(\.exe)? \/IM/i);
  const start = psStart({ version: '1.2.3', port: 39173, args: ["--a='b'"], tokenHash: 'f'.repeat(64), proxySource: 'x' });
  assert.match(start, /serve --bg --tcp=\$port/);
  assert.match(start, /if\(\$created\.serve\)/);
  assert.doesNotMatch(start, /ffff[0-9a-f]{0,60}"x-rp-token"/);
  assert.match(psProbe(), /GPU Engine\(\*\)/);
  assert.deepEqual(parseResult('noise\nRP_JSON={"ok":true}\n'), { ok: true });

  await proxyCases(token);
  await fallbackCases(tmp);
  fs.rmSync(tmp, { recursive: true, force: true });
}

// The proxy refuses unauthenticated requests and rewrites authenticated upgrades for the inner server.
async function proxyCases(token) {
  let seen = '';
  const inner = net.createServer(s => s.once('data', d => { seen = String(d); s.end('HTTP/1.1 101 Switching Protocols\r\n\r\n'); }));
  await new Promise(r => inner.listen(0, '127.0.0.1', r));
  const front = await proxy.serve({ port: 0, innerPort: inner.address().port, args: ['--use-gl=angle'], wantHash: proxy.sha256(token) });
  const port = front.address().port;
  const raw = req => new Promise(resolve => {
    const s = net.connect(port, '127.0.0.1', () => s.write(req));
    let got = ''; s.on('data', d => { got += d; s.end(); }); s.on('close', () => resolve(got)); s.on('error', () => resolve(got));
  });
  const up = (extra, url = '/') => `GET ${url} HTTP/1.1\r\nHost: 192.0.2.10:${port}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n${extra}\r\n`;
  assert.match(await raw(`GET /json HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n`), /^HTTP\/1\.1 401/);
  assert.match(await raw(up('')), /^HTTP\/1\.1 401/);
  assert.match(await raw(up('x-rp-token: wrong\r\n')), /^HTTP\/1\.1 401/);
  const ok = await raw(up(`x-rp-token: ${token}\r\nx-playwright-launch-options: {"executablePath":"/evil"}\r\nx-playwright-proxy: <loopback>\r\nOrigin: http://evil\r\n`, '/?launch-options=%7B%7D'));
  assert.match(ok, /^HTTP\/1\.1 101/);
  assert.match(seen, /^GET \/ HTTP\/1\.1\r\n/);
  assert.match(seen, new RegExp(`\\r\\nhost: 127\\.0\\.0\\.1:${inner.address().port}\\r\\n`));
  assert.match(seen, /x-playwright-launch-options: \{"headless":true,"args":\["--use-gl=angle"\]\}/);
  assert.match(seen, /x-playwright-browser: chromium/);
  assert.match(seen, /x-playwright-proxy: <loopback>/);
  assert.match(seen, /sec-websocket-key: dGhlIHNhbXBsZSBub25jZQ==/);
  assert.doesNotMatch(seen, /x-rp-token|evil|launch-options=/i);
  front.close(); inner.close();
}

// Every pre-test failure moves the whole job to a Depot workspace this run owns; fake adapter and fake Depot.
async function fallbackCases(tmp) {
  const repo = path.join(tmp, 'repo');
  fs.mkdirSync(repo);
  const log = path.join(tmp, 'depot.log');
  // Fake depot-workspace in Node (portable): logs "<cmd> <owner>", saves the run command, exports a real archive.
  const fakeScript = path.join(tmp, 'fake-depot.cjs');
  fs.writeFileSync(fakeScript, `const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const [cmd, ...rest] = process.argv.slice(2);
const opt = k => rest[rest.indexOf(k) + 1];
fs.appendFileSync(process.env.FAKE_LOG, cmd + ' ' + opt('--owner') + '\\n');
const env = process.env;
if (cmd === 'up') console.log(env.FAKE_REUSED ? '{"reused":true}' : '{}');
if (cmd === 'run') { fs.writeFileSync(process.env.FAKE_CMD, opt('--command')); process.exit(Number(env.FAKE_RUN || 0)); }
if (cmd === 'export') {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-depot-'));
  fs.mkdirSync(path.join(d, '.rp')); fs.writeFileSync(path.join(d, '.rp', 'status'), String(env.FAKE_STATUS || 0)); fs.writeFileSync(path.join(d, '.rp', 'setup.log'), 'setup');
  const t = spawnSync('tar', ['-czf', 'a.tgz', '.rp'], { cwd: d }).status;
  if (t === 0) fs.copyFileSync(path.join(d, 'a.tgz'), opt('--out'));
  process.exit(t);
}
`);
  const fakeDepot = JSON.stringify([process.execPath, fakeScript]);
  process.env.FAKE_LOG = log;
  process.env.FAKE_CMD = path.join(tmp, 'depot-cmd');
  // A tiny Node adapter keeps this test portable: no shell script, works with the platform shell on any OS.
  const adapter = json => {
    const f = path.join(tmp, `adapter-${Math.random().toString(36).slice(2)}.cjs`);
    const reply = json === null ? 'process.exit(1);' : json === 'garbage' ? "console.log('no result here');" : `console.log(${JSON.stringify('RP_JSON=' + JSON.stringify(json))});`;
    fs.writeFileSync(f, `process.stdin.resume(); process.stdin.on('end', () => { ${reply} });\n`);
    return `"${process.execPath}" "${f}"`;
  };
  const good = probe();
  const attempt = async (adapterJson, env = {}, opts = {}) => {
    fs.rmSync(log, { force: true });
    Object.assign(process.env, env);
    const state = fs.mkdtempSync(path.join(tmp, 'state-'));
    try {
      const code = await run({ 'windows-exec': adapter(adapterJson), state, 'depot-bin': fakeDepot, arg: [], ...opts }, repo, ['boot.spec.js']);
      return { code, calls: fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : [] };
    } catch (e) { return { code: e.code, error: e.message, calls: fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : [] }; }
    finally { for (const k of Object.keys(env)) delete process.env[k]; }
  };
  const quiet = console.error; console.error = () => {};
  try {
    for (const [name, json] of [['adapter failure', null], ['missing telemetry', { cpu: [] }], ['ineligible', probe({ cpu: [90] })], ['no server started', good], ['malformed reply', 'garbage']]) {
      const r = await attempt(json, { FAKE_STATUS: '0' });
      assert.equal(r.code, 0, `${name}: ${r.error ?? ''}`);
      assert.deepEqual(r.calls.map(c => c.split(' ')[0]), ['up', 'run', 'export', 'stop'], name);
      assert.match(r.calls[0], /^up rp-\d{14}-[0-9a-f]{6}$/, name);
    }
    assert.equal((await attempt(null, { FAKE_STATUS: '1' })).code, 1, 'test failure status is preserved');
    const setup = await attempt(null, { FAKE_STATUS: '100' });
    assert.equal(setup.code, EXIT.setup); assert.ok(setup.calls.includes(`stop ${setup.calls[0].split(' ')[1]}`));
    const archive = await attempt(null, { FAKE_RUN: '1' });
    assert.equal(archive.code, EXIT.depot); assert.equal(archive.calls.at(-1).split(' ')[0], 'stop');
    const reused = await attempt(null, { FAKE_REUSED: '1' });
    assert.equal(reused.code, EXIT.depot); assert.deepEqual(reused.calls.map(c => c.split(' ')[0]), ['up']);
    const none = await attempt(probe({ cpu: [90] }), {}, { fallback: 'none' });
    assert.equal(none.code, EXIT.ineligible); assert.deepEqual(none.calls, []);
    // End to end through run(): a fake Playwright writes the token into a TypeScript config's own outputDir and
    // prints it; run() must redact the output stream and the file, and report the leak.
    {
      const state = fs.mkdtempSync(path.join(tmp, 'state-'));
      const tok = 'e'.repeat(64);
      fs.writeFileSync(path.join(state, 'endpoint.json'), JSON.stringify({ ip: '127.0.0.1', port: 1, version: '0.0.0', token: tok }), { mode: 0o600 });
      fs.writeFileSync(path.join(repo, 'playwright.config.ts'), "export default { outputDir: 'artifacts' };\n");
      const fakePw = path.join(tmp, 'fake-pw.cjs');
      fs.writeFileSync(fakePw, `const fs=require('fs'),path=require('path');const t=JSON.parse(process.env.PW_TEST_CONNECT_HEADERS)['x-rp-token'];
fs.mkdirSync('artifacts/deep',{recursive:true});fs.writeFileSync('artifacts/deep/error-context.md','ws '+t);console.log('connect '+t);`);
      let printed = '';
      const write = process.stdout.write.bind(process.stdout);
      process.stdout.write = c => { printed += c; return true; };
      process.env.REMOTE_PLAYWRIGHT_TEST_CMD = JSON.stringify([process.execPath, fakePw]);
      let code;
      try { code = await run({ 'windows-exec': adapter(good), state, arg: [], fallback: 'none' }, repo, []); }
      finally { process.stdout.write = write; delete process.env.REMOTE_PLAYWRIGHT_TEST_CMD; }
      assert.equal(code, EXIT.leak);
      assert.ok(!printed.includes(tok) && printed.includes('[redacted]'));
      assert.ok(!fs.readFileSync(path.join(repo, 'artifacts', 'deep', 'error-context.md'), 'utf8').includes(tok));
      fs.rmSync(path.join(repo, 'playwright.config.ts')); fs.rmSync(path.join(repo, 'artifacts'), { recursive: true });
    }
    // A capture run leaves no wrapper config behind, even when it fails.
    fs.writeFileSync(path.join(repo, 'playwright.config.js'), 'export default {};\n');
    const cap = await attempt(null, { FAKE_STATUS: '1' }, { capture: true });
    assert.deepEqual(fs.readdirSync(repo).filter(n => n.startsWith('.rp-capture-')), []);
    // Depot runs the uploaded copy elsewhere, so the capture config must be passed repository-relative.
    assert.match(fs.readFileSync(path.join(tmp, 'depot-cmd'), 'utf8'), /'--config' '\.rp-capture-\d+\.config\.mjs'/);
    assert.equal(cap.code, 1);
  } finally { console.error = quiet; }
}

// With a real playwright-core available (REMOTE_PLAYWRIGHT_CORE or the current repository), run the actual
// run-server behind the proxy and load a loopback page through exposeNetwork.
export async function liveCase() {
  let core, dir;
  try {
    const req = createRequire(path.join(process.env.REMOTE_PLAYWRIGHT_CORE ?? process.cwd(), 'noop.js'));
    dir = path.dirname(req.resolve('playwright-core/package.json'));
    core = req('playwright-core');
    core.chromium.executablePath() && fs.accessSync(core.chromium.executablePath());
  } catch { return 'skipped (no playwright-core with Chromium here)'; }
  const run = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-live-'));
  const token = 'c'.repeat(64);
  fs.writeFileSync(path.join(run, 'token.sha256'), createHash('sha256').update(token).digest('hex'));
  const stage = path.dirname(path.dirname(dir));
  const port = await new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
  const { spawn } = await import('node:child_process');
  const child = spawn(process.execPath, [path.join(here, 'proxy.cjs'), stage.endsWith('node_modules') ? path.dirname(stage) : stage, run, String(port), Buffer.from('[]').toString('base64')], { stdio: 'inherit' });
  try {
    for (let i = 0; i < 120 && !fs.existsSync(path.join(run, 'ready')); i++) await new Promise(r => setTimeout(r, 250));
    assert.ok(fs.existsSync(path.join(run, 'ready')), 'proxy ready');
    const http = await import('node:http');
    const page = http.createServer((_q, s) => s.end('rp-ok'));
    await new Promise(r => page.listen(0, '127.0.0.1', r));
    await assert.rejects(core.chromium.connect(`ws://127.0.0.1:${port}/`, { timeout: 5000 }));
    const b = await core.chromium.connect(`ws://127.0.0.1:${port}/`, { headers: { 'x-rp-token': token }, exposeNetwork: '<loopback>', timeout: 30_000 });
    const p = await b.newPage();
    await p.goto(`http://localhost:${page.address().port}/`);
    assert.equal((await p.textContent('body')).trim(), 'rp-ok');
    await b.close(); page.close();
    return 'passed';
  } finally {
    const gone = new Promise(r => child.once('exit', r));
    child.kill();
    await gone;
    fs.rmSync(run, { recursive: true, force: true });
  }
}

export async function check() {
  await cases();
  const live = await liveCase();
  console.log(`remote-playwright check passed (live run-server case: ${live}).`);
  return 0;
}

assert.ok(Fail && depotCommand(['x'], { install: 'npm ci', exec: ['npx'] }).includes("'npx' 'playwright' 'test' '--workers=1' 'x'"));
{
  // The fallback installs and runs with the repository's own package manager.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-pm-'));
  const pm = (files, pkg) => { fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir); for (const f of files) fs.writeFileSync(path.join(dir, f), ''); if (pkg) fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg)); return packageManager(dir); };
  assert.equal(pm(['package-lock.json']).install, 'npm ci');
  assert.equal(pm([]).install, 'npm install');
  assert.deepEqual(pm(['pnpm-lock.yaml']).exec, ['pnpm', 'exec']);
  assert.match(pm(['yarn.lock']).install, /yarn install --frozen-lockfile/);
  assert.match(pm(['yarn.lock', '.yarnrc.yml']).install, /yarn install --immutable/);
  assert.match(pm(['yarn.lock'], { packageManager: 'yarn@1.22.22' }).install, /--frozen-lockfile/);
  assert.match(pm(['yarn.lock'], { packageManager: 'yarn@4.5.0' }).install, /--immutable/);
  assert.deepEqual(pm(['bun.lock']).exec, ['bunx']);
  assert.deepEqual(pm(['package-lock.json'], { packageManager: 'pnpm@9.1.0' }).exec, ['pnpm', 'exec']);
  assert.match(depotCommand(['t'], pm(['pnpm-lock.yaml'])), /^mkdir -p \.rp; \(corepack enable && pnpm install --frozen-lockfile && 'pnpm' 'exec' 'playwright' 'install'/);
  fs.rmSync(dir, { recursive: true, force: true });
}
