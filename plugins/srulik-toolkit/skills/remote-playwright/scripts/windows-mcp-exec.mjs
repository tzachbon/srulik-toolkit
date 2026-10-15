#!/usr/bin/env node
// Adapter: runs the PowerShell script on stdin through an MCP server's shell tool and prints its output.
// node windows-mcp-exec.mjs --url <streamable-http-mcp-url> [--tool PowerShell] [--timeout 600]
// Expects a tool taking {command, timeout} whose text result is "Response: <stdout>\nStatus Code: <n>".
import http from 'node:http';
import https from 'node:https';

function post(url, body, session, method = 'POST', seconds = 30) {
  const u = new URL(url);
  const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
  if (session) headers['mcp-session-id'] = session;
  return new Promise((resolve, reject) => {
    // node:http has no default response timeout, unlike fetch: first-time staging can take minutes.
    const req = (u.protocol === 'https:' ? https : http).request(u, { method, headers }, res => {
      let text = '';
      res.setEncoding('utf8').on('data', d => { text += d; }).on('end', () => resolve({ session: res.headers['mcp-session-id'], status: res.statusCode, text }));
    });
    // Every request has a deadline, so start and stop never block on a server that leaves a response open.
    req.setTimeout(seconds * 1000, () => req.destroy(Error(`MCP request timed out after ${seconds}s`)));
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

function message(text) {
  const data = text.split('\n').filter(l => l.startsWith('data:')).map(l => JSON.parse(l.slice(5)));
  return data.length ? data.at(-1) : JSON.parse(text);
}

async function main() {
  const opts = { tool: 'PowerShell', timeout: '600' };
  const argv = process.argv.slice(2);
  while (argv.length) { const k = argv.shift(); if (!k.startsWith('--') || !argv.length) throw Error('Use --url URL [--tool NAME] [--timeout SECONDS]'); opts[k.slice(2)] = argv.shift(); }
  if (!opts.url) throw Error('--url is required');
  let script = '';
  for await (const chunk of process.stdin) script += chunk;
  const init = await post(opts.url, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'remote-playwright', version: '1' } } });
  if (init.status !== 200 || !init.session) throw Error(`MCP initialize failed (HTTP ${init.status})`);
  try {
    await post(opts.url, { jsonrpc: '2.0', method: 'notifications/initialized' }, init.session);
    const call = await post(opts.url, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: opts.tool, arguments: { command: script, timeout: Number(opts.timeout) } } }, init.session, 'POST', Number(opts.timeout) + 30);
    const msg = message(call.text);
    if (msg.error) throw Error(`MCP error: ${msg.error.message}`);
    const result = msg.result?.structuredContent?.result ?? msg.result?.content?.find(c => c.type === 'text')?.text ?? '';
    const status = /Status Code: (-?\d+)\s*$/.exec(result);
    process.stdout.write(result.replace(/^Response: /, '').replace(/\n?Status Code: -?\d+\s*$/, '') + '\n');
    if (msg.result?.isError || (status && status[1] !== '0')) process.exitCode = 1;
  } finally {
    await post(opts.url, undefined, init.session, 'DELETE').catch(() => {});
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
