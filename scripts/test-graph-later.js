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
};
