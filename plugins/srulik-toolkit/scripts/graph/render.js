// Inlined into page.html by view.js. Depends on the page's el(tag, cls, text) helper.
// ---- readable output: Markdown and JSON become DOM nodes built with el(), never parsed as HTML
// ponytail: a Markdown subset (headings, paragraphs, flat lists, quotes, fences, tables, rules, code, bold, italic, http links); nested lists render flat.
// One left-to-right pass. Each closer search resumes from its cached position, so unmatched markers cost linear time overall.
function inline(text) {
  const f = document.createDocumentFragment(), next = {}, url = /https?:\/\/[^)\s]{1,2048}(?=\))/y; let last = 0, i = 0, j, m;
  const find = (s, from) => { let p = next[s]; if (p === undefined || (p !== -1 && p < from)) p = next[s] = text.indexOf(s, from); return p; };
  const emit = (node, end) => { if (i > last) f.append(text.slice(last, i)); f.append(node); i = last = end; };
  while (i < text.length) {
    const c = text[i];
    if (c === '`') { let n = 1; while (text[i + n] === '`') n++; const tick = '`'.repeat(n);
      if ((j = find(tick, i + n)) > i + n) emit(el('code', null, text.slice(i + n, j)), j + n); else i += n; }
    else if (c === '*' && text[i + 1] === '*' && (j = find('**', i + 2)) > i + 2) { const b = el('strong'); b.append(inline(text.slice(i + 2, j))); emit(b, j + 2); }
    else if (c === '[' && (j = find(']', i + 1)) > i + 1 && j - i <= 500 && text[j + 1] === '(' && ((url.lastIndex = j + 2), (m = url.exec(text)))) {
      const a = el('a', null, text.slice(i + 1, j)); a.setAttribute('href', m[0]); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); emit(a, j + 3 + m[0].length); }
    else if ((c === '*' || c === '_') && !/[\w*]/.test(text[i - 1] || '') && /[^*_\s]/.test(text[i + 1] || '') && (j = find(c, i + 1)) > i + 1
      && /\S/.test(text[j - 1]) && !/[\w*]/.test(text[j + 1] || '')) emit(el('em', null, text.slice(i + 1, j)), j + 1);
    else i++;
  }
  if (last < text.length) f.append(text.slice(last));
  return f;
}
function markdown(src, depth = 0) {
  const root = el('div', 'md'); const lines = String(src).replace(/\r\n?/g, '\n').split('\n'); let i = 0;
  const item = /^\s*(?:[-*+]|(\d+)[.)])\s+(.*)$/, cells = l => l.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
  const sep = l => /^\s*\|/.test(l) && cells(l).every(c => /^:?-+:?$/.test(c));
  const starts = l => /^\s*(```|~~~|#{1,6}\s|>|\|)/.test(l) || item.test(l) || /^\s*([-*_])(?:\s*\1){2,}\s*$/.test(l);
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = /^\s*(?:(`{3,})(?!.*`)|(~{3,}))\s*(\S*)/.exec(l))) { const mark = m[1] || m[2], body = [], close = new RegExp(`^\\s*${mark[0]}{${mark.length},}\\s*$`); i++;
      while (i < lines.length && !close.test(lines[i])) body.push(lines[i++]); i++;
      const text = body.join('\n'); if (/^json$/i.test(m[3])) { try { root.append(value(JSON.parse(text))); continue; } catch {} } root.append(el('pre', null, text)); continue; }
    if ((m = /^\s*(#{1,6})\s+(.*)$/.exec(l))) { const h = el('h' + Math.min(m[1].length + 3, 6), 'mdh'); h.append(inline(m[2].trimEnd().replace(/(?:^|\s)#+$/, '').trimEnd())); root.append(h); i++; continue; }
    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(l)) { root.append(el('hr')); i++; continue; }
    if (/^\s*>/.test(l) && depth < 20) { const q = []; while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ''));
      const b = el('blockquote'); b.append(markdown(q.join('\n'), depth + 1)); root.append(b); continue; }
    if (/^\s*\|/.test(l) && sep(lines[i + 1] || '')) { const t = el('table'), head = el('tr'); cells(l).forEach(c => { const th = el('th'); th.append(inline(c)); head.append(th); });
      t.append(head); i += 2; while (i < lines.length && /^\s*\|/.test(lines[i])) { const tr = el('tr'); cells(lines[i++]).forEach(c => { const td = el('td'); td.append(inline(c)); tr.append(td); }); t.append(tr); }
      const w = el('div', 'tw'); w.append(t); root.append(w); continue; }
    if ((m = item.exec(l))) { const list = el(m[1] ? 'ol' : 'ul'); if (m[1] && m[1] !== '1') list.setAttribute('start', m[1]);
      while (i < lines.length && (m = item.exec(lines[i]))) { let text = m[2]; i++;
        while (i < lines.length && lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && !item.test(lines[i])) text += ' ' + lines[i++].trim();
        const li = el('li'); li.append(inline(text)); list.append(li); }
      root.append(list); continue; }
    const para = [l.trim()]; i++; while (i < lines.length && lines[i].trim() && !starts(lines[i])) para.push(lines[i++].trim());
    const p = el('p'); para.forEach((t, k) => { if (k) p.append(el('br')); p.append(inline(t)); }); root.append(p);
  }
  return root;
}
// ponytail: each list or object shows its first MAX entries; Raw always has everything. Add paging if long lists become common.
const MAX = 200, more = n => `… ${n - MAX} more in Raw`;
// JSON: objects become labelled rows, lists become bullets or numbered cards, and long or multi-line strings render as Markdown.
function value(v, depth = 0) {
  if (depth > 50) return el('span', 'jv j-null', 'nested too deep, see Raw');
  if (v === null || typeof v !== 'object') {
    if (typeof v === 'string') { if (v.includes('\n') || v.length > 120) return markdown(v); const s = el('span', 'jv'); s.append(v === '' ? '(empty)' : inline(v)); return s; }
    return el('span', 'jv j-' + (v === null ? 'null' : typeof v), String(v));
  }
  if (Array.isArray(v)) {
    if (!v.length) return el('span', 'jv j-null', 'none');
    const flat = v.every(x => x === null || typeof x !== 'object'), list = el(flat ? 'ul' : 'div', flat ? null : 'jlist');
    v.slice(0, MAX).forEach((x, n) => { const li = el(flat ? 'li' : 'div', flat ? null : 'jcard'); if (!flat) li.append(el('span', 'jn', '#' + (n + 1))); li.append(value(x, depth + 1)); list.append(li); });
    if (v.length > MAX) list.append(el(flat ? 'li' : 'div', 'j-null', more(v.length)));
    return list;
  }
  const keys = Object.keys(v); if (!keys.length) return el('span', 'jv j-null', 'none');
  const dl = el('dl', 'jobj'); for (const k of keys.slice(0, MAX)) { const dd = el('dd'); dd.append(value(v[k], depth + 1)); dl.append(el('dt', null, k.replace(/_/g, ' ')), dd); }
  if (keys.length > MAX) dl.append(el('dt', null, '…'), el('dd', 'j-null', more(keys.length)));
  return dl;
}
// The readable view plus a collapsed raw copy, so nothing the agent wrote is hidden.
function readable(v) {
  const text = typeof v === 'string' ? v : JSON.stringify(v, null, 2);
  if (typeof v === 'string') { try { const j = JSON.parse(v); if (j && typeof j === 'object') v = j; } catch {} }
  const f = document.createDocumentFragment(); f.append(typeof v === 'string' ? markdown(v) : value(v));
  const raw = el('details', 'raw'); raw.append(el('summary', null, 'Raw'), el('pre', null, text)); f.append(raw);
  return f;
}
