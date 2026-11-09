// Validates a parsed graph spec and returns it normalized with edges, topological order and sinks.
'use strict';

const SPEC_KEYS = new Set(['name', 'inputs', 'limits', 'writes', 'nodes']);
const NODE_KEYS = new Set(['run', 'agent', 'kind', 'in', 'needs', 'for_each', 'pick', 'model', 'out', 'gate', 'write']);
const KINDS = new Set(['code', 'code-review', 'debugging', 'architecture', 'ui-ux', 'agentic', 'reasoning', 'long-context', 'writing']);
const REF = /\$\{([a-z0-9_-]+)\.([A-Za-z_]\w*)\}/gi;
const GATE = /^\s*([A-Za-z_]\w*)\s*==\s*(true|false|-?\d+(?:\.\d+)?|"[^"]*")\s*$/;
const WHOLE_INPUT = /^\$\{inputs\.([A-Za-z_]\w*)\}$/;

const fail = message => { throw new Error(message); };
const refs = text => typeof text === 'string' ? [...text.matchAll(REF)].map(m => ({ node: m[1], field: m[2] })) : [];

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
  const limits = { max_agents: max, explore: raw.limits.explore !== false };
  const writes = raw.writes || {};
  for (const [name, w] of Object.entries(writes)) {
    if (!/^[a-z0-9-]+$/.test(name)) fail(`writes.${name}: name must match [a-z0-9-]+`);
    if (!Number.isInteger(w?.max) || w.max < 1) fail(`writes.${name}: max must be a positive integer`);
    checkArgv(`writes.${name}`, w.run, true);
  }
  const nodes = raw.nodes;
  if (!nodes || typeof nodes !== 'object' || !Object.keys(nodes).length) fail('spec: nodes must be a non-empty map');
  const names = Object.keys(nodes);
  const deps = Object.fromEntries(names.map(n => [n, new Set()]));
  let agents = 0;

  for (const [name, node] of Object.entries(nodes)) {
    for (const key of Object.keys(node)) if (!NODE_KEYS.has(key)) fail(`${name}: unknown key "${key}"`);
    if (('run' in node) === ('agent' in node)) fail(`${name}: needs exactly one of run or agent`);
    if ('agent' in node && typeof node.agent !== 'string') fail(`${name}: agent must be a string`);
    for (const k of ['kind', 'model', 'gate', 'write']) if (k in node && typeof node[k] !== 'string') fail(`${name}: ${k} must be a string`);
    for (const k of ['needs', 'out']) if (k in node && !(Array.isArray(node[k]) && node[k].every(v => typeof v === 'string'))) fail(`${name}: ${k} must be a list of names`);
    if (node.pick !== undefined) {
      if (!node.pick || typeof node.pick !== 'object' || Array.isArray(node.pick)) fail(`${name}: pick must be a map`);
      for (const k of Object.keys(node.pick)) if (!['tier', 'differ_from'].includes(k)) fail(`${name}: unknown pick key "${k}"`);
      if (node.pick.tier !== undefined && !['cheap', 'standard', 'strong', 'strongest'].includes(node.pick.tier)) fail(`${name}: unknown tier "${node.pick.tier}"`);
    }
    const isRun = 'run' in node;
    if (isRun) {
      checkArgv(name, node.run, false);
      if ('for_each' in node) fail(`${name}: for_each is only allowed on agent nodes`);
      for (const k of ['pick', 'model', 'kind']) if (k in node) fail(`${name}: ${k} is only allowed on agent nodes`);
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
    const found = [...ins.flatMap(refs), ...refs(node.agent), ...(typeof node.for_each === 'string' ? refs(node.for_each) : [])];
    if (typeof node.for_each === 'string' && !/^\$\{(?!inputs\.)[a-z0-9_-]+\.[A-Za-z_]\w*\}$/i.test(node.for_each)) fail(`${name}: for_each must be a list or one \${node.field} reference`);
    if ('for_each' in node && typeof node.for_each !== 'string' && !Array.isArray(node.for_each)) fail(`${name}: for_each must be a list or one \${node.field} reference`);
    for (const { node: dep } of found) {
      if (dep === 'inputs') continue;
      if (!Object.hasOwn(nodes, dep)) fail(`${name}: unknown node "${dep}"`);
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
    if (!isRun) agents += Array.isArray(node.for_each) ? node.for_each.length : 1;
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
  const sinks = names.filter(n => !names.some(m => deps[m].has(n)));
  return { name: raw.name, inputs: raw.inputs || {}, limits, writes, nodes, edges, order, sinks };
}

module.exports = { check, refs, GATE };
