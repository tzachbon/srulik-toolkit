#!/usr/bin/env node
// Graph mode CLI for agent-swarm. Exit codes: 0 ok, 1 spec or usage error, 2 BLOCKED.
'use strict';
const { readFileSync, writeFileSync, appendFileSync, mkdirSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { parse } = require('./graph/yaml.js');
const { check } = require('./graph/spec.js');
const run = require('./graph/run.js');
const { pick } = require('./graph/pick.js');
const { loadAll, loadArena, stateDir } = require('./graph/data.js');
const { scoreThreads, nextWatermark } = require('./graph/score.js');

const USAGE = `Usage: node graph.js <command> ...
  check   <spec.yaml>
  next    <spec.yaml> <run-dir> [--input k=v ...] [--cwd <dir>]
  exec    <spec.yaml> <run-dir> <node>
  pick    <spec.yaml> <run-dir> <node> <index> --candidates <file> [--usage <file>] [--exclude <model> ...]
  done    <spec.yaml> <run-dir> <result.json>
  apply   <spec.yaml> <run-dir> <write-id> [--mark applied|failed]
  status  <spec.yaml> <run-dir>
  score   <threads.json> [--since <ms>]
  watermark
  refresh
  view    <run-dir> [--port N] [--host <address>]`;

// Creators to avoid for one instance: the producer of this item when it came from the differ_from node,
// otherwise every creator that node used. Each producer instance counts only its latest pick, the attempt
// that produced its result; a creator that failed and was retried elsewhere is not excluded. A producer whose
// creator is unknown excludes its model instead.
function differPicks(s, differ, name, index) {
  const src = (s.admitted[name] ?? [])[index]?.src;
  const latest = new Map((s.picks[differ] ?? []).map(p => [p.index, p]));
  const picks = [...latest.values()].filter(p => !src || src.node !== differ || p.index === src.index);
  return picks;
}

const usage = () => { throw Object.assign(new Error(USAGE), { code: 1 }); };
const load = file => check(parse(readFileSync(file, 'utf8')));
const out = value => process.stdout.write(JSON.stringify(value, null, 2) + '\n');

function flags(args, names) {
  const found = Object.fromEntries(names.map(n => [n, []])); const rest = [];
  for (let i = 0; i < args.length; i++) {
    const name = args[i].startsWith('--') && args[i].slice(2);
    if (name && names.includes(name)) { if (i + 1 >= args.length) usage(); found[name].push(args[++i]); }
    else if (name) usage(); else rest.push(args[i]);
  }
  return { found, rest };
}

function pickContext(spec, dir, name, index, excludes) {
  const s = run.fold(dir);
  const node = spec.nodes[name];
  const consumers = spec.order.filter(n => (spec.nodes[n].for_each ?? '').toString().includes(`\${${name}.`));
  const differ = node.pick?.differ_from;
  const producers = differ ? differPicks(s, differ, name, index) : [];
  return {
    gated: !!node.gate || consumers.some(n => spec.nodes[n].gate),
    verifier: !!differ,
    exclude_creators: [...new Set(producers.map(p => p.creator).filter(Boolean))],
    exclude_models: [...excludes, ...producers.filter(p => !p.creator).map(p => p.model)],
  };
}

async function main([command, ...args]) {
  if (!command || command === '--help') { console.log(USAGE); return; }
  if (command === 'check') { if (args.length !== 1) usage(); load(args[0]); console.log('ok'); return; }
  if (command === 'next') {
    const { found, rest } = flags(args, ['input', 'cwd']); if (rest.length !== 2 || found.cwd.length > 1) usage();
    const inputs = Object.fromEntries(found.input.map(kv => { const at = kv.indexOf('='); if (at < 1) usage(); return [kv.slice(0, at), kv.slice(at + 1)]; }));
    out(run.next(load(rest[0]), resolve(rest[1]), inputs, { cwd: resolve(found.cwd[0] ?? process.cwd()) })); return;
  }
  if (command === 'exec') { if (args.length !== 3) usage(); out(run.exec(load(args[0]), resolve(args[1]), args[2])); return; }
  if (command === 'done') { if (args.length !== 3) usage(); out(run.done(load(args[0]), resolve(args[1]), JSON.parse(readFileSync(args[2], 'utf8')))); return; }
  if (command === 'apply') {
    const { found, rest } = flags(args, ['mark']); if (rest.length !== 3 || found.mark.length > 1) usage();
    const r = run.apply(load(rest[0]), resolve(rest[1]), rest[2], undefined, { mark: found.mark[0] }); out(r); if (!r.ok) process.exitCode = 1; return;
  }
  if (command === 'status') {
    if (args.length !== 2) usage();
    const spec = load(args[0]); const dir = resolve(args[1]); const st = run.status(spec, dir);
    const log = join(dir, 'run.jsonl');
    if (st.state !== 'running' && !readFileSync(log, 'utf8').includes(`"type":"end"`)) { appendFileSync(log, JSON.stringify({ t: Date.now(), type: 'end', state: st.state }) + '\n'); run.refreshIndex(dir); }
    out(st); return;
  }
  if (command === 'pick') {
    const { found, rest } = flags(args, ['candidates', 'usage', 'exclude']);
    if (rest.length !== 4 || found.candidates.length !== 1) usage();
    const [specFile, dirArg, name, indexArg] = rest; const spec = load(specFile); const dir = resolve(dirArg);
    const node = spec.nodes[name]; if (!node || !('agent' in node)) throw new Error(`${name}: not an agent node`);
    const data = await loadAll({ usageFile: found.usage[0], cwd: run.fold(dir).cwd ?? process.cwd() });
    Object.assign(data, { explore: spec.limits.explore, random: Math.random, now: Date.now() });
    const choice = pick(node, JSON.parse(readFileSync(found.candidates[0], 'utf8')), data, pickContext(spec, dir, name, Number(indexArg), found.exclude));
    if (Object.keys(data.errors).length) choice.reason.data_errors = data.errors;
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, 'run.jsonl'), JSON.stringify({ t: Date.now(), type: 'pick', node: name, index: Number(indexArg), ...choice }) + '\n');
    run.refreshIndex(dir); // the run index shows the model while the child works
    out(choice); return;
  }
  if (command === 'watermark') { // where the next weekly scoring must start listing threads
    if (args.length) usage();
    let since = 0; try { since = JSON.parse(readFileSync(join(stateDir(process.env), 'score-watermark.json'), 'utf8')).since; } catch { /* never scored */ }
    out({ since, iso: new Date(since).toISOString() }); return;
  }
  if (command === 'score') {
    const { found, rest } = flags(args, ['since']); if (rest.length !== 1) usage();
    const state = stateDir(process.env); const mark = join(state, 'score-watermark.json');
    // One scorer at a time: reading the watermark, appending outcomes and moving it are one step.
    mkdirSync(state, { recursive: true, mode: 0o700 });
    const { outcomes, total } = run.withRunLock(state, () => {
      let since = Number(found.since[0] ?? NaN);
      if (!Number.isFinite(since)) { try { since = JSON.parse(readFileSync(mark, 'utf8')).since; } catch { since = 0; } }
      const now = Date.now(); const threads = JSON.parse(readFileSync(rest[0], 'utf8'));
      // Score only up to the safe watermark: a decided thread newer than an undecided one waits, so nothing is counted twice.
      const until = nextWatermark(threads, since, now);
      const outcomes = scoreThreads(threads.filter(t => t.updated <= until), { now, since });
      if (outcomes.length) appendFileSync(join(state, 'model-stats.jsonl'), outcomes.map(o => JSON.stringify(o)).join('\n') + '\n');
      writeFileSync(mark, JSON.stringify({ since: until }));
      return { outcomes, total: threads.length };
    }, 'score.lock');
    out({ scored: outcomes.length, skipped: total - outcomes.length }); return;
  }
  if (command === 'refresh') {
    const aa = spawnSync(process.execPath, [join(__dirname, 'models.js'), '--update'], { encoding: 'utf8', timeout: 120000 });
    const arena = await loadArena({ cachePath: join(stateDir(process.env), 'arena.json'), force: true });
    const report = { aa: aa.status === 0 ? 'ok' : (aa.stderr || `exit ${aa.status}`).trim(), arena: arena.stale ? `failed: ${arena.error}` : 'ok' };
    out(report); if (report.aa !== 'ok' || report.arena !== 'ok') process.exitCode = 1; return;
  }
  if (command === 'view') {
    const { found, rest } = flags(args, ['port', 'host']); if (rest.length !== 1) usage();
    const view = require('./graph/view.js');
    const host = view.canonicalHost(found.host[0] ?? '127.0.0.1');
    const server = await view.serve(resolve(rest[0]), Number(found.port[0] ?? 0), host);
    console.log(`http://${host.includes(':') ? `[${host}]` : host}:${server.address().port}/`); return;
  }
  usage();
}

main(process.argv.slice(2)).catch(error => {
  console.error(error.message);
  process.exitCode = error.code === 1 ? 1 : /^BLOCKED/.test(error.message) ? 2 : 1;
});
