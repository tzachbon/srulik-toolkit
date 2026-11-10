// Graph contract: fixes found by the graph's own review of PR #67 (differ_from scope, scoring watermark,
// concurrent log writers, same-indent block lists), and later Codex bot findings.
'use strict';
const { assert, writeFileSync, readFileSync, join, spawnSync, temp, mod, CLI, cands } = require('./graph-fixtures.js');

module.exports = {
  C21() {
    const { parse } = mod('yaml.js');
    // a block list at the same indent as its key is ordinary YAML
    assert.deepEqual(parse('needs:\n- verify\n- other\nx: 1\n'), { needs: ['verify', 'other'], x: 1 });
    assert.deepEqual(parse('a:\n  l:\n  - p\n  b: 2\n'), { a: { l: ['p'], b: 2 } });

    const { scoreThreads } = mod('score.js');
    const { check } = mod('spec.js'); const { next, done } = mod('run.js');
    // the score watermark stops before the oldest undecided thread
    const work = temp('graph-score-');
    const threads = [
      { updated: 100, model: 'm', kind: 'code', signals: ['pr-merged'] },
      { updated: 200, model: 'm', kind: 'code', signals: [] },
      { updated: 300, model: 'm', kind: 'code', signals: ['reverted'] }];
    const tf = join(work, 't.json'); writeFileSync(tf, JSON.stringify(threads));
    const r = spawnSync(process.execPath, [CLI, 'score', tf], { encoding: 'utf8', env: process.env });
    assert.equal(r.status, 0, r.stderr);
    const mark = JSON.parse(readFileSync(join(process.env.PLUGIN_DATA, 'score-watermark.json'), 'utf8')).since;
    assert.ok(mark < 200, 'an undecided thread is looked at again next week');
    assert.equal(mark, 199, 'scored up to just before the undecided thread');
    assert.equal(r.stdout.includes('"scored": 1'), true, 'only the thread before the undecided one is scored now');
    // Codex bot: a decided thread after an undecided one is not counted again on every run
    const again = spawnSync(process.execPath, [CLI, 'score', tf], { encoding: 'utf8', env: process.env });
    assert.match(again.stdout, /"scored": 0/, 'nothing is scored twice while the watermark waits');
    const stats = readFileSync(join(process.env.PLUGIN_DATA, 'model-stats.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter(o => o.src === 'thread');
    assert.equal(stats.length, 1, 'one outcome recorded across both runs');
    void scoreThreads;

    // parallel done calls for instances that share a write never reserve the same id
    const dir = temp('graph-');
    const spec = check({ name: 'p', limits: { max_agents: 2 }, writes: { note: { max: 2, run: ['node', '-e', '0', '${file}'] } }, nodes: {
      s: { agent: 's {item}', for_each: ['x', 'y'], out: ['body'], write: 'note' } } });
    next(spec, dir);
    const G = join(__dirname, '..', 'plugins', 'srulik-toolkit', 'scripts', 'graph');
    const script = `
      // widen the window between reading the log and appending to it, as a slow disk would (patched before run.js loads)
      const fs=require('node:fs'); const realWrite=fs.writeFileSync;
      fs.writeFileSync=(...a)=>{ if (String(a[0]).includes('writes')) { const until=Date.now()+400; while(Date.now()<until){} } return realWrite(...a); };
      const {check}=require(${JSON.stringify(join(G, 'spec.js'))});
      const run=require(${JSON.stringify(join(G, 'run.js'))});
      const spec=check(${JSON.stringify({ name: 'p', limits: { max_agents: 2 }, writes: { note: { max: 2, run: ['node', '-e', '0', '${file}'] } }, nodes: { s: { agent: 's {item}', for_each: ['x', 'y'], out: ['body'], write: 'note' } } })});
      const i=Number(process.argv[1]);
      process.stdout.write(JSON.stringify(run.done(spec, ${JSON.stringify(dir)}, {node:'s',index:i,output:{body:'b'+i},model:'m'})));`;
    const { spawn } = require('node:child_process');
    return Promise.all([0, 1].map(i => new Promise(ok => { let o = ''; const c = spawn(process.execPath, ['-e', script, String(i)]);
      c.stdout.on('data', d => { o += d; }); c.on('close', () => ok(JSON.parse(o))); })))
      .then(results => {
        const ids = results.flatMap(x => x.writes.map(w => w.id)).sort();
        assert.deepEqual(ids, ['note#1', 'note#2'], 'concurrent done calls reserve distinct writes');
        assert.notEqual(readFileSync(results[0].writes[0].file, 'utf8'), readFileSync(results[1].writes[0].file, 'utf8'));
      });
  },

  async C22() {
    // differ_from excludes only the creator that produced this item, not every review instance
    const { SOURCE } = require('../plugins/srulik-toolkit/scripts/models.js');
    const { aa } = require('./graph-fixtures.js');
    const work = temp('graph-df-'); const dir = join(work, 'run');
    writeFileSync(join(process.env.PLUGIN_DATA, 'models.json'), JSON.stringify({ source: SOURCE, fetched_at: new Date().toISOString(), models: aa }));
    writeFileSync(join(process.env.PLUGIN_DATA, 'arena.json'), JSON.stringify({ fetched_at: new Date().toISOString(), data: {} }));
    const spec = join(work, 'p.yaml');
    writeFileSync(spec, ['name: p', 'limits: { max_agents: 8, explore: false }', 'nodes:',
      '  review:', '    agent: r {item}', '    kind: code-review', '    for_each: [a, b]', '    out: [findings]',
      '  verify:', '    agent: v {item}', '    kind: code', '    for_each: ${review.findings}', '    out: [ok]', '    gate: ok == true',
      '    pick: { differ_from: review }', ''].join('\n'));
    const c = join(work, 'c.json'); writeFileSync(c, JSON.stringify(cands.slice(0, 2)));
    const u = join(work, 'u.json'); writeFileSync(u, JSON.stringify({ accounts: [], notes: [] }));
    const cli = (...a) => spawnSync(process.execPath, [CLI, ...a], { encoding: 'utf8', env: process.env });
    cli('next', spec, dir);
    // review#0 on Anthropic, review#1 on OpenAI (pinned through --exclude)
    assert.equal(JSON.parse(cli('pick', spec, dir, 'review', '0', '--candidates', c, '--usage', u).stdout).creator, 'Anthropic');
    assert.equal(JSON.parse(cli('pick', spec, dir, 'review', '1', '--candidates', c, '--usage', u, '--exclude', 'claude-opus-5-5').stdout).creator, 'OpenAI');
    for (const [i, model] of [[0, 'claude-opus-5-5'], [1, 'gpt-6.1-sol']]) {
      const f = join(work, `r${i}.json`); writeFileSync(f, JSON.stringify({ node: 'review', index: i, output: { findings: [{ id: i }] }, model }));
      assert.equal(cli('done', spec, dir, f).status, 0);
    }
    cli('next', spec, dir);
    const v0 = cli('pick', spec, dir, 'verify', '0', '--candidates', c, '--usage', u);
    assert.equal(v0.status, 0, v0.stderr);
    assert.equal(JSON.parse(v0.stdout).creator, 'OpenAI', "verify#0 checks review#0's finding, so only Anthropic is excluded");
    const v1 = cli('pick', spec, dir, 'verify', '1', '--candidates', c, '--usage', u);
    assert.equal(v1.status, 0, v1.stderr);
    assert.equal(JSON.parse(v1.stdout).creator, 'Anthropic', "verify#1 checks review#1's finding, so only OpenAI is excluded");
  },

  C23() {
    // the graph's security review: --mark holds the claim lock, so it can never unlink a lock another apply just took
    const { check } = mod('spec.js'); const { next, done, apply } = mod('run.js');
    const dir = temp('graph-');
    const spec = check({ name: 'm', limits: { max_agents: 1 }, writes: { note: { max: 1, run: ['node', '-e', '0', '${file}'] } }, nodes: {
      b: { agent: 'b', out: ['body'], write: 'note' } } });
    next(spec, dir); done(spec, dir, { node: 'b', output: { body: 'hi' }, model: 'm' });
    const lock = join(dir, 'writes', 'note-1.md.lock');
    let seenDuringMark = null;
    // a runner-free mark: observe the lock while the mark is being recorded
    const fs = require('node:fs'); const realAppend = fs.appendFileSync;
    apply(spec, dir, 'note#1', null, { mark: 'failed', onClaimed: () => { seenDuringMark = fs.existsSync(lock) ? JSON.parse(fs.readFileSync(lock, 'utf8')).pid : null; } });
    void realAppend;
    assert.equal(seenDuringMark, process.pid, 'mark holds the claim lock while it records the outcome');
    assert.equal(fs.existsSync(lock), false, 'mark releases its own lock');
    // while another live process holds the claim, mark is refused and the lock is left alone
    writeFileSync(lock, JSON.stringify({ pid: process.pid, host: require('node:os').hostname() }));
    assert.throws(() => apply(spec, dir, 'note#1', null, { mark: 'failed' }), /note#1: still being applied/);
    assert.ok(fs.existsSync(lock), 'a live lock is never removed by mark');
    fs.rmSync(lock);
    // CodeRabbit: a gate drop is part of the result event, so a crash between two appends can't keep a refuted item
    const gd = temp('graph-');
    const gs = check({ name: 'g', limits: { max_agents: 1 }, nodes: { v: { agent: 'v', out: ['ok'], gate: 'ok == true' } } });
    next(gs, gd); done(gs, gd, { node: 'v', output: { ok: false }, model: 'm' });
    const res = fs.readFileSync(join(gd, 'run.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse).find(e => e.type === 'result');
    assert.equal(res.dropped, true, 'the result event records the gate drop');
    // CodeRabbit: a reference to a run node's output must name `text`
    assert.throws(() => check({ name: 'r', limits: { max_agents: 1 }, nodes: { f: { run: ['echo'] }, a: { agent: 'a', in: '${f.txt}' } } }), /a: run node "f" outputs only "text"/);
  },

  C24() {
    // Codex bot: a prompt reference to a fan-out producer receives its values, not a bare placeholder
    const { check } = mod('spec.js'); const { next, done } = mod('run.js');
    const dir = temp('graph-');
    const spec = check({ name: 'f', limits: { max_agents: 3 }, nodes: {
      p: { agent: 'p {item}', for_each: ['x', 'y'], out: ['text'] }, c: { agent: 'Summarize ${p.text}' } } });
    next(spec, dir);
    done(spec, dir, { node: 'p', index: 0, output: { text: 'one' }, model: 'm' });
    done(spec, dir, { node: 'p', index: 1, output: { text: 'two' }, model: 'm' });
    assert.equal(next(spec, dir)[0].prompt, 'Summarize ["one","two"]', 'fan-out values are listed in the prompt');
  },

  async C25() {
    // Codex bot: an `in: ${inputs.k}` reference reaches the child's structured input
    const { check } = mod('spec.js'); const { next } = mod('run.js');
    const qd = temp('graph-');
    const qs = check({ name: 'q', inputs: { question: 'why?' }, limits: { max_agents: 1 }, nodes: { a: { agent: 'answer', in: '${inputs.question}' } } });
    assert.deepEqual(next(qs, qd)[0].input, { inputs: { question: 'why?' } }, 'declared inputs are delivered');

    // Codex bot: two processes reclaiming the same dead run lock never both enter
    const dir = temp('graph-'); const os = require('node:os');
    const dead = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' }).stdout;
    writeFileSync(join(dir, 'run.lock'), JSON.stringify({ pid: Number(dead), host: os.hostname() }));
    const raw = { name: 'l', limits: { max_agents: 1 }, nodes: { a: { agent: 'a' } } };
    const G = join(__dirname, '..', 'plugins', 'srulik-toolkit', 'scripts', 'graph');
    const script = `
      // widen the windows after reading the lock and before appending, as a slow disk would (patched before run.js loads);
      // process 1 is slower, so it acts on the dead lock after process 0 has cleared it and taken a new one
      const fs=require('node:fs'); const wait=ms=>{const u=Date.now()+ms;while(Date.now()<u){}};
      const rf=fs.readFileSync; fs.readFileSync=(...a)=>{ const r=rf(...a); if (String(a[0]).endsWith('run.lock')) wait(300 * (1 + Number(process.argv[1]))); return r; };
      const ap=fs.appendFileSync; fs.appendFileSync=(...a)=>{ wait(300); return ap(...a); };
      const {check}=require(${JSON.stringify(join(G, 'spec.js'))}); const run=require(${JSON.stringify(join(G, 'run.js'))});
      process.stdout.write(JSON.stringify(run.next(check(${JSON.stringify(raw)}), ${JSON.stringify(dir)})));`;
    const { spawn } = require('node:child_process');
    await Promise.all([0, 1].map(i => new Promise(ok => { const c = spawn(process.execPath, ['-e', script, String(i)]);
      c.on('close', ok); })));
    const dispatched = readFileSync(join(dir, 'run.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter(e => e.type === 'dispatch');
    assert.equal(dispatched.length, 1, 'one dispatch across both reclaimers');
  },
};
