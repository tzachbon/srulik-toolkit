// Inlined into page.html by view.js. Depends on the page's el(tag, cls, text) helper.
// ---- readable output: Markdown and JSON become DOM nodes built with el(), never parsed as HTML
// ponytail: a Markdown subset (headings, paragraphs, flat lists, quotes, fences, tables, rules, code, bold, italic, http links); nested lists render flat.
function inline(text) {
  const f = document.createDocumentFragment(); let last = 0, m;
  const re = /`([^`]+)`|\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(?<![\w*])[*_]([^*_\s](?:[^*_]*[^*_\s])?)[*_](?![\w*])/g;
  while ((m = re.exec(text))) {
    if (m.index > last) f.append(text.slice(last, m.index));
    if (m[1] != null) f.append(el('code', null, m[1]));
    else if (m[2] != null) { const b = el('strong'); b.append(inline(m[2])); f.append(b); }
    else if (m[3] != null) { const a = el('a', null, m[3]); a.setAttribute('href', m[4]); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); f.append(a); }
    else f.append(el('em', null, m[5]));
    last = re.lastIndex;
  }
  if (last < text.length) f.append(text.slice(last));
  return f;
}
function markdown(src) {
  const root = el('div', 'md'); const lines = String(src).replace(/\r\n?/g, '\n').split('\n'); let i = 0;
  const item = /^\s*(?:[-*+]|(\d+)[.)])\s+(.*)$/, cells = l => l.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
  const starts = l => /^\s*(```|#{1,6}\s|>|\|)/.test(l) || item.test(l) || /^\s*([-*_])\s*\1\s*\1[\s\1]*$/.test(l);
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = /^\s*```\s*(\S*)/.exec(l))) { const body = []; i++; while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]); i++;
      const text = body.join('\n'); if (/^json$/i.test(m[1])) { try { root.append(value(JSON.parse(text))); continue; } catch {} } root.append(el('pre', null, text)); continue; }
    if ((m = /^\s*(#{1,6})\s+(.*)$/.exec(l))) { const h = el('h' + Math.min(m[1].length + 3, 6), 'mdh'); h.append(inline(m[2].replace(/\s*#+\s*$/, ''))); root.append(h); i++; continue; }
    if (/^\s*([-*_])\s*\1\s*\1[\s\1]*$/.test(l)) { root.append(el('hr')); i++; continue; }
    if (/^\s*>/.test(l)) { const q = []; while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ''));
      const b = el('blockquote'); b.append(markdown(q.join('\n'))); root.append(b); continue; }
    if (/^\s*\|/.test(l) && /^\s*\|?\s*:?-+/.test(lines[i + 1] || '')) { const t = el('table'), head = el('tr'); cells(l).forEach(c => { const th = el('th'); th.append(inline(c)); head.append(th); });
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
// JSON: objects become labelled rows, lists become bullets or numbered cards, and long or multi-line strings render as Markdown.
function value(v) {
  if (v === null || typeof v !== 'object') {
    if (typeof v === 'string') return v.includes('\n') || v.length > 120 ? markdown(v) : el('span', 'jv', v === '' ? '(empty)' : v);
    return el('span', 'jv j-' + (v === null ? 'null' : typeof v), String(v));
  }
  if (Array.isArray(v)) {
    if (!v.length) return el('span', 'jv j-null', 'none');
    const flat = v.every(x => x === null || typeof x !== 'object'), list = el(flat ? 'ul' : 'div', flat ? null : 'jlist');
    v.forEach((x, n) => { const li = el(flat ? 'li' : 'div', flat ? null : 'jcard'); if (!flat) li.append(el('span', 'jn', '#' + (n + 1))); li.append(value(x)); list.append(li); });
    return list;
  }
  const keys = Object.keys(v); if (!keys.length) return el('span', 'jv j-null', 'none');
  const dl = el('dl', 'jobj'); for (const k of keys) { const dd = el('dd'); dd.append(value(v[k])); dl.append(el('dt', null, k.replace(/_/g, ' ')), dd); }
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
