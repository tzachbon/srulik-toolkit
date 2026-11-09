// Graph scheduler. All state lives in <run-dir>/run.jsonl; every function folds the log, decides, and appends.
// One reducer (`reduce`) applies each event, so a new event updates in-memory state exactly as a reload would.
'use strict';
const { appendFileSync, readFileSync, existsSync, mkdirSync, writeFileSync, openSync, closeSync, rmSync, writeSync } = require('node:fs');
const { hostname } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const { refs, GATE } = require('./spec.js');
const { stateDir } = require('./data.js');

const key = (node, index = 0) => `${node}#${index}`;
const isAgent = node => 'agent' in node;

function reduce(s, e) {
  const inst = () => (s.inst[key(e.node, e.index)] ??= { failures: 0, attempts: [] });
  switch (e.type) {
    case 'spec': s.started = true; s.inputs = e.inputs; s.cwd = e.cwd; break;
    case 'admit': s.admitted[e.node] = e.items; break;
    case 'cap-skipped': s.capSkipped.push(`${e.node} (${e.count} skipped)`); break;
    case 'dispatch': inst().attempts.push(e.attempt); break;
    case 'pick': (s.picks[e.node] ??= []).push(e); break;
    case 'result': Object.assign(inst(), { result: e.output, model: e.model, settled: true });
      if (e.write) s.writes[e.write.id] = { name: e.write.name, file: e.write.file, argv: e.write.argv, state: 'reserved' }; break;
    case 'gate-dropped': inst().dropped = true; break;
    case 'failed': { const i = inst(); i.failures++; i.reason = e.reason; if (e.final) { i.final = true; i.settled = true; s.finalFailures.push(key(e.node, e.index)); } break; }
    case 'blocked': s.blocked[e.node] = e.cause; break;
    case 'write-claimed': s.writes[e.id].state = 'applying'; break;
    case 'write-applied': s.writes[e.id].state = 'applied'; break;
    case 'write-failed': s.writes[e.id].state = 'failed'; break;
  }
  return s;
}

const empty = () => ({ started: false, inputs: {}, cwd: null, admitted: {}, inst: {}, picks: {}, blocked: {}, writes: {}, capSkipped: [], finalFailures: [] });
const logPath = dir => join(dir, 'run.jsonl');

function fold(dir) {
  if (!existsSync(logPath(dir))) return empty();
  return readFileSync(logPath(dir), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).reduce(reduce, empty());
}

function emit(dir, s, event) {
  const e = { t: Date.now(), ...event };
  mkdirSync(dir, { recursive: true });
  appendFileSync(logPath(dir), JSON.stringify(e) + '\n');
  reduce(s, e);
  return e;
}

const instances = (s, node) => (s.admitted[node] ?? []).map((it, index) => ({ index, ...it, ...(s.inst[key(node, index)] ?? {}) }));
const survivors = (s, node) => instances(s, node).filter(i => i.result !== undefined && !i.dropped);
const settled = (s, node) => node in s.blocked || (node in s.admitted && instances(s, node).every(i => i.settled));
const impossible = (s, node) => node in s.blocked
  || (settled(s, node) && s.admitted[node].length > 0 && instances(s, node).every(i => i.final));

function propagate(spec, dir, s) {
  for (const node of spec.order) {
    if (node in s.blocked || node in s.admitted) continue;
    const cause = spec.edges[node].find(d => impossible(s, d));
    if (cause) emit(dir, s, { type: 'blocked', node, cause });
  }
}

const show = v => typeof v === 'string' ? v : JSON.stringify(v);
function substitute(text, s, item) {
  // One pass over the template with callback replacements, so inserted values stay literal.
  return text.replace(/\$\{([a-z0-9_-]+)\.([A-Za-z_]\w*)\}|\{item\}/gi, (m, p, f) => {
    if (!p) return show(item);
    if (p === 'inputs') return show(s.inputs[f]);
    const list = survivors(s, p);
    return list.length === 1 && s.admitted[p].length === 1 ? show(list[0].result[f]) : m; // fan-out values arrive via input
  });
}

function inputFor(spec, s, name) {
  const node = spec.nodes[name]; const input = {};
  for (const { node: p, field } of [].concat(node.in ?? []).flatMap(refs)) {
    if (p === 'inputs') continue;
    const fanOut = 'for_each' in spec.nodes[p];
    if (fanOut) input[p] = survivors(s, p).map(i => ({ index: i.index, item: i.item, value: i.result[field] }));
    else input[p] = { ...input[p], [field]: survivors(s, p)[0]?.result[field] };
  }
  for (const p of node.needs ?? []) input[p] = survivors(s, p).map(i => ({ index: i.index, item: i.item, output: i.result }));
  return input;
}

function admit(spec, dir, s, name) {
  const node = spec.nodes[name];
  let items;
  if (typeof node.for_each === 'string') {
    const [{ node: p, field }] = refs(node.for_each);
    items = survivors(s, p).flatMap(i => [].concat(i.result[field] ?? []).map(item => ({ item, src: { node: p, index: i.index } })));
    const used = Object.entries(s.admitted).filter(([n]) => isAgent(spec.nodes[n])).reduce((sum, [, it]) => sum + it.length, 0);
    const reserve = spec.order.filter(n => n !== name && isAgent(spec.nodes[n]) && !(n in s.admitted) && !(n in s.blocked))
      .reduce((sum, n) => sum + (Array.isArray(spec.nodes[n].for_each) ? spec.nodes[n].for_each.length : 1), 0);
    const room = Math.max(0, spec.limits.max_agents - used - reserve);
    if (items.length > room) { emit(dir, s, { type: 'cap-skipped', node: name, count: items.length - room }); items = items.slice(0, room); }
  } else items = (Array.isArray(node.for_each) ? node.for_each : [null]).map(item => ({ item, src: null }));
  emit(dir, s, { type: 'admit', node: name, count: items.length, items });
}

function next(spec, dir, overrides = {}, { cwd = process.cwd() } = {}) {
  const s = fold(dir);
  if (!s.started) {
    const inputs = { ...spec.inputs, ...overrides };
    for (const [k, v] of Object.entries(inputs)) if (String(v).startsWith('-')) throw new Error(`input "${k}" must not start with "-"`);
    emit(dir, s, { type: 'spec', name: spec.name, nodes: spec.order, edges: spec.edges, inputs, cwd });
  }
  const tasks = [];
  for (const name of spec.order) {
    if (name in s.blocked || !spec.edges[name].every(d => settled(s, d))) continue;
    if (!(name in s.admitted)) admit(spec, dir, s, name);
    const node = spec.nodes[name];
    for (const i of instances(s, name)) {
      const attempt = (i.failures ?? 0) + 1;
      if (i.settled || (i.attempts ?? []).includes(attempt)) continue;
      const taskType = isAgent(node) ? 'agent' : 'run';
      emit(dir, s, { type: 'dispatch', node: name, index: i.index, attempt, taskType, item: i.item, src: i.src });
      tasks.push(taskType === 'run'
        ? { node: name, index: i.index, attempt, taskType, argv: argvFor(node.run, s) }
        : { node: name, index: i.index, attempt, taskType, kind: node.kind ?? 'agentic', item: i.item,
            prompt: substitute(node.agent, s, i.item), input: inputFor(spec, s, name), pick: node.pick ?? null, model: node.model ?? null });
    }
  }
  return tasks;
}

const argvFor = (argv, s, file) => argv.map(a => a === '${file}' ? file : String(a).replace(/^\$\{inputs\.(\w+)\}$/, (_, k) => String(s.inputs[k])));

function exec(spec, dir, name) {
  const s = fold(dir);
  const i = s.inst[key(name)] ?? { failures: 0 };
  const attempt = i.failures + 1;
  const argv = argvFor(spec.nodes[name].run, s.started ? s : { inputs: spec.inputs });
  const r = spawnSync(argv[0], argv.slice(1), { shell: false, cwd: s.cwd ?? undefined, encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  if (r.status === 0) return done(spec, dir, { node: name, output: { text: r.stdout } }) && { output: { text: r.stdout } };
  const reason = (r.error?.message || r.stderr || `exit ${r.status}`).trim().slice(-500);
  done(spec, dir, { node: name, failed: reason, final: attempt >= 2 });
  return { failed: reason, final: attempt >= 2 };
}

function recordOutcome(spec, dir, s, inst, ok) {
  const src = s.inst[key(inst.src.node, inst.src.index)];
  if (!src?.model) return;
  const outcome = { model: src.model, kind: spec.nodes[inst.src.node].kind ?? 'agentic', ok };
  emit(dir, s, { type: 'outcome', node: inst.node, index: inst.index, ...outcome });
  try {
    const state = stateDir(process.env);
    mkdirSync(state, { recursive: true, mode: 0o700 });
    appendFileSync(join(state, 'model-stats.jsonl'), JSON.stringify({ t: Date.now(), ...outcome, src: 'graph' }) + '\n');
  } catch (error) { emit(dir, s, { type: 'stats-error', node: inst.node, reason: error.message }); }
}

function done(spec, dir, result) {
  const s = fold(dir);
  const { node: name, index = 0 } = result;
  const node = spec.nodes[name];
  const current = s.inst[key(name, index)] ?? {};
  if (current.settled) return { writes: [], duplicate: true };
  if (result.failed !== undefined) {
    const reported = (current.failures ?? 0) >= (current.attempts ?? []).length || (result.attempt !== undefined && result.attempt <= (current.failures ?? 0));
    if (reported) return { writes: [], duplicate: true }; // this attempt's failure was already recorded
    emit(dir, s, { type: 'failed', node: name, index, attempt: (current.failures ?? 0) + 1, reason: result.failed, final: !!result.final, model: result.model });
    if (result.final) propagate(spec, dir, s);
    return { writes: [] };
  }
  for (const f of node.out ?? []) if (!(f in (result.output ?? {}))) throw new Error(`${key(name, index)}: output missing "${f}"`);
  let passed = true;
  if (node.gate) { const [, field, literal] = GATE.exec(node.gate); passed = result.output[field] === JSON.parse(literal); }
  // Prepare the write artifact before recording the result, so a failure leaves the instance retryable.
  let write = null;
  const used = node.write ? Object.values(s.writes).filter(w => w.name === node.write).length : 0;
  if (node.write && passed && used < spec.writes[node.write].max) {
    const id = `${node.write}#${used + 1}`;
    const missing = [...s.finalFailures, ...s.capSkipped];
    const header = missing.length ? `Partial run: ${missing.join(', ')} did not complete\n\n` : '';
    const file = join(dir, 'writes', `${node.write}-${used + 1}.md`);
    mkdirSync(join(dir, 'writes'), { recursive: true });
    writeFileSync(file, header + show(result.output.body ?? result.output));
    write = { id, name: node.write, file, argv: argvFor(spec.writes[node.write].run, s, file) };
  }
  // The result and its write reservation are one event, so no crash can record one without the other.
  emit(dir, s, { type: 'result', node: name, index, output: result.output, model: result.model, provider: result.provider, ...(write ? { write } : {}) });
  if (node.gate) {
    if (!passed) emit(dir, s, { type: 'gate-dropped', node: name, index });
    const inst = instances(s, name)[index];
    if (inst?.src) recordOutcome(spec, dir, s, { node: name, index, src: inst.src }, passed);
  }
  return { writes: write ? [write] : [] };
}

// A claim lock names its owner. It is live while that process runs on this host; a lock from another
// host, or one that can't be read, is treated as live, so recovery never unlocks a write that may be running.
function lockOwnerAlive(lock) {
  let owner;
  try { owner = JSON.parse(readFileSync(lock, 'utf8')); } catch { return true; }
  if (owner?.host !== hostname() || !Number.isInteger(owner?.pid)) return true;
  try { process.kill(owner.pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}

const runnerIn = cwd => argv => spawnSync(argv[0], argv.slice(1), { shell: false, cwd: cwd ?? undefined, encoding: 'utf8', timeout: 120000 });

function apply(spec, dir, id, runner, { mark } = {}) {
  const s = fold(dir);
  runner ??= runnerIn(s.cwd);
  const w = s.writes[id];
  if (!w) throw new Error(`${id}: not reserved`);
  const lock = `${w.file}.lock`;
  if (mark) { // the owner checked an unknown outcome by hand and records it
    if (w.state === 'applied') throw new Error(`${id}: already applied`);
    if (existsSync(lock) && lockOwnerAlive(lock)) throw new Error(`${id}: still being applied by process ${readFileSync(lock, 'utf8').trim() || 'unknown'}; wait for it to finish`);
    if (!['applied', 'failed'].includes(mark)) throw new Error(`${id}: mark must be applied or failed`);
    emit(dir, s, mark === 'applied' ? { type: 'write-applied', id, marked: true } : { type: 'write-failed', id, reason: 'marked failed by owner' });
    rmSync(lock, { force: true }); // the claim's owner is gone and the owner resolved it, so a retry may proceed
    return { ok: mark === 'applied', id };
  }
  // Claim exclusively: the lock file can be created by one process only, so two applies never both run.
  let fd;
  try { fd = openSync(lock, 'wx'); } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    // Only a claim whose owner is gone is abandoned; a live owner is still applying.
    if (fold(dir).writes[id].state === 'applying' && !lockOwnerAlive(lock)) throw new Error(`${id}: outcome unknown; check the target, then apply with --mark applied or --mark failed`);
    throw new Error(`${id}: already being applied`);
  }
  try { writeSync(fd, JSON.stringify({ pid: process.pid, host: hostname() })); } finally { closeSync(fd); }
  try {
    const now = fold(dir).writes[id].state;
    if (now === 'applied') throw new Error(`${id}: already applied`);
    if (now === 'applying') throw new Error(`${id}: outcome unknown; check the target, then apply with --mark applied or --mark failed`);
    emit(dir, s, { type: 'write-claimed', id });
    const r = runner(w.argv);
    const ok = r.status === 0;
    emit(dir, s, ok ? { type: 'write-applied', id } : { type: 'write-failed', id, reason: String(r.error?.message || r.stderr || `exit ${r.status}`).trim().slice(-500) });
    return { ok, id };
  } finally { rmSync(lock, { force: true }); }
}

function status(spec, dir) {
  const s = fold(dir);
  const all = spec.order;
  const summary = { completed: all.filter(n => settled(s, n) && !impossible(s, n)), failed: s.finalFailures,
    blocked: Object.keys(s.blocked), dropped: Object.entries(s.inst).filter(([, i]) => i.dropped).map(([k]) => k),
    capSkipped: s.capSkipped, writes: s.writes };
  if (!all.every(n => settled(s, n))) return { state: 'running', ...summary };
  if (spec.sinks.every(n => impossible(s, n))) return { state: 'blocked', ...summary };
  const unapplied = Object.values(s.writes).some(w => w.state !== 'applied');
  return { state: s.finalFailures.length || s.capSkipped.length || unapplied ? 'partial' : 'done', ...summary };
}

module.exports = { fold, next, exec, done, apply, status };
