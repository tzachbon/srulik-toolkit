// Node output files and the run index, all under <run-dir>/nodes/.
'use strict';
const { mkdirSync, writeFileSync, rmSync, renameSync } = require('node:fs');
const { join, resolve } = require('node:path');

const key = (node, index = 0) => `${node}#${index}`;
const show = v => typeof v === 'string' ? v : JSON.stringify(v);
const instances = (s, node) => (s.admitted[node] ?? []).map((it, index) => ({ index, ...it, ...(s.inst[key(node, index)] ?? {}) }));

// <run-dir>/nodes/<node>-<index>.md holds an instance's output; <run-dir>/nodes/<node>-<index>/ its attachments.
const nodeBase = (dir, node, index) => resolve(dir, 'nodes', `${node}-${index}`);
const cell = v => String(v ?? '').replace(/\s+/g, ' ').replace(/\|/g, '\\|');
// A fanned-out item is often a finding object; its title or name reads better than its JSON.
const itemLabel = v => v && typeof v === 'object' && typeof (v.title ?? v.name) === 'string' ? v.title ?? v.name : show(v);
const row = (...cells) => '|' + cells.map(c => (c = cell(c)) ? ` ${c} ` : ' ').join('|') + '|';
const clip = (v, n) => v.length > n ? v.slice(0, n - 1) + '…' : v;
// One line per output field, so a consumer can decide whether to open the file.
const summarize = output => clip(Object.entries(output ?? {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.length
  : typeof v === 'string' ? clip(v.split('\n')[0], 80) : clip(JSON.stringify(v) ?? '', 80)}`).join(' · '), 200);

function statusOf(i) {
  if (i.final) return 'failed';
  if (i.dropped) return 'dropped';
  if (i.settled) return 'done';
  if (i.failures && !(i.attempts ?? []).includes(i.failures + 1)) return `retrying (attempt ${i.failures + 1})`;
  return (i.attempts ?? []).length ? 'running' : 'waiting';
}

// The run index every agent task can read: each instance's status, model, summary and files. A derived file,
// so writing it is best-effort: a failure here must never break the state transition that triggered it.
function writeIndex(dir, s) {
  const tmp = join(dir, 'nodes', `index.md.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`);
  try {
    const rows = [];
    for (const node of s.nodes ?? []) {
      if (!(node in s.admitted)) { rows.push(row(node, '', node in s.blocked ? `blocked by ${s.blocked[node]}` : 'not started', '', '', '')); continue; }
      for (const i of instances(s, node)) {
        const file = i.file ? `nodes/${node}-${i.index}.md${i.attachments?.length ? ' + ' + i.attachments.join(', ') : ''}` : '';
        rows.push(row(key(node, i.index), i.item == null ? '' : clip(itemLabel(i.item), 80), statusOf(i), i.model, i.summary ?? i.reason, file));
      }
    }
    const inputs = Object.entries(s.inputs ?? {}).map(([k, v]) => `${k}=${show(v)}`).join(', ');
    mkdirSync(join(dir, 'nodes'), { recursive: true });
    writeFileSync(tmp, [`# ${s.name ?? 'graph'} run index`, '', `Run directory: ${resolve(dir)}`, ...(inputs ? [`Inputs: ${inputs}`] : []), ...(s.state ? [`Run state: ${s.state}`] : []), '',
      '| node | item | status | model | summary | file |', '| --- | --- | --- | --- | --- | --- |', ...rows, ''].join('\n'));
    renameSync(tmp, join(dir, 'nodes', 'index.md'));
  } catch { rmSync(tmp, { force: true }); }
}

// A child may attach up to 10 text files to its result; they are written beside its output file.
const ATTACHMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
function checkAttachments(k, list = []) {
  if (!Array.isArray(list) || list.length > 10 || !list.every(a => a && typeof a.name === 'string' && typeof a.text === 'string'))
    throw new Error(`${k}: attachments must be a list of at most 10 {name, text}`);
  for (const a of list) {
    if (!ATTACHMENT.test(a.name)) throw new Error(`${k}: attachment name "${a.name}" is invalid`);
    if (Buffer.byteLength(a.text) > 1024 * 1024) throw new Error(`${k}: attachment "${a.name}" is over 1 MB`);
  }
  return list;
}

function writeNodeFiles(dir, node, index, item, model, output, attachments) {
  const base = nodeBase(dir, node, index);
  const field = output.text != null ? 'text' : 'body', prose = output[field], json = o => '```json\n' + JSON.stringify(o, null, 2) + '\n```\n';
  const { [field]: _, ...rest } = output;
  const text = typeof prose !== 'string' ? json(output) : Object.keys(rest).length ? prose + '\n\n' + json(rest) : prose;
  mkdirSync(join(dir, 'nodes'), { recursive: true });
  writeFileSync(base + '.md', [`# ${key(node, index)}`, ...(item == null ? [] : [`item: ${show(item)}`]), ...(model ? [`model: ${model}`] : []), '', text].join('\n'));
  rmSync(base, { recursive: true, force: true });
  if (attachments.length) mkdirSync(base);
  for (const a of attachments) writeFileSync(join(base, a.name), a.text);
  return base + '.md';
}

module.exports = { key, show, instances, summarize, writeIndex, checkAttachments, writeNodeFiles };
