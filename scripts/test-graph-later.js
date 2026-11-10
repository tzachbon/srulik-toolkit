// Graph contract: later PR #67 bot findings.
'use strict';
const { assert, writeFileSync, appendFileSync, join, spawnSync, temp, mod, CLI, cands, data, aaModel } = require('./graph-fixtures.js');

module.exports = {
  C29() {
    // Codex bot: differ_from excludes only the creator of the attempt that produced the item
    const { SOURCE } = require('../plugins/srulik-toolkit/scripts/models.js');
    const { aa } = require('./graph-fixtures.js');
    const work = temp('graph-df2-'); const dir = join(work, 'run');
    writeFileSync(join(process.env.PLUGIN_DATA, 'models.json'), JSON.stringify({ source: SOURCE, fetched_at: new Date().toISOString(), models: aa }));
    writeFileSync(join(process.env.PLUGIN_DATA, 'arena.json'), JSON.stringify({ fetched_at: new Date().toISOString(), data: {} }));
    const spec = join(work, 'p.yaml');
    writeFileSync(spec, ['name: p', 'limits: { max_agents: 4, explore: false }', 'nodes:',
      '  review:', '    agent: r', '    kind: code-review', '    out: [findings]',
      '  verify:', '    agent: v {item}', '    kind: code', '    for_each: ${review.findings}', '    out: [ok]', '    gate: ok == true',
      '    pick: { differ_from: review }', ''].join('\n'));
    const c = join(work, 'c.json'); writeFileSync(c, JSON.stringify(cands.slice(0, 2)));
    const u = join(work, 'u.json'); writeFileSync(u, JSON.stringify({ accounts: [], notes: [] }));
    const cli = (...a) => spawnSync(process.execPath, [CLI, ...a], { encoding: 'utf8', env: process.env });
    cli('next', spec, dir);
    // attempt 1 on Anthropic fails; attempt 2 on OpenAI succeeds
    assert.equal(JSON.parse(cli('pick', spec, dir, 'review', '0', '--candidates', c, '--usage', u).stdout).creator, 'Anthropic');
    const f1 = join(work, 'f1.json'); writeFileSync(f1, JSON.stringify({ node: 'review', attempt: 1, failed: 'crashed' })); cli('done', spec, dir, f1);
    cli('next', spec, dir);
    assert.equal(JSON.parse(cli('pick', spec, dir, 'review', '0', '--candidates', c, '--usage', u, '--exclude', 'claude-opus-5-5').stdout).creator, 'OpenAI');
    const f2 = join(work, 'f2.json'); writeFileSync(f2, JSON.stringify({ node: 'review', attempt: 2, output: { findings: [1] } })); cli('done', spec, dir, f2);
    cli('next', spec, dir);
    const v = cli('pick', spec, dir, 'verify', '0', '--candidates', c, '--usage', u);
    assert.equal(v.status, 0, v.stderr);
    assert.equal(JSON.parse(v.stdout).creator, 'Anthropic', 'only the creator of the successful attempt is excluded');
  },

  C30() {
    // Codex bot: an Arena effort annotation in parentheses is kept, so another effort's rating is never borrowed
    const { matchName, pick } = mod('pick.js');
    assert.equal(matchName('claude-opus-5-5', ['Claude Opus 5.5 (Max)', 'Claude Opus 5.5 (Low)'], 'low'), 'Claude Opus 5.5 (Low)', 'the row at the dispatched effort wins');
    assert.equal(matchName('claude-opus-5-5', ['Claude Opus 5.5 (Max)'], 'low'), null, 'a Max rating is not used for a low-effort run');
    assert.equal(matchName('gpt-5-5', ['GPT-5.5 (High, Codex Harness)', 'GPT-5.5 (xHigh, Codex Harness)'], 'xhigh'), 'GPT-5.5 (xHigh, Codex Harness)', 'an effort among other annotations is recognized');
    assert.equal(matchName('claude-opus-4-1', ['Claude Opus 4.1 (20250805)'], 'high'), 'Claude Opus 4.1 (20250805)', 'a date annotation is still dropped');
    const d = { ...data(), arena: { webdev: [{ model_name: 'Claude Opus 5.5 (Max)', rating: 1900 }, { model_name: 'Claude Opus 5.5 (Low)', rating: 1000 },
      { model_name: 'GPT-6.1 Sol (Max)', rating: 1500 }] } };
    assert.throws(() => pick({ kind: 'ui-ux', pick: { tier: 'strongest' } }, [{ provider: 'claudeAgent', model: 'claude-opus-5-5', effort: 'low' }], d),
      /no candidate meets tier strongest/, 'a low-effort run is scored by its own rating');
  },

  C31() {
    // Codex bot: a model's creator comes from the model, not its route, so differ_from can't be bypassed by a proxy
    const { pick } = mod('pick.js');
    const sol = (provider, effort = 'high') => [{ provider, model: 'gpt-6.1-sol', effort }];
    const arenaOnly = { ...data(), aa: [], notes: {} };
    assert.throws(() => pick({ kind: 'writing', pick: { tier: 'cheap' } }, sol('oh-my-pi'), arenaOnly, { exclude_creators: ['OpenAI'] }),
      /no candidate left after filters \(creator: gpt-6.1-sol\)/, 'an unknown creator is not independent');
    assert.equal(pick({ kind: 'writing', pick: { tier: 'cheap' } }, sol('oh-my-pi'), arenaOnly).model, 'gpt-6.1-sol', 'an unknown creator still runs when no creator is excluded');
    assert.equal(pick({ kind: 'writing', pick: { tier: 'cheap' } }, sol('codex'), arenaOnly, { exclude_creators: ['Anthropic'] }).creator, 'OpenAI', 'a first-party route names its creator');
    const maxOnly = { ...data(), notes: {}, aa: [aaModel('gpt-6-1-sol-max', 'OpenAI', 57, 0.58, 0.5, 2, 10)] };
    assert.equal(pick({ kind: 'writing', pick: { tier: 'cheap' } }, sol('oh-my-pi', 'low'), maxOnly).creator, 'OpenAI', 'a benchmark row at another effort still names the creator');

    // Codex bot: `inputs` is reserved for the graph's inputs, so no node may take that name
    const { check } = mod('spec.js');
    assert.throws(() => check({ name: 'r', limits: { max_agents: 1 }, nodes: { inputs: { agent: 'p', out: ['text'] }, c: { agent: 'c', in: '${inputs.text}' } } }),
      /inputs: the name "inputs" is reserved for the graph's inputs/);
  },

  C32() {
    // Codex bot: a producer whose creator is unknown has its model excluded from the verifier instead
    const { SOURCE } = require('../plugins/srulik-toolkit/scripts/models.js');
    const { aa } = require('./graph-fixtures.js');
    const work = temp('graph-df3-'); const dir = join(work, 'run');
    writeFileSync(join(process.env.PLUGIN_DATA, 'models.json'), JSON.stringify({ source: SOURCE, fetched_at: new Date().toISOString(), models: aa }));
    writeFileSync(join(process.env.PLUGIN_DATA, 'arena.json'), JSON.stringify({ fetched_at: new Date().toISOString(), data: {} }));
    const spec = join(work, 'p.yaml');
    writeFileSync(spec, ['name: p', 'limits: { max_agents: 2, explore: false }', 'nodes:', '  review:', '    agent: r', '    out: [findings]',
      '  verify:', '    agent: v {item}', '    kind: code', '    for_each: ${review.findings}', '    pick: { differ_from: review }', ''].join('\n'));
    const cli = (...a) => spawnSync(process.execPath, [CLI, ...a], { encoding: 'utf8', env: process.env });
    cli('next', spec, dir);
    appendFileSync(join(dir, 'run.jsonl'), JSON.stringify({ t: 1, type: 'pick', node: 'review', index: 0, provider: 'oh-my-pi', model: 'gpt-6.1-sol', effort: 'high', creator: null }) + '\n');
    const f = join(work, 'f.json'); writeFileSync(f, JSON.stringify({ node: 'review', output: { findings: [1] } })); cli('done', spec, dir, f);
    cli('next', spec, dir);
    const c = join(work, 'c.json'); writeFileSync(c, JSON.stringify([cands[1]]));
    const u = join(work, 'u.json'); writeFileSync(u, JSON.stringify({ accounts: [], notes: [] }));
    const v = cli('pick', spec, dir, 'verify', '0', '--candidates', c, '--usage', u);
    assert.match(v.stderr, /BLOCKED: no candidate left after filters \(excluded: gpt-6.1-sol\)/, 'the same model on another route is not independent');
  },

  C33() {
    // Codex bot: a node named after an Object property (constructor, toString) is scheduled like any other
    const { check } = mod('spec.js'); const { next, done, status } = mod('run.js');
    const dir = temp('graph-');
    const spec = check({ name: 'p', limits: { max_agents: 2 }, nodes: { constructor: { agent: 'a', out: ['xs'] },
      toString: { agent: 'b {item}', for_each: '${constructor.xs}' } } });
    assert.deepEqual(next(spec, dir).map(t => t.node), ['constructor'], 'an inherited name is not already blocked');
    appendFileSync(join(dir, 'run.jsonl'), JSON.stringify({ t: 1, type: 'pick', node: 'constructor', index: 0, provider: 'p', model: 'm', effort: 'high', creator: 'X' }) + '\n');
    done(spec, dir, { node: 'constructor', output: { xs: [1] } });
    assert.deepEqual(next(spec, dir).map(t => t.node), ['toString'], 'its consumer fans out');
    done(spec, dir, { node: 'toString', output: {}, model: 'm' });
    assert.equal(status(spec, dir).state, 'done');
  },

  async C34() {
    // T3's Servers panel opens the view at the machine's own address, so `--host` adds that address
    const { allowedHost, serve } = mod('view.js');
    assert.equal(allowedHost('100.90.182.51:47812', '100.90.182.51', 47812), true, 'the bound address is accepted');
    // pr-review graph round 4: a server bound to another address doesn't listen on loopback, so loopback Hosts are not allowed there
    assert.equal(allowedHost('127.0.0.1:47812', '100.90.182.51', 47812), false, 'loopback is only for a loopback server');
    assert.equal(allowedHost('localhost:47812', '127.0.0.1', 47812), true, 'localhost names a loopback server');
    assert.equal(allowedHost('evil.example:47812', '100.90.182.51', 47812), false, 'any other Host is refused');
    assert.equal(allowedHost('100.90.182.51:47812', '127.0.0.1', 47812), false, 'without --host, only loopback');
    // pr-review graph: browsers send an IPv6 Host in brackets
    assert.equal(allowedHost('[fd7a:115c:a1e0::1]:47812', 'fd7a:115c:a1e0::1', 47812), true, 'a bracketed IPv6 Host is accepted');
    const server = await serve(temp('view-'), 0);
    try { assert.equal(server.address().address, '127.0.0.1', 'the default stays on loopback'); } finally { server.close(); }
    // CodeRabbit: serve itself refuses a non-private address, not only the CLI
    const wild = await serve(temp('view-'), 0, '0.0.0.0').then(s => { s.close(); return 'bound'; }, e => e.message);
    assert.match(wild, /must be a loopback or private address/, 'serve refuses a wildcard address');
    const v6 = await serve(temp('view-'), 0, '0:0:0:0:0:0:0:1');
    try {
      const status = await new Promise(ok => require('node:http').get({ host: '::1', port: v6.address().port, path: '/' }, res => { res.resume(); ok(res.statusCode); }));
      assert.equal(status, 200, 'serve canonicalizes its host, so the browser-style Host [::1] passes');
    } finally { v6.close(); }
    // pr-review graph: only a literal loopback or private address may be bound, however it is spelled
    const { privateHost } = mod('view.js');
    for (const h of ['127.0.0.1', '::1', '10.1.2.3', '172.16.4.1', '192.168.0.9', '100.90.182.51', 'fd7a:115c:a1e0::1'])
      assert.equal(privateHost(h), true, `${h} is private`);
    for (const h of ['0.0.0.0', '::', '0:0:0:0:0:0:0:0', '0', '', 'localhost', '187.124.113.123', '8.8.8.8', '100.128.0.1', '2001:db8::1', 'fc::', 'fd::', 'fc0::', 'fe00::1'])
      assert.equal(privateHost(h), false, `${h} is refused`);
    // pr-review graph round 3: any spelling of an allowed address is accepted, and the browser's canonical Host matches it
    const { canonicalHost } = mod('view.js');
    assert.equal(privateHost(canonicalHost('0:0:0:0:0:0:0:1')), true, 'expanded IPv6 loopback is loopback');
    assert.equal(canonicalHost('FD7A:115C:A1E0:0:0:0:0:1'), 'fd7a:115c:a1e0::1', 'IPv6 is lowercased and compressed');
    assert.equal(canonicalHost('100.90.182.51'), '100.90.182.51', 'IPv4 is unchanged');
    assert.equal(canonicalHost('not an address'), '', 'an invalid value becomes empty, so it is refused');
    const r = spawnSync(process.execPath, [CLI, 'view', temp('view-'), '--host', '0:0:0:0:0:0:0:0'], { encoding: 'utf8', env: process.env, timeout: 5000 });
    assert.match(r.stderr, /--host must be a loopback or private address/, 'a wildcard spelling is refused');
    const ok = spawnSync(process.execPath, ['-e', `process.argv=[process.argv[0], ${JSON.stringify(CLI)}, 'view', ${JSON.stringify(temp('view-'))}, '--host', '0:0:0:0:0:0:0:1'];
      const log=console.log; console.log=(...a)=>{ log(...a); process.exit(0); }; require(${JSON.stringify(CLI)});`], { encoding: 'utf8', env: process.env, timeout: 5000 });
    assert.match(ok.stdout, /^http:\/\/\[::1\]:\d+\/$/m, 'the CLI accepts and prints a canonical IPv6 loopback');
    // pr-review graph round 4: without --host, the CLI serves on loopback
    const plain = spawnSync(process.execPath, ['-e', `process.argv=[process.argv[0], ${JSON.stringify(CLI)}, 'view', ${JSON.stringify(temp('view-'))}];
      const log=console.log; console.log=(...a)=>{ log(...a); process.exit(0); }; require(${JSON.stringify(CLI)});`], { encoding: 'utf8', env: process.env, timeout: 5000 });
    assert.match(plain.stdout, /^http:\/\/127\.0\.0\.1:\d+\/$/m, 'the CLI defaults to loopback');
  },
};
