// Strict YAML subset for graph specs and model notes: block maps and lists, scalars,
// one-level inline [a, b] / {k: v}, `|` block scalars and # comments. Anything else is an error.
// ponytail: no folds, anchors, tags or multi-document files; add them only if a real spec needs one.
'use strict';

const fail = (n, message) => { throw new Error(`line ${n}: ${message}`); };

function stripComment(text) {
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === '\\' && quote === '"') i++; else if (c === quote) quote = null; }
    else if (c === '"' || c === "'") quote = c;
    else if (c === '#' && (i === 0 || /\s/.test(text[i - 1]))) return text.slice(0, i);
  }
  return text;
}

function scalar(raw, n) {
  const v = raw.trim();
  if (/^[&*!]/.test(v)) fail(n, v[0] === '!' ? 'tags are not supported' : 'anchors are not supported');
  if (v.startsWith('>')) fail(n, 'folded scalars are not supported');
  if (v === '' || v === 'null' || v === '~') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v.startsWith('"')) {
    if (!v.endsWith('"') || v.length < 2) fail(n, 'unterminated string');
    return v.slice(1, -1).replace(/\\(["\\nt])/g, (_, c) => ({ n: '\n', t: '\t' })[c] ?? c);
  }
  if (v.startsWith("'")) {
    if (!v.endsWith("'") || v.length < 2) fail(n, 'unterminated string');
    return v.slice(1, -1).replace(/''/g, "'");
  }
  return v;
}

function splitTop(body, n) {
  const parts = []; let quote = null; let start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quote) { if (c === '\\' && quote === '"') i++; else if (c === quote) quote = null; }
    else if (c === '"' || c === "'") quote = c;
    else if (c === '[' || c === '{') fail(n, 'nested inline collections are not supported');
    else if (c === ',') { parts.push(body.slice(start, i)); start = i + 1; }
  }
  if (quote) fail(n, 'unterminated string');
  const last = body.slice(start);
  if (last.trim() || parts.length) parts.push(last);
  return parts.map(p => p.trim()).filter((p, i, all) => p || i < all.length - 1);
}

function keyOf(text, n) {
  const m = /^("(?:[^"\\]|\\.)*"|'[^']*'|[^\s:'"][^:]*?)\s*:(?:\s+|$)/.exec(text);
  if (!m) return null;
  const key = m[1].startsWith('"') || m[1].startsWith("'") ? scalar(m[1], n) : m[1];
  return { key: String(key), rest: text.slice(m[0].length) };
}

function value(raw, n) {
  const v = raw.trim();
  if (v.startsWith('[')) {
    if (!v.endsWith(']')) fail(n, 'unterminated inline list');
    return splitTop(v.slice(1, -1), n).map(p => scalar(p, n));
  }
  if (v.startsWith('{')) {
    if (!v.endsWith('}')) fail(n, 'unterminated inline map');
    const out = {};
    for (const p of splitTop(v.slice(1, -1), n)) {
      const kv = keyOf(p, n) || fail(n, `expected key: value in "${p}"`);
      if (Object.hasOwn(out, kv.key)) fail(n, `duplicate key "${kv.key}"`);
      out[kv.key] = scalar(kv.rest, n);
    }
    return out;
  }
  return scalar(v, n);
}

function parse(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n').map((raw, i) => ({ n: i + 1, raw }));
  for (const { n, raw } of lines) {
    if (/\t/.test(raw.match(/^\s*/)[0])) fail(n, 'tabs are not allowed');
    if (/^(---|\.\.\.)\s*$/.test(raw)) fail(n, 'multiple documents are not supported');
  }
  let i = 0;
  const indentOf = s => s.match(/^ */)[0].length;
  const skip = () => { while (i < lines.length && !stripComment(lines[i].raw).trim()) i++; };

  function block(n, keyIndent) {
    const out = []; let min = Infinity;
    while (i < lines.length) {
      const { raw } = lines[i];
      if (raw.trim() && indentOf(raw) <= keyIndent) break;
      out.push(raw); if (raw.trim()) min = Math.min(min, indentOf(raw)); i++;
    }
    while (out.length && !out[out.length - 1].trim()) out.pop();
    if (!out.length) fail(n, 'empty block scalar');
    return out.map(l => l.slice(min)).join('\n') + '\n';
  }

  function node() {
    skip();
    if (i >= lines.length) return null;
    const first = stripComment(lines[i].raw);
    return first.trimStart().startsWith('- ') || first.trim() === '-' ? list(indentOf(first)) : map(indentOf(first));
  }

  function child(rest, n, indent) {
    if (rest.trim() === '|') return block(n, indent);
    if (rest.trim()) return value(rest, n);
    skip();
    if (i < lines.length && indentOf(lines[i].raw) > indent) return node();
    // A block list may sit at its key's indent (`needs:` then `- x`).
    if (i < lines.length && indentOf(lines[i].raw) === indent && /^- |^-$/.test(stripComment(lines[i].raw).trim())) return list(indent);
    return null;
  }

  function map(indent) {
    const out = {};
    for (skip(); i < lines.length; skip()) {
      const { n, raw } = lines[i];
      const text = stripComment(raw);
      const at = indentOf(text);
      if (at < indent) break;
      if (at > indent) fail(n, 'unexpected indentation');
      const kv = keyOf(text.trim(), n) || fail(n, 'expected key: value');
      if (Object.hasOwn(out, kv.key)) fail(n, `duplicate key "${kv.key}"`);
      i++;
      out[kv.key] = child(kv.rest, n, indent);
    }
    return out;
  }

  function list(indent) {
    const out = [];
    for (skip(); i < lines.length; skip()) {
      const { n, raw } = lines[i];
      const text = stripComment(raw);
      const at = indentOf(text);
      if (at < indent) break;
      if (at > indent) fail(n, 'unexpected indentation');
      const item = text.trim();
      if (!(item.startsWith('- ') || item === '-')) break;
      const rest = item.slice(1).trimStart();
      i++;
      const kv = keyOf(rest, n);
      if (kv) fail(n, 'maps inside block lists are not supported');
      out.push(child(rest, n, indent));
    }
    return out;
  }

  const result = node();
  skip();
  if (i < lines.length) fail(lines[i].n, 'unexpected content');
  return result;
}

module.exports = { parse };
