// Live run view: a local page, a Server-Sent Events stream of <run-dir>/run.jsonl, and read-only <run-dir>/nodes/ files.
// This machine's Tailscale address by default (else loopback), or one named address; Host-checked, no CORS; the page writes every log value with textContent.
'use strict';
const http = require('node:http');
const { openSync, readSync, closeSync, statSync, existsSync, watch, realpathSync, readFileSync } = require('node:fs');
const { join, sep } = require('node:path');
const { isIP } = require('node:net');
const { networkInterfaces } = require('node:os');

// The page is plain HTML beside this file; it writes every log value with textContent.
const PAGE = readFileSync(join(__dirname, 'page.html'), 'utf8').replace('/*CSS*/', () => readFileSync(join(__dirname, 'page.css'), 'utf8'));

// A request's Host must name the one address the server listens on (plus `localhost` for a loopback server),
// so DNS rebinding can't reach it.
const allowedHost = (header, host, port) =>
  [`${host.includes(':') ? `[${host}]` : host}:${port}`, ...(host === '127.0.0.1' ? [`localhost:${port}`] : [])].includes(header);

// The address as a browser writes it in Host: IPv6 lowercased and compressed. Anything that isn't an IP becomes ''.
function canonicalHost(host) {
  if (!isIP(host)) return '';
  return isIP(host) === 6 ? new URL(`http://[${host}]/`).hostname.slice(1, -1) : host;
}

// The view has no login, so it may bind only a literal loopback or private address: RFC 1918, Tailscale's
// 100.64.0.0/10, or IPv6 unique-local. Names and unspecified addresses (any spelling of 0.0.0.0 or ::) are refused.
function privateHost(host) {
  if (isIP(host) === 4) {
    const [a, b] = host.split('.').map(Number);
    return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  // fc00::/7 is the first 16-bit group 0xfc00-0xfdff; a short group like `fc` is 0x00fc, so compare the number.
  if (isIP(host) === 6) return host === '::1' || (parseInt(host, 16) & 0xfe00) === 0xfc00;
  return false;
}

// The default address: this machine's Tailscale IPv4 (100.64.0.0/10 on a tailscale or utun interface), so the
// printed link opens from the owner's other devices; loopback when there is none.
function defaultHost(interfaces = networkInterfaces()) {
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!/tailscale|^utun/i.test(name)) continue;
    const hit = (addrs ?? []).find(a => a.family === 'IPv4' && /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(a.address));
    if (hit) return hit.address;
  }
  return '127.0.0.1';
}

// The run index, an output file, or one attachment. The pattern admits no '%', '..' or leading dot, and the real
// path must stay inside <run-dir>/nodes, so a symlink can't lead out. Plain text with nosniff: markup never runs.
const NODE_PATH = /^\/nodes\/(index\.md|[a-z0-9_-]+-\d+(?:\.r\d+)?\.md|[a-z0-9_-]+-\d+(?:\.r\d+)?\/[A-Za-z0-9][A-Za-z0-9._-]{0,79})$/;
function sendNodeFile(res, dir, rel) {
  let body;
  try {
    const root = realpathSync(join(dir, 'nodes'));
    const file = realpathSync(join(root, rel));
    if (!file.startsWith(root + sep)) throw new Error('outside nodes/');
    body = readFileSync(file);
  } catch { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff', 'cache-control': 'no-cache' }).end(body);
}

function serve(dir, port = 0, address = '127.0.0.1') {
  const host = canonicalHost(address);
  if (!privateHost(host)) return Promise.reject(new Error('--host must be a loopback or private address, such as a Tailscale IP'));
  const file = join(dir, 'run.jsonl');
  const server = http.createServer((req, res) => {
    const { port: actual } = server.address();
    if (!allowedHost(req.headers.host, host, actual)) { res.writeHead(403).end('forbidden'); return; }
    if (req.url === '/' ) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8',
        'content-security-policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'" });
      res.end(PAGE); return;
    }
    const node = NODE_PATH.exec(req.url);
    if (node) { sendNodeFile(res, dir, node[1]); return; }
    if (req.url !== '/events') { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    let offset = 0; let partial = '';
    // A read-only helper: a transient filesystem error skips one tick instead of stopping the server.
    const pump = () => { try { pumpOnce(); } catch { /* retried on the next tick */ } };
    const pumpOnce = () => {
      if (!existsSync(file)) return;
      const size = statSync(file).size;
      if (size <= offset) return;
      const fd = openSync(file, 'r'); const buf = Buffer.alloc(size - offset);
      try { readSync(fd, buf, 0, buf.length, offset); } finally { closeSync(fd); }
      offset = size;
      const lines = (partial + buf.toString('utf8')).split('\n'); partial = lines.pop();
      for (const line of lines) if (line.trim()) res.write(`data: ${line}\n\n`);
    };
    pump();
    let watcher = null;
    try { watcher = watch(dir, pump); watcher.on('error', () => { watcher?.close(); watcher = null; }); } catch { /* the poll below covers platforms without fs.watch */ }
    const poll = setInterval(pump, 500);
    req.on('close', () => { clearInterval(poll); watcher?.close(); });
  });
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => resolve(server)); });
}

module.exports = { serve, allowedHost, privateHost, canonicalHost, defaultHost, PAGE };
