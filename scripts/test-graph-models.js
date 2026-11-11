// Graph contract: model resolution, CLI, live view, data sources and scoring. Part of the graph contract (see test-graph.js); all data is local fakes.
'use strict';
const { assert, writeFileSync, readFileSync, appendFileSync, existsSync, join, spawnSync, http, temp, PLUGIN, mod, CLI, log, NOW,
  cands, aa, data } = require('./graph-fixtures.js');

module.exports = {
  // C4: names across T3, Artificial Analysis and LMArena
  C4() {
    const { matchName } = mod('pick.js');
    assert.equal(matchName('9router/kimi/k3.1-pro', ['kimi-k3-1-pro', 'kimi-k3-low']), 'kimi-k3-1-pro');
    assert.equal(matchName('claude-opus-5-5', ['Claude Opus 5.5 (Max)', 'Claude Opus 5 (High)']), 'Claude Opus 5.5 (Max)');
    assert.equal(matchName('claude-opus-5-5', ['Claude Opus 5.5 (Max)', 'claude-opus-5-5-x']), 'Claude Opus 5.5 (Max)', 'without an effort, the same model at an annotated effort beats a longer name');
    assert.equal(matchName('gpt-6.1-sol', ['gpt-6-1-sol-mini-pro', 'gpt-6-1-sol-pro']), 'gpt-6-1-sol-pro', 'shortest boundary match wins');
    assert.equal(matchName('gpt-6', ['gpt-6-1-sol']), null, 'no match across a version token');
    assert.equal(matchName('gemini-4-argon-high', ['gemini-4-argon', 'gemini-4']), 'gemini-4-argon', 'a trailing effort level is ignored');
  },

  // R5/R7/R9: resolver
  C5() {
    const { pick } = mod('pick.js'); const d = data();
    const pinned = pick({ kind: 'code', model: 'gpt-6.1-sol @ high' }, cands, d);
    assert.equal(pinned.model, 'gpt-6.1-sol'); assert.equal(pinned.effort, 'high');
    assert.throws(() => pick({ kind: 'code', model: 'nope @ high' }, cands, d), /BLOCKED: pinned model nope is not runnable/);
    assert.throws(() => pick({ kind: 'ui-ux', model: 'gpt-6.1-sol @ high' }, cands, d), /BLOCKED: pinned model gpt-6.1-sol is avoided for ui-ux/);
    assert.throws(() => pick({ kind: 'ui-ux' }, [cands[1]], d), /BLOCKED: no candidate left after filters \(avoid: gpt-6.1-sol\)/);
    assert.equal(pick({ kind: 'ui-ux' }, cands, { ...d, aa: [] }).model, 'claude-opus-5-5', 'arena alone can decide when AA is missing');
    assert.equal(pick({ kind: 'ui-ux' }, cands, d).model, 'claude-opus-5-5');
    assert.equal(pick({ kind: 'code' }, cands, d, { exclude_creators: ['Anthropic'] }).creator, 'OpenAI');
    const full = { ...d, usage: { accounts: [{ provider: 'claude', status: 'ok', windows: [{ used_percent: 85 }] }] } };
    assert.notEqual(pick({ kind: 'code' }, cands, full).provider, 'claudeAgent');
    assert.throws(() => pick({ kind: 'code', pick: { tier: 'strongest' } }, [cands[2]], d), /BLOCKED: no candidate meets tier strongest/);
    assert.equal(pick({ kind: 'code', pick: { tier: 'cheap' } }, cands, d).model, '9router/kimi/k3.1-pro');
    const r = pick({ kind: 'code-review' }, cands, d, { gated: true });
    assert.ok(r.reason && r.reason.signal); assert.equal(r.explored, false);
    let seed = 7, draws = 0; const ex = { ...d, explore: true, random: () => (draws++, (seed = (seed * 16807) % 2147483647) / 2147483647) };
    const e = pick({ kind: 'code' }, cands, ex, { gated: true });
    assert.ok(draws > 0, 'eligible exploration samples');
    assert.equal(e.explored, e.model !== pick({ kind: 'code' }, cands, d, { gated: true }).model);
    assert.equal(pick({ kind: 'code' }, cands, { ...d, explore: true }, { gated: true, verifier: true }).explored, false);
    assert.equal(pick({ kind: 'code' }, cands, { ...d, explore: true }, { gated: false }).explored, false);
  },

  // R8: outcomes outweigh priors; 30-day half-life
  C6() {
    const { pick } = mod('pick.js'); const d = data();
    const wins = Array.from({ length: 12 }, () => ({ t: NOW, model: 'kimi-k3-1-pro', kind: 'code', ok: true }));
    const losses = Array.from({ length: 12 }, () => ({ t: NOW, model: 'claude-opus-5-5', kind: 'code', ok: false }));
    assert.equal(pick({ kind: 'code' }, cands, { ...d, outcomes: [...wins, ...losses] }).model, '9router/kimi/k3.1-pro');
    const old = losses.map(o => ({ ...o, t: NOW - 365 * 864e5 }));
    assert.equal(pick({ kind: 'code' }, cands, { ...d, outcomes: old }).model, 'claude-opus-5-5');
  },

  // R2/R5: CLI check exit codes and the pick handoff with run context (differ_from)
  C13() {
    const { SOURCE } = require(join(PLUGIN, 'scripts', 'models.js'));
    const bundled = join(PLUGIN, 'skills', 'agent-swarm', 'graphs', 'pr-review.yaml');
    assert.equal(spawnSync(process.execPath, [CLI, 'check', bundled]).status, 0);
    const work = temp('graph-cli-');
    const bad = join(work, 'bad.yaml');
    writeFileSync(bad, 'name: b\nlimits:\n  max_agents: 2\nnodes:\n  a:\n    agent: x\n    in: ${zz.out}\n');
    const br = spawnSync(process.execPath, [CLI, 'check', bad], { encoding: 'utf8' });
    assert.equal(br.status, 1); assert.match(br.stderr, /a: unknown node "zz"/);

    writeFileSync(join(process.env.PLUGIN_DATA, 'models.json'), JSON.stringify({ source: SOURCE, fetched_at: new Date().toISOString(), models: aa }));
    writeFileSync(join(process.env.PLUGIN_DATA, 'arena.json'), JSON.stringify({ fetched_at: new Date().toISOString(), data: { webdev: [], agent: [], agent_steerability: [] } }));
    const specFile = join(work, 'p.yaml'); const dir = join(work, 'run');
    writeFileSync(specFile, ['name: p', 'limits: { max_agents: 8, explore: false }', 'nodes:',
      '  review:', '    agent: r', '    kind: code-review', '    out: [findings]',
      '  verify:', '    agent: v {item}', '    kind: reasoning', '    for_each: ${review.findings}', '    out: [confirmed]',
      '    gate: confirmed == true', '    pick: { differ_from: review }', ''].join('\n'));
    const c = join(work, 'c.json'); writeFileSync(c, JSON.stringify(cands));
    const u = join(work, 'u.json'); writeFileSync(u, JSON.stringify({ accounts: [], notes: [] }));
    const run = (...a) => spawnSync(process.execPath, [CLI, ...a], { encoding: 'utf8', env: process.env });
    assert.equal(run('next', specFile, dir).status, 0);
    const p1 = run('pick', specFile, dir, 'review', '0', '--candidates', c, '--usage', u);
    assert.equal(p1.status, 0, p1.stderr); assert.equal(JSON.parse(p1.stdout).creator, 'Anthropic');
    const res = join(work, 'res.json');
    writeFileSync(res, JSON.stringify({ node: 'review', index: 0, output: { findings: [{ id: 1 }] }, model: 'claude-opus-5-5', provider: 'claudeAgent' }));
    assert.equal(run('done', specFile, dir, res).status, 0);
    assert.equal(run('next', specFile, dir).status, 0);
    const p2 = run('pick', specFile, dir, 'verify', '0', '--candidates', c, '--usage', u);
    assert.equal(p2.status, 0, p2.stderr); assert.equal(JSON.parse(p2.stdout).creator, 'OpenAI');
    assert.equal(log(dir).filter(e => e.type === 'pick').length, 2);
  },

  // R12: live view replays and streams; refuses foreign Host headers
  async C14() {
    const { serve } = mod('view.js');
    const dir = temp('view-');
    writeFileSync(join(dir, 'run.jsonl'), '{"type":"spec"}\n');
    const server = await serve(dir, 0); const port = server.address().port;
    const timers = []; const reqs = [];
    const get = (headers, onRes) => { const req = http.get({ host: '127.0.0.1', port, path: '/events', headers }, onRes); reqs.push(req); return req; };
    try {
      const forbidden = await new Promise(ok => get({ Host: 'evil.example' }, res => { res.resume(); ok(res.statusCode); }));
      assert.equal(forbidden, 403);
      let cors;
      const got = await new Promise((ok, bad) => {
        get({}, res => {
          cors = res.headers['access-control-allow-origin'];
          let text = '';
          res.on('data', chunk => { text += chunk; if (text.includes('"type":"later"')) ok(text); });
        });
        timers.push(setTimeout(() => appendFileSync(join(dir, 'run.jsonl'), '{"type":"later"}\n'), 300));
        timers.push(setTimeout(() => bad(new Error('no live event within 2s')), 2000));
      });
      assert.equal(cors, undefined);
      assert.match(got, /"type":"spec"/);
    } finally {
      timers.forEach(clearTimeout); reqs.forEach(r => r.destroy());
      server.closeAllConnections?.(); server.close();
    }
  },

  // R6: arena cache, stale fallback, forced refresh
  async C15() {
    const { loadArena } = mod('data.js');
    const cachePath = join(temp('arena-'), 'arena.json');
    const rows = rating => ({ num_rows_total: 1, rows: [{ row: { model_name: 'Claude Opus 5.5 (Max)', rating, category: 'overall' } }] });
    const ok = rating => async () => ({ ok: true, json: async () => rows(rating) });
    const pages = []; const paged = async url => {
      const offset = Number(new URL(url).searchParams.get('offset')); const length = Number(new URL(url).searchParams.get('length'));
      pages.push(offset); assert.ok(length <= 100);
      const all = Array.from({ length: 150 }, (_, i) => ({ row: { model_name: `m${i}`, rating: i, category: 'overall' } }));
      return { ok: true, json: async () => ({ num_rows_total: 150, rows: all.slice(offset, offset + length) }) };
    };
    const big = await loadArena({ fetch: paged, cachePath: join(temp('arena-'), 'a.json'), now: NOW, configs: ['webdev'] });
    assert.equal(big.webdev.length, 150, 'every page is fetched'); assert.deepEqual(pages, [0, 100]);
    const fail = async () => { throw new Error('offline'); };
    const a1 = await loadArena({ fetch: ok(1818), cachePath, now: NOW, configs: ['webdev'] });
    assert.equal(a1.webdev[0].rating, 1818); assert.equal(a1.stale, false);
    const a2 = await loadArena({ fetch: fail, cachePath, now: NOW + 2 * 864e5, configs: ['webdev'] });
    assert.equal(a2.webdev[0].rating, 1818); assert.equal(a2.stale, true);
    const a3 = await loadArena({ fetch: ok(1820), cachePath, now: NOW + 1000, configs: ['webdev'], force: true });
    assert.equal(a3.webdev[0].rating, 1820);
    // #80: a transient 502 or timeout on one page is retried instead of failing the whole refresh
    let flaky = 0;
    const blip = async url => (flaky++ === 0 ? { ok: false, status: 502 } : ok(1900)(url));
    const b = await loadArena({ fetch: blip, cachePath: join(temp('arena-'), 'b.json'), now: NOW, configs: ['webdev'] });
    assert.equal(b.stale, false, 'one 502 is retried'); assert.equal(b.webdev[0].rating, 1900); assert.equal(flaky, 2);
    let hung = 0;
    const slow = async url => { if (hung++ === 0) { const e = new Error('The operation was aborted due to timeout'); e.name = 'TimeoutError'; throw e; } return ok(1901)(url); };
    assert.equal((await loadArena({ fetch: slow, cachePath: join(temp('arena-'), 'c.json'), now: NOW, configs: ['webdev'] })).webdev[0].rating, 1901, 'one timeout is retried');
    let tries = 0;
    const down = async () => { tries++; return { ok: false, status: 503 }; };
    const d = await loadArena({ fetch: down, cachePath: join(temp('arena-'), 'd.json'), now: NOW, configs: ['webdev'] });
    assert.equal(d.stale, true, 'a persistent failure still fails'); assert.equal(tries, 3, 'retries are bounded');
    let net = 0;
    const reset = async url => { if (net++ === 0) throw new Error('ECONNRESET'); return ok(1902)(url); };
    assert.equal((await loadArena({ fetch: reset, cachePath: join(temp('arena-'), 'f.json'), now: NOW, configs: ['webdev'] })).webdev[0].rating, 1902, 'one network error is retried');
    assert.equal(net, 2);
    tries = 0;
    const kept = await loadArena({ fetch: down, cachePath, now: NOW + 3 * 864e5, configs: ['webdev'] });
    assert.equal(tries, 3); assert.equal(kept.stale, true); assert.equal(kept.webdev[0].rating, 1820, 'a persistent 503 keeps the cached rows');
    let notFound = 0;
    await loadArena({ fetch: async () => { notFound++; return { ok: false, status: 404 }; }, cachePath: join(temp('arena-'), 'e.json'), now: NOW, configs: ['webdev'] });
    assert.equal(notFound, 1, 'a 4xx is not retried');
    const { loadAll } = mod('data.js');
    const usageFile = join(temp('usage-'), 'u.json'); writeFileSync(usageFile, JSON.stringify({ accounts: [], notes: [] }));
    const all = await loadAll({ usageFile, aaLoader: () => { throw new Error('offline'); }, arenaLoader: async () => ({ webdev: [], stale: true }) });
    assert.deepEqual(all.aa, []); assert.match(all.errors.aa, /offline/); assert.deepEqual(all.usage.accounts, []);
  },

  // R15: durable state never falls back to the OS temp directory
  C16() {
    const { stateDir } = mod('data.js');
    assert.equal(stateDir({ HOME: '/home/u' }), join('/home/u', '.srulik-toolkit'));
    assert.equal(stateDir({ USERPROFILE: 'C:\\Users\\u' }), join('C:\\Users\\u', '.srulik-toolkit'));
    assert.equal(stateDir({ PLUGIN_DATA: '/p', HOME: '/home/u' }), '/p');
    assert.equal(stateDir({ CLAUDE_PLUGIN_DATA: '/c', HOME: '/home/u' }), '/c');
  },

  // R13: thread scoring keeps counts only; failure signals win; watermark skips scored threads
  C17() {
    const { scoreThreads } = mod('score.js');
    const threads = [
      { id: 't1', updated: NOW - 10, model: 'gpt-6.1-sol', kind: 'code-review', signals: ['pr-merged'], text: 'secret' },
      { id: 't2', updated: NOW, model: 'gpt-6.1-sol', kind: 'ui-ux', signals: ['user-redirect'] },
      { id: 't3', updated: NOW, model: 'claude-opus-5-5', kind: 'architecture', signals: [] },
      { id: 't4', updated: NOW, model: 'kimi-k3-1-pro', kind: 'code', signals: ['pr-merged', 'reverted'] }];
    const all = scoreThreads(threads, { now: NOW, since: 0 });
    assert.deepEqual(all.map(o => [o.model, o.kind, o.ok]),
      [['gpt-6.1-sol', 'code-review', true], ['gpt-6.1-sol', 'ui-ux', false], ['kimi-k3-1-pro', 'code', false]]);
    assert.ok(all.every(o => Object.keys(o).sort().join() === 'kind,model,ok,src,t'));
    assert.equal(scoreThreads(threads, { now: NOW, since: NOW - 5 }).length, 2);
  },

  // Review round 1 (Moonshot): the quota filter covers every provider, not only Claude and OpenAI
  C12() {
    const { pick } = mod('pick.js'); const d = data();
    const gem = [{ provider: 'antigravity', model: 'gemini-4-argon-high', effort: 'high' }, ...cands];
    const withGem = { ...d, aa: [...d.aa, { slug: 'gemini-4-argon', creator: 'Google', intelligence_index: 58, input_usd_per_million_tokens: 0.1, output_usd_per_million_tokens: 0.1, benchmarks: { terminal_bench_4_0: 0.59 } }] };
    assert.equal(pick({ kind: 'code', pick: { tier: 'cheap' } }, gem, withGem).model, 'gemini-4-argon-high');
    const hot = { ...withGem, usage: { accounts: [{ provider: 'gemini', windows: [{ used_percent: 95 }] }] } };
    assert.notEqual(pick({ kind: 'code', pick: { tier: 'cheap' } }, gem, hot).model, 'gemini-4-argon-high', 'a Google account at 95% filters Gemini');
    const byInstance = { ...withGem, usage: { accounts: [{ provider: 'oh-my-pi', windows: [{ used_percent: 90 }] }] } };
    assert.notEqual(pick({ kind: 'code', pick: { tier: 'cheap' } }, cands, byInstance).provider, 'oh-my-pi', 'a provider-instance account filters its models');
  }
};
