// Graph contract: later PR #67 bot findings.
'use strict';
const { assert, writeFileSync, join, spawnSync, temp, CLI, cands } = require('./graph-fixtures.js');

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
};
