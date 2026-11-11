// Graph scheduler. All state lives in <run-dir>/run.jsonl; every function folds the log, decides, and appends.
// One reducer (`reduce`) applies each event, so a new event updates in-memory state exactly as a reload would.
'use strict';
const { appendFileSync, readFileSync, existsSync, mkdirSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { refs, GATE, condition } = require('./spec.js');
const { stateDir } = require('./data.js');
const { withRunLock, claim } = require('./lock.js');
const { key, show, instances, summarize, writeIndex, checkAttachments, writeNodeFiles } = require('./nodes.js');

const isAgent = node => 'agent' in node;

function reduce(s, e) {
  const inst = () => (s.inst[key(e.node, e.index)] ??= { failures: 0, attempts: [] });
  switch (e.type) {
    case 'spec': s.started = true; s.name = e.name; s.nodes = e.nodes; s.inputs = e.inputs; s.cwd = e.cwd; s.loops = e.loops ?? {};
      for (const [L, l] of Object.entries(s.loops)) for (const n of l.nodes) s.loopOf[n] = L; break;
    case 'skipped': s.skipped[e.node] = e.reason; break;
    case 'loop-exit': s.loopExit[e.loop] = e.reason; break;
    case 'round': nextRound(s, e); break;
    case 'admit': s.admitted[e.node] = e.items; break;
    case 'cap-skipped': s.capSkipped.push(`${e.node} (${e.count} skipped)`); break;
    case 'dispatch': inst().attempts.push(e.attempt); if (e.taskType === 'parent') inst().parent = true; break;
    case 'pick': (s.picks[e.node] ??= []).push(e); inst().model = e.model; break;
    case 'result': Object.assign(inst(), { result: e.output, model: e.model, file: e.file, summary: e.summary, attachments: e.attachments, settled: true, ...(e.dropped ? { dropped: true } : {}) });
      if (e.write) s.writes[e.write.id] = { name: e.write.name, file: e.write.file, argv: e.write.argv, state: 'reserved' }; break;
    case 'gate-dropped': inst().dropped = true; break;
    case 'failed': { const i = inst(); i.failures++; i.reason = e.reason; if (e.final) { i.final = true; i.settled = true; s.finalFailures.push(key(e.node, e.index)); } break; }
    case 'blocked': s.blocked[e.node] = e.cause; break;
    case 'end': s.state = e.state; break;
    case 'write-claimed': s.writes[e.id].state = 'applying'; break;
    case 'write-applied': s.writes[e.id].state = 'applied'; break;
    case 'write-failed': s.writes[e.id].state = 'failed'; break;
  }
  return s;
}

// maps keyed by node name have no prototype, so a node named `constructor` or `toString` is never already present
const map = () => Object.create(null);
const empty = () => ({ started: false, inputs: {}, cwd: null, admitted: map(), inst: map(), picks: map(), blocked: map(), writes: map(), capSkipped: [], finalFailures: [],
  loops: {}, loopOf: map(), round: map(), loopExit: map(), skipped: map(), history: map() });

// A new round moves the loop's per-round state into history, so the round starts clean and earlier rounds stay readable.
function nextRound(s, e) {
  const nodes = s.loops[e.loop].nodes; const owns = k => nodes.includes(k.slice(0, k.lastIndexOf('#')));
  const snap = { round: e.round - 1, admitted: map(), inst: map(), picks: map(), blocked: map(), skipped: map() };
  for (const part of ['admitted', 'picks', 'blocked', 'skipped']) for (const n of nodes) if (n in s[part]) { snap[part][n] = s[part][n]; delete s[part][n]; }
  for (const k of Object.keys(s.inst)) if (owns(k)) { snap.inst[k] = s.inst[k]; delete s.inst[k]; }
  s.finalFailures = s.finalFailures.filter(k => !owns(k));
  s.capSkipped = s.capSkipped.filter(c => !nodes.some(n => c.startsWith(n + ' (')));
  (s.history[e.loop] ??= []).push(snap); s.round[e.loop] = e.round;
}
const roundOf = (s, node) => s.loopOf[node] ? s.round[s.loopOf[node]] ?? 1 : 1;
const ROUND_EVENTS = new Set(['admit', 'dispatch', 'pick', 'result', 'failed', 'gate-dropped', 'outcome']);
const logPath = dir => join(dir, 'run.jsonl');

function fold(dir) {
  if (!existsSync(logPath(dir))) return empty();
  return readFileSync(logPath(dir), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).reduce(reduce, empty());
}

function emit(dir, s, event, index = true) {
  const e = { t: Date.now(), ...event };
  // events for a loop node carry its round, so the view and index can keep rounds apart
  if (ROUND_EVENTS.has(e.type) && s.loopOf[e.node] && e.round === undefined) e.round = roundOf(s, e.node);
  mkdirSync(dir, { recursive: true });
  appendFileSync(logPath(dir), JSON.stringify(e) + '\n');
  reduce(s, e);
  if (index) writeIndex(dir, s);
  return e;
}

const refreshIndex = dir => withRunLock(dir, () => writeIndex(dir, fold(dir)));

const survivors = (s, node) => instances(s, node).filter(i => i.result !== undefined && !i.dropped);
const settled = (s, node) => node in s.blocked || node in s.skipped || (node in s.admitted && instances(s, node).every(i => i.settled));
const impossible = (s, node) => node in s.blocked
  || (settled(s, node) && (s.admitted[node]?.length ?? 0) > 0 && instances(s, node).every(i => i.final));
// A node outside a loop sees a loop node as settled only once the loop has exited.
const settledFor = (s, consumer, dep) => !(s.loopOf[dep] && s.loopOf[dep] !== s.loopOf[consumer] && !(s.loopOf[dep] in s.loopExit)) && settled(s, dep);

function propagate(spec, dir, s) {
  while (blockAfter(spec, dir, s)) { /* an instance blocked by a sibling can block the next one */ }
  for (const node of spec.order) {
    if (node in s.blocked || node in s.admitted || node in s.skipped) continue;
    // a loop that stopped short of its until condition never converged, so work outside it can't use it
    const short = d => s.loopOf[d] && s.loopOf[d] !== s.loopOf[node] && s.loopExit[s.loopOf[d]] && s.loopExit[s.loopOf[d]] !== 'until';
    const dep = spec.edges[node].find(d => impossible(s, d) || short(d));
    if (dep) emit(dir, s, { type: 'blocked', node, cause: impossible(s, dep) ? dep : `${s.loopOf[dep]} (${s.loopExit[s.loopOf[dep]]})` });
  }
}

// after: an instance whose named item failed or was dropped fails too, with the reason naming that item.
function blockAfter(spec, dir, s) {
  let changed = false;
  for (const name of spec.order) {
    if (!spec.nodes[name].after || !(name in s.admitted)) continue;
    const list = instances(s, name);
    for (const i of list) {
      if (i.settled || !i.deps) continue;
      const bad = i.deps.find(d => list[d].final || list[d].dropped);
      if (bad === undefined) continue;
      emit(dir, s, { type: 'failed', node: name, index: i.index, attempt: 1, reason: `blocked by ${list[bad].item[spec.nodes[name].after]}`, final: true });
      changed = true;
    }
  }
  return changed;
}

// Agents admitted so far, in every round.
const usedAgents = (spec, s) => [s, ...Object.values(s.history).flat()].reduce((sum, part) =>
  sum + Object.entries(part.admitted).filter(([n]) => isAgent(spec.nodes[n])).reduce((t, [, it]) => t + it.length, 0), 0);
const staticCount = node => Array.isArray(node.for_each) ? node.for_each.length : 1;
// Room still owed to agent nodes not yet admitted, counting every round a loop has left.
function reserved(spec, s, skip) {
  let sum = 0;
  for (const n of spec.order) {
    const node = spec.nodes[n];
    if (!isAgent(node) || skip(n) || n in s.blocked) continue;
    const L = spec.loopOf[n]; const pending = n in s.admitted || n in s.skipped ? 0 : 1;
    if (!L) sum += staticCount(node) * pending;
    else if (!(L in s.loopExit)) sum += staticCount(node) * (spec.loops[L].max_rounds - (s.round[L] ?? 1) + pending);
  }
  return sum;
}

// Once every node of a loop's round has settled: exit, or start the next round. Returns true when it logged anything.
function decideLoops(spec, dir, s) {
  let changed = false;
  for (const [L, loop] of Object.entries(spec.loops)) {
    if (L in s.loopExit || !loop.nodes.every(n => settled(s, n))) continue;
    const round = s.round[L] ?? 1; const { node: u, field, literal } = loop.until;
    const exit = survivors(s, u)[0];
    const need = loop.nodes.filter(n => isAgent(spec.nodes[n])).reduce((t, n) => t + staticCount(spec.nodes[n]), 0);
    const reason = impossible(s, u) ? 'failed' : exit && exit.result[field] === literal ? 'until' : round >= loop.max_rounds ? 'max_rounds'
      : usedAgents(spec, s) + need + reserved(spec, s, n => spec.loopOf[n] === L) > spec.limits.max_agents ? 'cap' : null;
    emit(dir, s, reason ? { type: 'loop-exit', loop: L, round, reason } : { type: 'round', loop: L, round: round + 1 });
    changed = true;
  }
  return changed;
}

// Settle what can be settled: blocks, loop exits and new rounds, until nothing changes.
function settle(spec, dir, s) {
  let changed = false;
  do { propagate(spec, dir, s); } while (decideLoops(spec, dir, s) && (changed = true));
  return changed;
}

// ${prev.node.field}: that loop node's value in the previous round, null in round 1.
function prevValue(spec, s, p, f) {
  const snap = s.history[spec.loopOf[p]]?.at(-1);
  if (!snap) return null;
  const list = instances(snap, p).filter(i => i.result !== undefined && !i.dropped).map(i => i.result[f] ?? null);
  return 'for_each' in spec.nodes[p] ? list : list[0] ?? null;
}

function substitute(text, s, item, spec) {
  // One pass over the template with callback replacements, so inserted values stay literal.
  return text.replace(/\$\{prev\.([a-z0-9_-]+)\.([A-Za-z_]\w*)\}|\$\{([a-z0-9_-]+)\.([A-Za-z_]\w*)\}|\{item\}/gi, (m, pp, pf, p, f) => {
    if (pp) return show(prevValue(spec, s, pp, pf));
    if (!p) return show(item);
    if (p === 'inputs') return show(s.inputs[f]);
    if (p in s.skipped) return 'null';
    const list = survivors(s, p);
    // A single instance gives its value; a fan-out gives the JSON list of its surviving values.
    return s.admitted[p].length === 1 && !('for_each' in spec.nodes[p]) ? show(list[0]?.result[f]) : JSON.stringify(list.map(i => i.result[f]));
  });
}

function inputFor(spec, s, name) {
  const node = spec.nodes[name]; const input = {};
  for (const { node: p, field } of [].concat(node.in ?? []).flatMap(refs)) {
    if (p === 'inputs') { input.inputs = { ...input.inputs, [field]: s.inputs[field] }; continue; }
    if (p in s.skipped) { input[p] = { ...input[p], [field]: null }; continue; }
    const fanOut = 'for_each' in spec.nodes[p];
    // Each fan-out instance keeps every field the consumer asked for.
    if (fanOut) input[p] = survivors(s, p).map((i, n) => ({ ...(input[p]?.[n] ?? { index: i.index, item: i.item }), [field]: i.result[field] }));
    else input[p] = { ...input[p], [field]: survivors(s, p)[0]?.result[field] };
  }
  // needs: gives each survivor's output file and a one-line summary; the consumer reads the file when it needs the detail.
  for (const p of node.needs ?? []) input[p] = survivors(s, p).map(i => ({ index: i.index, item: i.item, file: i.file, summary: i.summary }));
  return input;
}

function admit(spec, dir, s, name) {
  const node = spec.nodes[name];
  let items;
  if (typeof node.for_each === 'string') {
    const [{ node: p, field }] = refs(node.for_each);
    items = survivors(s, p).flatMap(i => [].concat(i.result[field] ?? []).map(item => ({ item, src: { node: p, index: i.index } })));
    const used = usedAgents(spec, s);
    const L = spec.loopOf[name];
    // this node's own later rounds keep their static share too
    const reserve = reserved(spec, s, n => n === name) + (L ? spec.loops[L].max_rounds - (s.round[L] ?? 1) : 0);
    const room = Math.max(0, spec.limits.max_agents - used - reserve);
    // order the whole list first, so trimming never turns a real id into an unknown one
    const problem = node.after ? orderItems(items, node.after) : null;
    if (items.length > room) {
      emit(dir, s, { type: 'cap-skipped', node: name, count: items.length - room });
      const kept = items.slice(0, room); const cut = new Set(items.slice(room).map(it => it.item?.[node.after]));
      const remap = new Map(kept.map((it, n) => [items.indexOf(it), n]));
      emit(dir, s, { type: 'admit', node: name, count: kept.length, items: kept.map(it => ({ ...it, ...(it.deps ? { deps: it.deps.filter(d => remap.has(d)).map(d => remap.get(d)) } : {}) })) });
      if (problem) { kept.forEach((_, index) => emit(dir, s, { type: 'failed', node: name, index, attempt: 1, reason: problem, final: true })); return; }
      // an item that waits for a trimmed item can't run; everything else still can
      kept.forEach((it, index) => { const missing = [].concat(it.item?.after ?? []).find(id => cut.has(id));
        if (node.after && missing !== undefined) emit(dir, s, { type: 'failed', node: name, index, attempt: 1, reason: `blocked by ${missing} (cap-skipped)`, final: true }); });
      return;
    }
    emit(dir, s, { type: 'admit', node: name, count: items.length, items });
    if (problem) items.forEach((_, index) => emit(dir, s, { type: 'failed', node: name, index, attempt: 1, reason: problem, final: true }));
    return;
  }
  items = (Array.isArray(node.for_each) ? node.for_each : [null]).map(item => ({ item, src: null }));
  const problem = node.after ? orderItems(items, node.after) : null;
  emit(dir, s, { type: 'admit', node: name, count: items.length, items });
  if (problem) items.forEach((_, index) => emit(dir, s, { type: 'failed', node: name, index, attempt: 1, reason: problem, final: true }));
}

// after: give each item the indices of the items it waits for. Returns a reason when the list can't be ordered.
function orderItems(items, field) {
  const at = new Map();
  for (const [n, { item }] of items.entries()) {
    if (!item || typeof item !== 'object' || typeof item[field] !== 'string') return `after: every item must be an object with "${field}"`;
    if (at.has(item[field])) return `after: duplicate id "${item[field]}"`;
    at.set(item[field], n);
  }
  for (const it of items) {
    const names = [].concat(it.item.after ?? []);
    const unknown = names.find(id => !at.has(id));
    if (unknown !== undefined) return `after: unknown id "${unknown}"`;
    it.deps = names.map(id => at.get(id));
  }
  const state = [];
  const visit = n => { if (state[n] === 2) return false; if (state[n] === 1) return true; state[n] = 1;
    const loop = items[n].deps.some(visit); state[n] = 2; return loop; };
  return items.some((_, n) => visit(n)) ? 'after: the items\' after lists form a cycle' : null;
}

function nextUnlocked(spec, dir, overrides = {}, { cwd = process.cwd(), resume = false } = {}) {
  const s = fold(dir);
  if (!s.started) {
    const inputs = { ...spec.inputs, ...overrides };
    for (const [k, v] of Object.entries(inputs)) if (String(v).startsWith('-')) throw new Error(`input "${k}" must not start with "-"`);
    emit(dir, s, { type: 'spec', name: spec.name, engine: 2, nodes: spec.order, edges: spec.edges, inputs, cwd, ...(Object.keys(spec.loops).length ? { loops: spec.loops } : {}),
      after: Object.fromEntries(spec.order.filter(n => spec.nodes[n].after).map(n => [n, spec.nodes[n].after])) });
  }
  const tasks = []; const offered = new Set();
  for (let changed = true; changed;) {
    changed = false;
    for (const name of spec.order) {
      if (name in s.blocked || name in s.skipped || !spec.edges[name].every(d => settledFor(s, name, d))) continue;
      const node = spec.nodes[name];
      if (!(name in s.admitted)) {
        if (node.when && !holds(s, node.when)) { emit(dir, s, { type: 'skipped', node: name, reason: 'when false' }); changed = true; continue; }
        admit(spec, dir, s, name);
        propagate(spec, dir, s); // an admission that failed every item blocks its consumers before they are reached
      }
      const taskType = isAgent(node) ? 'agent' : 'run' in node ? 'run' : 'parent';
      const list = instances(s, name);
      for (const i of list) {
        const attempt = (i.failures ?? 0) + 1; const id = key(name, i.index);
        if (i.settled || offered.has(id)) continue;
        const resumed = (i.attempts ?? []).includes(attempt);
        // an open parent task comes back from every next, so the orchestrator can pick it up after a break;
        // an open agent or run task only with resume, so a polling orchestrator never dispatches it twice
        if (resumed && taskType !== 'parent' && !resume) continue;
        if (i.deps && !i.deps.every(d => list[d].result !== undefined && !list[d].dropped)) continue;
        if (!resumed) emit(dir, s, { type: 'dispatch', node: name, index: i.index, attempt, taskType, item: i.item, src: i.src });
        offered.add(id);
        const round = roundOf(s, name);
        if (taskType === 'run') { tasks.push({ node: name, index: i.index, attempt, round, taskType, argv: argvFor(node.run, s) }); continue; }
        const input = inputFor(spec, s, name);
        if (i.deps) input.after = i.deps.map(d => ({ id: list[d].item[node.after], file: list[d].file, summary: list[d].summary }));
        const task = { node: name, index: i.index, attempt, round, taskType, item: i.item, prompt: substitute(node.agent ?? node.parent, s, i.item, spec), input,
          graph: join(resolve(dir), 'nodes', 'index.md'), ...(resumed ? { resumed: true } : {}) };
        tasks.push(taskType === 'agent' ? { ...task, kind: node.kind ?? 'agentic', pick: node.pick ?? null, model: node.model ?? null } : task);
      }
    }
    if (settle(spec, dir, s)) changed = true;
  }
  return tasks;
}

// when: true only when the referenced node has a survivor whose field equals the literal.
function holds(s, text) {
  const { node, field, literal } = condition(text);
  const survivor = survivors(s, node)[0];
  return !!survivor && survivor.result[field] === literal;
}

const argvFor = (argv, s, file) => argv.map(a => a === '${file}' ? file : String(a).replace(/^\$\{inputs\.(\w+)\}$/, (_, k) => String(s.inputs[k])));

function exec(spec, dir, name) {
  const s = fold(dir);
  const i = s.inst[key(name)] ?? { failures: 0 };
  const attempt = i.failures + 1;
  const argv = argvFor(spec.nodes[name].run, s.started ? s : { inputs: spec.inputs });
  const r = spawnSync(argv[0], argv.slice(1), { shell: false, cwd: s.cwd ?? undefined, encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  const round = roundOf(s, name); // a run node inside a loop reports its round like any other task
  if (r.status === 0) return { output: { text: r.stdout }, writes: done(spec, dir, { node: name, round, output: { text: r.stdout } }).writes };
  const reason = (r.error?.message || r.stderr || `exit ${r.status}`).trim().slice(-500);
  done(spec, dir, { node: name, round, failed: reason, final: attempt >= 2 });
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

function doneUnlocked(spec, dir, result) {
  const s = fold(dir);
  const { node: name, index = 0 } = result;
  const node = spec.nodes[name];
  if (!node) throw new Error(`${name}: unknown node`);
  // a report from an earlier round is stale, whatever its index
  if (result.round !== undefined && result.round !== roundOf(s, name)) return { writes: [], duplicate: true };
  // attempt numbers restart each round, so after round 1 a report without its round can't be told from a late one
  if (result.round === undefined && roundOf(s, name) > 1) throw new Error(`${key(name, index)}: a loop node's report must carry its round`);
  // index becomes part of a file path, so only an admitted instance may report
  if (!Number.isInteger(index) || index < 0 || index >= (s.admitted[name]?.length ?? 0)) throw new Error(`${name}#${index}: no such instance`);
  const current = s.inst[key(name, index)] ?? {};
  if (current.settled) return { writes: [], duplicate: true };
  // A child's report need not repeat its model: the latest pick for this instance supplies it.
  const picked = (s.picks[name] ?? []).filter(p => p.index === index).at(-1);
  const model = result.model ?? picked?.model; const provider = result.provider ?? picked?.provider;
  // A report naming an attempt older than the one now running is stale, success or failure.
  if (result.attempt !== undefined && result.attempt <= (current.failures ?? 0)) return { writes: [], duplicate: true };
  if (result.failed !== undefined) {
    const reported = (current.failures ?? 0) >= (current.attempts ?? []).length; // older attempts were rejected above
    if (reported) return { writes: [], duplicate: true }; // this attempt's failure was already recorded
    emit(dir, s, { type: 'failed', node: name, index, attempt: (current.failures ?? 0) + 1, reason: result.failed, final: !!result.final, model });
    if (result.final) settle(spec, dir, s);
    return { writes: [] };
  }
  for (const f of node.out ?? []) if (!(f in (result.output ?? {}))) throw new Error(`${key(name, index)}: output missing "${f}"`);
  const attachments = checkAttachments(key(name, index), result.attachments);
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
    writeFileSync(file, header + show(result.output.body ?? result.output.text ?? result.output));
    write = { id, name: node.write, file, argv: argvFor(spec.writes[node.write].run, s, file) };
  }
  // The output file is written before the result event, like the write artifact, so a crash leaves the instance retryable.
  const item = instances(s, name)[index]?.item;
  const file = writeNodeFiles(dir, name, index, item, model, result.output, attachments, roundOf(s, name));
  // The result and its write reservation are one event, so no crash can record one without the other.
  // The gate verdict and any write reservation travel in the result event, so a crash can't split them.
  emit(dir, s, { type: 'result', node: name, index, output: result.output, model, provider, file, summary: summarize(result.output),
    attachments: attachments.map(a => a.name), ...(write ? { write } : {}), ...(passed ? {} : { dropped: true }) });
  if (node.gate) {
    if (!passed) emit(dir, s, { type: 'gate-dropped', node: name, index }); // for the live view
    const inst = instances(s, name)[index];
    if (inst?.src) recordOutcome(spec, dir, s, { node: name, index, src: inst.src }, passed);
  }
  settle(spec, dir, s);
  return { writes: write ? [write] : [] };
}

const runnerIn = cwd => argv => spawnSync(argv[0], argv.slice(1), { shell: false, cwd: cwd ?? undefined, encoding: 'utf8', timeout: 120000 });

function apply(spec, dir, id, runner, { mark, onClaimed } = {}) {
  const s = fold(dir);
  runner ??= runnerIn(s.cwd);
  const w = s.writes[id];
  if (!w) throw new Error(`${id}: not reserved`);
  if (mark && !['applied', 'failed'].includes(mark)) throw new Error(`${id}: mark must be applied or failed`);
  // Both paths hold the claim across the state check, the update and cleanup, so they never interleave.
  const release = claim(dir, id, `${w.file}.lock`, !!mark);
  // apply runs outside run.lock, so its s can be older than the index: rebuild the index from the log under the lock
  const record = event => { emit(dir, s, event, false); refreshIndex(dir); };
  try {
    onClaimed?.();
    const now = fold(dir).writes[id].state;
    if (now === 'applied') throw new Error(`${id}: already applied`);
    if (mark) { // the owner checked an unknown outcome by hand and records it
      record(mark === 'applied' ? { type: 'write-applied', id, marked: true } : { type: 'write-failed', id, reason: 'marked failed by owner' });
      return { ok: mark === 'applied', id };
    }
    if (now === 'applying') throw new Error(`${id}: outcome unknown; check the target, then apply with --mark applied or --mark failed`);
    record({ type: 'write-claimed', id });
    const r = runner(w.argv);
    const ok = r.status === 0;
    // Killed by timeout or a signal after it started: the effect may have happened, so the claim stays unresolved.
    // A command that never started (such as ENOENT) is an ordinary failure.
    if (!ok && (r.signal || r.error?.code === 'ETIMEDOUT')) return { ok: false, id, unknown: true };
    record(ok ? { type: 'write-applied', id } : { type: 'write-failed', id, reason: String(r.error?.message || r.stderr || `exit ${r.status}`).trim().slice(-500) });
    return { ok, id };
  } finally { release(); }
}

function status(spec, dir) {
  const s = fold(dir);
  const all = spec.order;
  const summary = { completed: all.filter(n => settled(s, n) && !impossible(s, n)), failed: s.finalFailures,
    blocked: Object.keys(s.blocked), dropped: Object.entries(s.inst).filter(([, i]) => i.dropped).map(([k]) => k),
    capSkipped: s.capSkipped, writes: s.writes, skipped: Object.keys(s.skipped),
    loops: Object.fromEntries(Object.keys(spec.loops).map(L => [L, { round: s.round[L] ?? 1, exit: s.loopExit[L] ?? null }])) };
  // the round decision is made in the same call that settles a round, so a loop node is never settled without its loop deciding
  if (!all.every(n => settled(s, n))) return { state: 'running', ...summary };
  if (spec.sinks.every(n => impossible(s, n))) return { state: 'blocked', ...summary };
  const unapplied = Object.values(s.writes).some(w => w.state !== 'applied');
  const short = Object.values(s.loopExit).some(reason => reason !== 'until');
  return { state: s.finalFailures.length || s.capSkipped.length || unapplied || short ? 'partial' : 'done', ...summary };
}

const next = (spec, dir, ...rest) => withRunLock(dir, () => nextUnlocked(spec, dir, ...rest));
const done = (spec, dir, result) => withRunLock(dir, () => doneUnlocked(spec, dir, result));

module.exports = { fold, next, exec, done, apply, status, withRunLock, refreshIndex, roundOf };
