// Live run view: a local page plus a Server-Sent Events stream of <run-dir>/run.jsonl.
// Loopback only, Host-checked, no CORS; the page writes every log value with textContent.
'use strict';
const http = require('node:http');
const { openSync, readSync, closeSync, statSync, existsSync, watch } = require('node:fs');
const { join } = require('node:path');

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Graph run</title><style>
:root{--bg:#fff;--fg:#1a1a1a;--muted:#6b6b6b;--line:#ddd;--run:#2563eb;--ok:#15803d;--bad:#b91c1c;--skip:#a16207}
@media (prefers-color-scheme:dark){:root{--bg:#141414;--fg:#eee;--muted:#9a9a9a;--line:#333;--run:#60a5fa;--ok:#4ade80;--bad:#f87171;--skip:#facc15}}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:14px/1.4 system-ui,sans-serif}
h1{font-size:16px;margin:0 0 12px}#state{color:var(--muted);font-weight:400}
.cols{display:flex;gap:16px;overflow-x:auto;align-items:flex-start}.col{min-width:180px}
.col h2{font-size:13px;margin:0 0 6px;color:var(--muted)}
.box{border:1.5px solid var(--line);border-radius:8px;padding:6px 8px;margin-bottom:6px}
.box small{display:block;color:var(--muted);font-size:11px;word-break:break-word}
.dispatch,.pick{border-color:var(--run)}.result{border-color:var(--ok)}
.failed,.blocked{border-color:var(--bad)}.gate-dropped,.cap-skipped{border-color:var(--skip);border-style:dashed}
</style></head><body><h1>Graph run <span id="state"></span></h1><div class="cols" id="cols"></div>
<script>
const cols = document.getElementById('cols'), stateEl = document.getElementById('state'), boxes = {};
function col(node){let c=document.getElementById('c-'+node);if(!c){c=document.createElement('div');c.className='col';c.id='c-'+node;
const h=document.createElement('h2');h.textContent=node;c.append(h);cols.append(c);}return c;}
function box(node,index){const k=node+'#'+(index??0);if(!boxes[k]){const b=document.createElement('div');b.className='box';
const t=document.createElement('div');t.textContent=k;const s=document.createElement('small');b.append(t,s);col(node).append(b);boxes[k]=b;}return boxes[k];}
function set(b,cls,text){b.className='box '+cls;b.lastChild.textContent=text;}
new EventSource('events').onmessage = m => { const e = JSON.parse(m.data);
  if (e.type==='spec') (e.nodes||[]).forEach(col);
  else if (e.type==='dispatch') set(box(e.node,e.index),'dispatch','attempt '+e.attempt);
  else if (e.type==='pick') { const b=box(e.node,e.index); set(b,'pick',e.model+' @ '+e.effort); b.title=JSON.stringify(e.reason); }
  else if (e.type==='result') set(box(e.node,e.index),'result','done'+(e.model?' · '+e.model:''));
  else if (e.type==='gate-dropped') set(box(e.node,e.index),'gate-dropped','dropped by gate');
  else if (e.type==='failed') set(box(e.node,e.index),'failed',(e.final?'failed: ':'retrying: ')+e.reason);
  else if (e.type==='blocked') set(box(e.node,0),'blocked','blocked by '+e.cause);
  else if (e.type==='cap-skipped') set(box(e.node,'cap'),'cap-skipped',e.count+' skipped by max_agents');
  else if (e.type==='write-applied'||e.type==='write-failed') stateEl.textContent = e.type+' '+e.id;
  else if (e.type==='end') stateEl.textContent = e.state; };
</script></body></html>`;

function serve(dir, port = 0) {
  const file = join(dir, 'run.jsonl');
  const server = http.createServer((req, res) => {
    const { port: actual } = server.address();
    if (![`127.0.0.1:${actual}`, `localhost:${actual}`].includes(req.headers.host)) { res.writeHead(403).end('forbidden'); return; }
    if (req.url === '/' ) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8',
        'content-security-policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'" });
      res.end(PAGE); return;
    }
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
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => resolve(server)); });
}

module.exports = { serve };
