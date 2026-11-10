// Model resolution for one agent node: hard filters, a per-kind signal, whole-population tier floors,
// Beta posteriors from benchmark priors plus decayed outcomes, and optional Thompson sampling.
'use strict';

const DAY = 864e5;
const HALF_LIFE_DAYS = 30;
const QUOTA_LIMIT = 80;
const EVIDENCE_OVERRIDE = 10;
const TIERS = { cheap: null, standard: 0.5, strong: 0.75, strongest: 'top' };

const EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
// `(Max)` or `(xHigh, Codex Harness)` names the effort a row was measured at, so it stays as a suffix; other annotations go
function norm(value) {
  let v = String(value).toLowerCase().replace(/\(([^)]*)\)/g, (_, a) => ` ${a.split(',').map(x => x.trim()).find(x => EFFORTS.includes(x)) ?? ''} `).trim();
  const parts = v.split('/');
  const last = parts.at(-1);
  v = parts.length > 1 && /^([0-9]|[a-z][0-9])/.test(last) ? `${parts.at(-2)}-${last}` : last;
  return v.replace(/[._\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

const EFFORT = new RegExp(`-(${EFFORTS.join('|')})$`);
// With an effort, a variant measured at that effort wins, and a variant measured at another effort is
// never borrowed; the unsuffixed name (the source's default setting) still matches.
function matchName(id, names, effort) {
  const n = norm(id);
  const atEffort = effort ? names.find(c => norm(c) === `${n}-${norm(effort)}`) : undefined;
  if (atEffort !== undefined) return atEffort;
  const exact = names.find(c => norm(c) === n);
  if (exact !== undefined) return exact;
  if (EFFORT.test(n)) return matchName(n.replace(EFFORT, ''), names, effort); // `-high` names an effort, not a model
  const boundary = names.filter(c => { const m = norm(c); const tail = m.slice(n.length + 1);
    return m.startsWith(`${n}-`) && !/^[0-9]/.test(tail) && !(effort && EFFORT.test(`-${tail}`)); });
  // without an effort, the same model at some effort beats a longer, different name
  const rank = c => [EFFORT.test(`-${norm(c).slice(n.length + 1)}`) ? 0 : 1, norm(c).length];
  return boundary.sort((a, b) => rank(a)[0] - rank(b)[0] || rank(a)[1] - rank(b)[1])[0] ?? null;
}

const globMatch = (glob, id) => new RegExp(`^${glob.split('*').map(p => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(id);
function noteFor(notes, model) {
  const id = String(model).toLowerCase();
  const keys = Object.keys(notes ?? {}).filter(k => globMatch(k.toLowerCase(), id) || globMatch(k.toLowerCase(), norm(model)));
  return notes[keys.sort((a, b) => b.length - a.length)[0]] ?? {};
}

const { providerKey } = require('../models.js');
const PROVIDER_CREATORS = { anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google' }; // keyed by providerKey (claudeAgent, codex, antigravity)
const creatorKey = v => providerKey(String(v ?? ''));
const blendedPrice = m => [m?.input_usd_per_million_tokens, m?.output_usd_per_million_tokens].every(Number.isFinite)
  ? (3 * m.input_usd_per_million_tokens + m.output_usd_per_million_tokens) / 4 : Infinity;

function signalFor(kind, data) {
  const aa = field => ({ name: `aa.${field}`, values: data.aa.map(m => [m.slug, field === 'intelligence_index' ? m.intelligence_index : m.benchmarks?.[field]]) });
  const arena = (cfg, f) => ({ name: `arena.${cfg}`, values: (data.arena?.[cfg] ?? []).map(r => [r.model_name, r[f]]) });
  const chain = {
    'ui-ux': [arena('webdev', 'rating')], 'code-review': [aa('terminal_bench_4_0')], architecture: [aa('intelligence_index')],
    debugging: [aa('terminal_bench_4_0'), arena('agent', 'score')],
    agentic: [arena('agent', 'score'), aa('automation_bench')], code: [aa('terminal_bench_4_0'), arena('agent', 'score')],
    reasoning: [aa('humanitys_last_exam')], 'long-context': [aa('long_context_reasoning')], writing: [aa('gdpval_elo')],
  }[kind] ?? [aa('intelligence_index')];
  return chain.map(s => ({ ...s, values: s.values.filter(([, v]) => Number.isFinite(v)) })).filter(s => s.values.length);
}

function gamma(shape, random) {
  if (shape < 1) return gamma(shape + 1, random) * random() ** (1 / shape);
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v;
    do { const u1 = random() || 1e-12, u2 = random(); x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); v = 1 + c * x; } while (v <= 0);
    v = v ** 3; const u = random() || 1e-12;
    if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v;
  }
}
const betaSample = (a, b, random) => { const x = gamma(a, random); return x / (x + gamma(b, random)); };

function pick(node, candidates, data, ctx = {}) {
  const kind = node.kind || 'agentic';
  const tier = node.pick?.tier || 'standard';
  const now = data.now ?? Date.now();
  const filtered = [];
  const signals = signalFor(kind, data);
  let pool = candidates.map(c => {
    const aa = data.aa.find(m => m.slug === matchName(c.model, data.aa.map(x => x.slug), c.effort));
    // the creator is a fact about the model, not its effort or route: any AA row for it, else a first-party
    // provider; a proxy route alone leaves it unknown (null)
    const creator = (aa ?? data.aa.find(m => m.slug === matchName(c.model, data.aa.map(x => x.slug))))?.creator
      ?? PROVIDER_CREATORS[creatorKey(c.provider)] ?? null;
    const own = signals.map(s => { const name = matchName(c.model, s.values.map(([n]) => n), c.effort); return name === null ? null : s.values.find(([n]) => n === name)[1]; });
    const at = own.findIndex(v => v !== null);
    const sig = at === -1 ? null : signals[at];
    const score = at === -1 ? null : own[at];
    const percentile = sig ? sig.values.filter(([, v]) => v < score).length / sig.values.length : null;
    const top = sig ? Math.max(...sig.values.map(([, v]) => v)) : null;
    const ids = new Set([c.model, aa?.slug, norm(c.model)].filter(Boolean));
    const evidence = (data.outcomes ?? []).filter(o => o.kind === kind && (ids.has(o.model) || norm(o.model) === norm(c.model)))
      .reduce((acc, o) => { const w = 0.5 ** (Math.max(0, now - o.t) / DAY / HALF_LIFE_DAYS); acc.w += w; acc.ok += w * (o.ok ? 1 : 0); return acc; }, { w: 0, ok: 0 });
    const note = noteFor(data.notes, c.model);
    return { ...c, creator, aa, score, percentile, top, signal: sig?.name ?? null, evidence, note, price: blendedPrice(aa) };
  });
  const drop = (label, keep) => { const out = pool.filter(c => !keep(c)); if (out.length) filtered.push(`${label}: ${out.map(c => c.model).join(', ')}`); pool = pool.filter(keep); };
  drop('avoid', c => !(c.note.avoid ?? []).includes(kind));
  const excluded = (ctx.exclude_creators ?? []).map(creatorKey);
  drop('creator', c => !excluded.length || (c.creator !== null && !excluded.includes(creatorKey(c.creator))));
  drop('excluded', c => !(ctx.exclude_models ?? []).includes(c.model));
  // An account at the limit filters every candidate whose creator or provider instance it names.
  const hot = new Set((data.usage?.accounts ?? []).filter(a => (a.windows ?? []).some(w => w.used_percent >= QUOTA_LIMIT)).map(a => creatorKey(a.provider)));
  drop('quota', c => !hot.has(creatorKey(c.creator)) && !hot.has(creatorKey(c.provider)));

  if (node.model) {
    const [model, effort] = node.model.split(' @ ');
    const hit = pool.find(c => c.model === model);
    if (!hit) {
      if (!candidates.some(c => c.model === model)) throw new Error(`BLOCKED: pinned model ${model} is not runnable`);
      const why = filtered.find(f => f.split(': ')[1].split(', ').includes(model));
      throw new Error(`BLOCKED: pinned model ${model} is ${why?.startsWith('avoid') ? `avoided for ${kind}` : `excluded by ${why?.split(':')[0]}`}`);
    }
    return result(hit, { ...hit, effort }, false, kind, tier, filtered, data);
  }
  if (!pool.length) throw new Error(`BLOCKED: no candidate left after filters (${filtered.join('; ')})`);
  const floor = TIERS[tier];
  const meets = c => floor === null || c.evidence.w >= EVIDENCE_OVERRIDE || (c.score === null && (c.note.prefer ?? []).includes(kind))
    || (c.score !== null && (floor === 'top' ? c.score >= c.top : c.percentile >= floor));
  const eligible = pool.filter(meets);
  if (!eligible.length) throw new Error(`BLOCKED: no candidate meets tier ${tier}${filtered.length ? ` (${filtered.join('; ')})` : ''}`);

  for (const c of eligible) {
    const p = c.percentile;
    c.alpha = (p === null ? 3 : 1 + 4 * p) + c.evidence.ok;
    c.beta = (p === null ? 3 : 1 + 4 * (1 - p)) + (c.evidence.w - c.evidence.ok);
    c.mean = c.alpha / (c.alpha + c.beta);
  }
  const prefer = c => (c.note.prefer ?? []).includes(kind) ? 1 : 0;
  const order = (key) => [...eligible].sort((a, b) => key(b) - key(a) || prefer(b) - prefer(a) || a.price - b.price);
  const best = tier === 'cheap' ? [...eligible].sort((a, b) => a.price - b.price || b.mean - a.mean)[0] : order(c => c.mean)[0];
  const explore = !!data.explore && !!ctx.gated && !ctx.verifier && tier !== 'cheap';
  let chosen = best;
  if (explore) {
    const random = data.random ?? Math.random;
    const draws = new Map(eligible.map(c => [c, betaSample(c.alpha, c.beta, random)]));
    chosen = order(c => draws.get(c))[0];
  }
  return result(chosen, chosen, chosen !== best, kind, tier, filtered, data);
}

function result(c, chosen, explored, kind, tier, filtered, data) {
  return { provider: chosen.provider, model: chosen.model, effort: chosen.effort, creator: c.creator, explored,
    reason: { kind, signal: c.signal ?? 'notes-or-evidence', score: c.score, percentile: c.percentile, tier,
      evidence: Number(c.evidence.w.toFixed(2)), posterior: c.mean === undefined ? null : Number(c.mean.toFixed(3)),
      notes: c.note, filtered, quota: (data.usage?.accounts ?? []).length ? 'known' : 'unknown',
      data_age: { aa: data.aa_fetched_at ?? null, arena: data.arena?.fetched_at ?? null, arena_stale: !!data.arena?.stale } } };
}

module.exports = { matchName, pick };
