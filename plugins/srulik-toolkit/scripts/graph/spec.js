// Validates a parsed graph spec and returns it normalized with edges, topological order and sinks.
'use strict';

const SPEC_KEYS = new Set(['name', 'inputs', 'limits', 'writes', 'loops', 'nodes']);
const NODE_KEYS = new Set(['run', 'agent', 'parent', 'after', 'when', 'kind', 'in', 'needs', 'for_each', 'pick', 'model', 'out', 'gate', 'write']);
const KINDS = new Set(['code', 'code-review', 'debugging', 'architecture', 'ui-ux', 'agentic', 'reasoning', 'long-context', 'writing']);
const REF = /\$\{([a-z0-9_-]+)\.([A-Za-z_]\w*)\}/gi;
const GATE = /^\s*([A-Za-z_]\w*)\s*==\s*(true|false|-?\d+(?:\.\d+)?|"[^"]*")\s*$/;
const WHOLE_INPUT = /^\$\{inputs\.([A-Za-z_]\w*)\}$/;

const COND = /^\s*([a-z0-9_-]+)\.([A-Za-z_]\w*)\s*==\s*(true|false|-?\d+(?:\.\d+)?|"[^"]*")\s*$/i;
const fail = message => { throw new Error(message); };
const RESERVED = new Set(['inputs', 'prev']);
const refs = text => typeof text === 'string' ? [...text.matchAll(REF)].map(m => ({ node: m[1], field: m[2] })) : [];
// ${prev.node.field}: a loop node's value from the previous round. It adds no edge.
const PREV = /\$\{prev\.([a-z0-9_-]+)\.([A-Za-z_]\w*)\}/gi;
const prevRefs = text => typeof text === 'string' ? [...text.matchAll(PREV)].map(m => ({ node: m[1], field: m[2] })) : [];
const condition = text => { const m = COND.exec(text); return m && { node: m[1], field: m[2], literal: JSON.parse(m[3]) }; };

function checkArgv(where, argv, allowFile) {
  if (!Array.isArray(argv) || !argv.length) fail(`${where}: run must be a list`);
  for (const arg of argv) {
    const text = String(arg);
    if (!text.includes('${')) continue;
    if (WHOLE_INPUT.test(text) || (allowFile && text === '${file}')) continue;
    fail(`${where}: run may reference only \${inputs.<k>}${allowFile ? ' or ${file}' : ''} as a whole element`);
  }
}

function check(raw) {
  if (!raw || typeof raw !== 'object') fail('spec must be a map');
  for (const key of Object.keys(raw)) if (!SPEC_KEYS.has(key)) fail(`spec: unknown key "${key}"`);
  if (typeof raw.name !== 'string' || !/^[a-z0-9-]+$/.test(raw.name)) fail('spec: name must match [a-z0-9-]+');
  const max = raw.limits?.max_agents;
  if (!Number.isInteger(max) || max < 1) fail('spec: limits.max_agents must be a positive integer');
  for (const k of Object.keys(raw.limits)) if (!['max_agents', 'explore'].includes(k)) fail(`limits: unknown key "${k}"`);
  if (raw.limits.explore !== undefined && typeof raw.limits.explore !== 'boolean') fail('limits: explore must be true or false');
  const limits = { max_agents: max, explore: raw.limits.explore !== false };
  const writes = raw.writes || {};
  for (const [name, w] of Object.entries(writes)) {
    if (!/^[a-z0-9-]+$/.test(name)) fail(`writes.${name}: name must match [a-z0-9-]+`);
    for (const k of Object.keys(w ?? {})) if (!['max', 'run'].includes(k)) fail(`writes.${name}: unknown key "${k}"`);
    if (!Number.isInteger(w?.max) || w.max < 1) fail(`writes.${name}: max must be a positive integer`);
    checkArgv(`writes.${name}`, w.run, true);
  }
  const nodes = raw.nodes;
  if (!nodes || typeof nodes !== 'object' || !Object.keys(nodes).length) fail('spec: nodes must be a non-empty map');
  const names = Object.keys(nodes);
  const deps = Object.fromEntries(names.map(n => [n, new Set()]));
  let agents = 0;

  for (const [name, node] of Object.entries(nodes)) {
    if (name === 'inputs') fail('inputs: the name "inputs" is reserved for the graph\'s inputs');
    if (name === 'prev') fail('prev: the name "prev" is reserved for previous-round references');
    // A node's name becomes its output file name, so it is lowercase (no collisions on case-insensitive disks) and has no path characters.
    if (!/^[a-z0-9_-]+$/.test(name)) fail(`${name}: node name must match [a-z0-9_-]+`);
    for (const key of Object.keys(node)) if (!NODE_KEYS.has(key)) fail(`${name}: unknown key "${key}"`);
    if (['run', 'agent', 'parent'].filter(k => k in node).length !== 1) fail(`${name}: needs exactly one of run, agent or parent`);
    for (const k of ['agent', 'parent']) if (k in node && typeof node[k] !== 'string') fail(`${name}: ${k} must be a string`);
    for (const k of ['kind', 'model', 'gate', 'write', 'after', 'when']) if (k in node && typeof node[k] !== 'string') fail(`${name}: ${k} must be a string`);
    if ('in' in node && ![].concat(node.in).every(v => typeof v === 'string' && /^\$\{[a-z0-9_-]+\.[A-Za-z_]\w*\}$/i.test(v))) fail(`${name}: in must be a \${node.field} reference or a list of them`);
    for (const k of ['needs', 'out']) if (k in node && !(Array.isArray(node[k]) && node[k].every(v => typeof v === 'string'))) fail(`${name}: ${k} must be a list of names`);
    if (node.pick !== undefined) {
      if (!node.pick || typeof node.pick !== 'object' || Array.isArray(node.pick)) fail(`${name}: pick must be a map`);
      for (const k of Object.keys(node.pick)) if (!['tier', 'differ_from'].includes(k)) fail(`${name}: unknown pick key "${k}"`);
      if (node.pick.tier !== undefined && !['cheap', 'standard', 'strong', 'strongest'].includes(node.pick.tier)) fail(`${name}: unknown tier "${node.pick.tier}"`);
    }
    const isRun = 'run' in node;
    if (!('agent' in node)) for (const k of ['for_each', 'pick', 'model', 'kind']) if (k in node) fail(`${name}: ${k} is only allowed on agent nodes`);
    if ('after' in node && !('for_each' in node)) fail(`${name}: after is only allowed with for_each`);
    if ('after' in node && !/^[A-Za-z_]\w*$/.test(node.after)) fail(`${name}: after must name an item field`);
    if (isRun) {
      checkArgv(name, node.run, false);
      if ((node.out ?? []).some(f => f !== 'text')) fail(`${name}: a run node's out may list only "text"`);
    }
    if (node.kind !== undefined && !KINDS.has(node.kind)) fail(`${name}: unknown kind "${node.kind}"`);
    if (node.pick && node.model) fail(`${name}: pick and model are mutually exclusive`);
    if (node.model !== undefined && !/^\S+ @ \S+$/.test(node.model)) fail(`${name}: model must be "<id> @ <effort>"`);
    if (node.gate !== undefined) {
      if (!GATE.test(node.gate)) fail(`${name}: gate must be field == literal`);
      if (!Array.isArray(node.out) || !node.out.includes(GATE.exec(node.gate)[1])) fail(`${name}: gate field must be listed in out`);
    }
    if (node.write !== undefined && !Object.hasOwn(writes, node.write)) fail(`${name}: unknown write "${node.write}"`);
    const ins = [].concat(node.in ?? []);
    const found = [...ins.flatMap(refs), ...refs(node.agent), ...refs(node.parent), ...(typeof node.for_each === 'string' ? refs(node.for_each) : [])];
    if (typeof node.for_each === 'string' && !/^\$\{(?!inputs\.)[a-z0-9_-]+\.[A-Za-z_]\w*\}$/i.test(node.for_each)) fail(`${name}: for_each must be a list or one \${node.field} reference`);
    if ('for_each' in node && typeof node.for_each !== 'string' && !Array.isArray(node.for_each)) fail(`${name}: for_each must be a list or one \${node.field} reference`);
    if (node.when !== undefined) {
      const c = condition(node.when);
      if (!c) fail(`${name}: when must be node.field == literal`);
      if (c.node === name) fail(`${name}: when must refer to another node`);
      if (!Object.hasOwn(nodes, c.node)) fail(`${name}: unknown node "${c.node}"`);
      if ('for_each' in nodes[c.node]) fail(`${name}: when must refer to a single-instance node`);
      if (!(nodes[c.node].out ?? []).includes(c.field) && !('run' in nodes[c.node] && c.field === 'text')) fail(`${name}: when field "${c.field}" must be listed in ${c.node}'s out`);
      deps[name].add(c.node);
    }
    for (const { node: dep, field } of found) {
      // ${prev.x} reads as node "prev"; only the three-part form, in agent or parent text, is valid
      if (dep === 'prev') fail(`${name}: \${prev.${field}} must be \${prev.<node>.<field>} in agent or parent text`);
      if (RESERVED.has(dep)) continue;
      if (!Object.hasOwn(nodes, dep)) fail(`${name}: unknown node "${dep}"`);
      if ('run' in nodes[dep] && field !== 'text') fail(`${name}: run node "${dep}" outputs only "text"`);
      deps[name].add(dep);
    }
    for (const dep of node.needs ?? []) {
      if (!Object.hasOwn(nodes, dep)) fail(`${name}: unknown node "${dep}"`);
      deps[name].add(dep);
    }
    const differ = node.pick?.differ_from;
    if (differ !== undefined) {
      if (!Object.hasOwn(nodes, differ)) fail(`${name}: differ_from names unknown node "${differ}"`);
      if (!('agent' in nodes[differ])) fail(`${name}: differ_from must name an agent node`);
      deps[name].add(differ);
    }
  }
  const { loops, loopOf } = checkLoops(raw.loops, nodes, deps);
  for (const [name, node] of Object.entries(nodes)) {
    for (const { node: p, field } of [node.agent, node.parent].flatMap(prevRefs))
      if (!loopOf[name] || loopOf[name] !== loopOf[p]) fail(`${name}: \${prev.${p}.${field}} is only allowed inside the same loop`);
    if ('agent' in node) agents += (Array.isArray(node.for_each) ? node.for_each.length : 1) * (loopOf[name] ? loops[loopOf[name]].max_rounds : 1);
  }
  if (agents > max) fail(`graph needs at least ${agents} agents; max_agents is ${max}`);

  const order = []; const state = {};
  const visit = (n, path) => {
    if (state[n] === 'done') return;
    if (state[n] === 'open') fail(`cycle: ${[...path.slice(path.indexOf(n)), n].join(' -> ')}`);
    state[n] = 'open';
    for (const d of names.filter(x => deps[n].has(x))) visit(d, [...path, n]);
    state[n] = 'done'; order.push(n);
  };
  for (const n of names) visit(n, []);
  const edges = Object.fromEntries(names.map(n => [n, [...deps[n]]]));
  // inside a loop only the until node is an output; the other loop nodes feed it
  // a consumer inside the same loop doesn't stop the until node from being the loop's output
  const consumed = n => names.some(m => deps[m].has(n) && (!loopOf[n] || loopOf[m] !== loopOf[n]));
  const sinks = names.filter(n => !consumed(n) && (!loopOf[n] || loops[loopOf[n]].until.node === n));
  return { name: raw.name, inputs: raw.inputs || {}, limits, writes, loops, loopOf, nodes, edges, order, sinks };
}

// A loop is a group of nodes that repeats as one round. Its until node is the group's only exit.
function checkLoops(raw = {}, nodes, deps) {
  if (typeof raw !== 'object' || Array.isArray(raw)) fail('loops must be a map');
  const loops = {}; const loopOf = Object.create(null);
  const reach = (from, seen = new Set()) => { for (const d of deps[from]) if (!seen.has(d)) { seen.add(d); reach(d, seen); } return seen; };
  for (const [name, l] of Object.entries(raw)) {
    const where = `loops.${name}`;
    if (!/^[a-z0-9_-]+$/.test(name)) fail(`${where}: name must match [a-z0-9_-]+`);
    for (const k of Object.keys(l ?? {})) if (!['nodes', 'until', 'max_rounds'].includes(k)) fail(`${where}: unknown key "${k}"`);
    if (!Array.isArray(l?.nodes) || !l.nodes.length) fail(`${where}: nodes must be a non-empty list`);
    if (!Number.isInteger(l.max_rounds) || l.max_rounds < 1 || l.max_rounds > 20) fail(`${where}: max_rounds must be an integer from 1 to 20`);
    const until = condition(String(l.until ?? ''));
    if (!until) fail(`${where}: until must be node.field == literal`);
    for (const n of l.nodes) {
      if (!Object.hasOwn(nodes, n)) fail(`${where}: unknown node "${n}"`);
      if (loopOf[n]) fail(`${where}: ${n} is already in loop ${loopOf[n]}`);
      loopOf[n] = name;
    }
    if (!l.nodes.includes(until.node)) fail(`${where}: until node ${until.node} must be in the loop`);
    if ('for_each' in nodes[until.node]) fail(`${where}: until node ${until.node} must be a single instance`);
    if (!(nodes[until.node].out ?? []).includes(until.field)) fail(`${where}: until field "${until.field}" must be listed in ${until.node}'s out`);
    const group = new Set(l.nodes);
    for (const n of Object.keys(nodes)) {
      if (group.has(n)) continue;
      // outside n sits between two group nodes when a group node depends on it and it depends on a group node
      if ([...reach(n)].some(d => group.has(d)) && l.nodes.some(g => deps[g].has(n) || reach(g).has(n))) fail(`${where}: ${n} is outside the loop but between its nodes`);
      for (const d of deps[n]) if (group.has(d) && d !== until.node) fail(`${where}: only ${until.node}, the until node, may have dependents outside the loop`);
    }
    loops[name] = { nodes: l.nodes, until, max_rounds: l.max_rounds };
  }
  // a loop exits only once all its nodes settle, and a node in another loop waits for that exit; so loops that
  // wait on each other deadlock even when the node graph is acyclic
  const waits = L => new Set(loops[L].nodes.flatMap(n => [...deps[n]]).map(d => loopOf[d]).filter(M => M && M !== L));
  const state = {};
  const visit = (L, path) => {
    if (state[L] === 'done') return;
    if (state[L] === 'open') fail(`loops: ${[...path.slice(path.indexOf(L)), L].join(' -> ')} wait on each other's exit`);
    state[L] = 'open'; for (const M of waits(L)) visit(M, [...path, L]); state[L] = 'done';
  };
  for (const L of Object.keys(loops)) visit(L, []);
  return { loops, loopOf };
}

module.exports = { check, refs, prevRefs, condition, GATE };
