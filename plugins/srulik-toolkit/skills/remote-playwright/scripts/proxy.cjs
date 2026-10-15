// Windows front proxy: node proxy.cjs <stageDir> <runDir> <port> <argsBase64Json>
// Owns 127.0.0.1:<port>, requires the per-start token, and forwards authenticated WebSocket upgrades to
// Playwright's own run-server on a private loopback port with server-chosen launch options. Node stdlib only.
'use strict';
const http = require('node:http');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createHash, timingSafeEqual } = require('node:crypto');

const sha256 = value => createHash('sha256').update(String(value)).digest();

// Rebuild the upgrade request for the inner server. Always `GET /`: query strings can carry launch options.
function upstreamRequest(headers, innerPort, args) {
  const out = { ...headers };
  for (const key of Object.keys(out)) if (key === 'x-rp-token' || key.startsWith('x-playwright-launch')) delete out[key];
  out.host = `127.0.0.1:${innerPort}`;
  out['x-playwright-browser'] = 'chromium';
  out['x-playwright-launch-options'] = JSON.stringify({ headless: true, args });
  delete out.origin;
  const lines = Object.entries(out).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
  return `GET / HTTP/1.1\r\n${lines.join('\r\n')}\r\n\r\n`;
}

function authorized(headers, wantHash) {
  const got = headers['x-rp-token'];
  return typeof got === 'string' && got.length > 0 && timingSafeEqual(sha256(got), wantHash);
}

// Serve authenticated upgrades on `port`, forwarding them to `innerPort`. Resolves with the http server.
function serve({ port, innerPort, args, wantHash, host = '127.0.0.1' }) {
  const server = http.createServer((_req, res) => { res.writeHead(401).end(); });
  server.on('upgrade', (req, sock, head) => {
    if (!authorized(req.headers, wantHash)) { sock.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n'); return; }
    const up = net.connect(innerPort, '127.0.0.1', () => {
      up.write(upstreamRequest(req.headers, innerPort, args));
      if (head?.length) up.write(head);
      sock.pipe(up).pipe(sock);
    });
    up.on('error', () => sock.destroy());
    sock.on('error', () => up.destroy());
  });
  return new Promise((resolve, reject) => server.once('error', reject).listen(port, host, () => resolve(server)));
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer().once('error', reject).listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

async function main([stageDir, runDir, port, argsB64]) {
  const args = JSON.parse(Buffer.from(argsB64 || 'W10=', 'base64').toString('utf8'));
  if (!Array.isArray(args) || !args.every(a => typeof a === 'string')) throw Error('argsJson must be a JSON string array');
  const wantHash = Buffer.from(fs.readFileSync(path.join(runDir, 'token.sha256'), 'utf8').trim(), 'hex');
  if (wantHash.length !== 32) throw Error('token.sha256 must hold a SHA-256 hex digest');
  const cli = path.join(stageDir, 'node_modules', 'playwright-core', 'cli.js');
  const innerPort = await freePort();
  const child = spawn(process.execPath, [cli, 'run-server', '--host', '127.0.0.1', '--port', String(innerPort), '--max-clients', '1', '--unsafe'],
    { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
  // Registered before anything can fail, so the inner server never outlives this proxy.
  process.once('exit', () => child.kill());
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('run-server did not start')), 60_000);
    child.stdout.on('data', chunk => { if (String(chunk).includes('Listening on')) { clearTimeout(timer); resolve(); } });
    child.once('exit', code => reject(Error(`run-server exited ${code}`)));
  });
  child.stdout.resume();
  const server = await serve({ port: Number(port), innerPort, args, wantHash });
  const stop = () => { server.close(); child.kill(); process.exit(0); };
  child.once('exit', () => { server.close(); process.exit(1); });
  process.once('SIGINT', stop).once('SIGTERM', stop);
  fs.writeFileSync(path.join(runDir, 'ready'), String(process.pid));
}

if (require.main === module) {
  // Detached on Windows: no console, so failures go to <runDir>/proxy.err for start to report.
  main(process.argv.slice(2)).catch(e => {
    try { fs.writeFileSync(path.join(process.argv[3], 'proxy.err'), String(e.message)); } catch { /* run dir missing */ }
    process.exit(1);
  });
}
module.exports = { upstreamRequest, authorized, serve, sha256 };
