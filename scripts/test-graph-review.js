// Graph contract: fixes from code review round 1 (working directory, writes, substitution, validation, retries).
'use strict';
const { assert, writeFileSync, readFileSync, appendFileSync, existsSync, join, spawnSync, http, temp, PLUGIN, mod, CLI, log, NOW,
  cands, aa, data } = require('./graph-fixtures.js');

module.exports = {
  // Review round 1 (OpenAI): working directory, concurrent apply, write paths, recoverable writes,
  // literal substitution, field types and nested keys.
  C11() {
    const { check } = mod('spec.js'); const { next, done, exec, apply, status } = mod('run.js');
    const { mkdirSync } = require('node:fs');
    // commands run in the run's recorded working directory, not the caller's
    const work = temp('graph-cwd-'); const dir = temp('graph-');
    const where = check({ name: 'cwd', limits: { max_agents: 1 }, nodes: { w: { run: ['node', '-e', 'process.stdout.write(process.cwd())'] } } });
    next(where, dir, {}, { cwd: work });
    assert.equal(require('node:fs').realpathSync(exec(where, dir, 'w').output.text), require('node:fs').realpathSync(work), 'run nodes use the recorded cwd');
    // write names cannot leave the run directory
    assert.throws(() => check({ name: 'p', limits: { max_agents: 1 }, writes: { '../../x': { max: 1, run: ['echo'] } }, nodes: { a: { agent: 'a' } } }),
      /writes\.\.\.\/\.\.\/x: name must match/);
    // a failed artifact write is retried by the next done instead of being lost
    const wd = temp('graph-');
    const ws = check({ name: 'w', limits: { max_agents: 1 }, writes: { note: { max: 1, run: ['node', '-e', '0', '${file}'] } }, nodes: {
      b: { agent: 'b', out: ['body'], write: 'note' } } });
    next(ws, wd); writeFileSync(join(wd, 'writes'), 'obstruction');
    assert.throws(() => done(ws, wd, { node: 'b', output: { body: 'hi' }, model: 'm' }));
    require('node:fs').rmSync(join(wd, 'writes'));
    assert.equal(done(ws, wd, { node: 'b', output: { body: 'hi' }, model: 'm' }).writes.length, 1, 'a failed write artifact is not lost');
    // apply claims a write exclusively: a second claim while one is running is refused
    let inner;
    const r1 = apply(ws, wd, 'note#1', () => { inner = (() => { try { apply(ws, wd, 'note#1', () => ({ status: 0 })); return 'ran'; } catch (e) { return e.message; } })(); return { status: 0 }; });
    assert.equal(r1.ok, true); assert.match(inner, /note#1: (already being applied|outcome unknown)/, 'a second apply while one runs is refused');
    assert.equal(status(ws, wd).state, 'done');
    // substitution keeps data literal: $& and {item} inside values are not reinterpreted
    const sd = temp('graph-');
    const sub = check({ name: 's', limits: { max_agents: 2 }, nodes: { p: { agent: 'p', out: ['text'] }, q: { agent: 'see ${p.text} then {item}', for_each: ['x'] } } });
    next(sub, sd); done(sub, sd, { node: 'p', output: { text: 'A$&B {item}' }, model: 'm' });
    assert.equal(next(sub, sd)[0].prompt, 'see A$&B {item} then x');
    const fd = temp('graph-');
    const fe = check({ name: 'f', limits: { max_agents: 1 }, nodes: { v: { agent: 'v {item}', for_each: ['{"t":"$&"}'] } } });
    assert.equal(next(fe, fd)[0].prompt, 'v {"t":"$&"}');
    // field types and nested keys are validated
    assert.throws(() => check({ name: 't', limits: { max_agents: 1 }, nodes: { a: { agent: true } } }), /a: agent must be a string/);
    assert.throws(() => check({ name: 't', limits: { max_agents: 2 }, nodes: { a: { agent: 'a' }, b: { agent: 'b', pick: { differ_form: 'a' } } } }), /b: unknown pick key "differ_form"/);
    assert.throws(() => check({ name: 't', limits: { max_agents: 1 }, nodes: { a: { agent: 'a', pick: { tier: 'best' } } } }), /a: unknown tier "best"/);
    assert.equal(check({ name: 't', limits: { max_agents: 1 }, nodes: { a: { agent: 'a', kind: 'debugging' } } }).nodes.a.kind, 'debugging');
    // Review round 1 (Google): for_each must be one whole ${node.field} reference to another node
    assert.throws(() => check({ name: 't', limits: { max_agents: 1 }, nodes: { a: { agent: 'a {item}', for_each: '${inputs.items}' } } }), /a: for_each must be a list or one \$\{node\.field\} reference/);
    assert.throws(() => check({ name: 't', limits: { max_agents: 2 }, nodes: { p: { agent: 'p', out: ['xs'] }, a: { agent: 'a', for_each: 'x ${p.xs}' } } }), /a: for_each must be a list or one/);
    assert.throws(() => check({ name: 't', limits: { max_agents: 2 }, nodes: { p: { agent: 'p', out: ['xs'] }, a: { agent: 'a', for_each: '${p.xs} x' } } }), /a: for_each must be a list or one/, 'no trailing text');
    void mkdirSync;
    // Review round 1 (Moonshot): an apply interrupted after it started is never re-run blindly
    const id2 = temp('graph-');
    const iw = check({ name: 'iw', limits: { max_agents: 1 }, writes: { note: { max: 1, run: ['node', '-e', '0', '${file}'] } }, nodes: {
      b: { agent: 'b', out: ['body'], write: 'note' } } });
    next(iw, id2); done(iw, id2, { node: 'b', output: { body: 'hi' }, model: 'm' });
    let runs = 0;
    assert.throws(() => apply(iw, id2, 'note#1', () => { runs++; throw new Error('process killed'); }));
    require('node:fs').rmSync(join(id2, 'writes', 'note-1.md.lock'), { force: true }); // a killed process leaves no finally
    assert.throws(() => apply(iw, id2, 'note#1', () => { runs++; return { status: 0 }; }), /note#1: outcome unknown/);
    assert.equal(runs, 1, 'an interrupted write is not run again');
    assert.equal(status(iw, id2).state, 'partial');
    assert.equal(apply(iw, id2, 'note#1', null, { mark: 'applied' }).ok, true, 'the owner can record the checked outcome');
    assert.equal(runs, 1); assert.equal(status(iw, id2).state, 'done');
    // Review round 1 (Moonshot): a repeated failure report for the same attempt is ignored
    const rd = temp('graph-');
    const rs = check({ name: 'rs', limits: { max_agents: 1 }, nodes: { a: { agent: 'a' } } });
    next(rs, rd);
    done(rs, rd, { node: 'a', failed: 'x', model: 'm' });
    assert.equal(done(rs, rd, { node: 'a', failed: 'x', model: 'm' }).duplicate, true);
    assert.equal(next(rs, rd)[0].attempt, 2, 'a duplicate failure does not use up a retry');
    // another process holding the claim blocks a second apply before anything runs
    const ld = temp('graph-');
    next(iw, ld); done(iw, ld, { node: 'b', output: { body: 'hi' }, model: 'm' });
    writeFileSync(join(ld, 'writes', 'note-1.md.lock'), '');
    let held = 0;
    assert.throws(() => apply(iw, ld, 'note#1', () => { held++; return { status: 0 }; }), /note#1: already being applied/);
    assert.equal(held, 0, 'a held claim stops the write before it runs');
  },

  // Review round 2 (OpenAI): late duplicate failures, stale claims, project notes, nested keys
  C18() {
    const { check } = mod('spec.js'); const { next, done, apply, status } = mod('run.js');
    // a failure report for an older attempt is ignored even after a retry was dispatched
    const rd = temp('graph-');
    const rs = check({ name: 'rs', limits: { max_agents: 1 }, nodes: { a: { agent: 'a' } } });
    next(rs, rd); done(rs, rd, { node: 'a', attempt: 1, failed: 'x', model: 'm' });
    assert.equal(next(rs, rd)[0].attempt, 2);
    assert.equal(done(rs, rd, { node: 'a', attempt: 1, failed: 'x', model: 'm' }).duplicate, true, 'a late report for attempt 1 is ignored');
    assert.deepEqual(next(rs, rd), [], 'attempt 2 is still running, so no attempt 3');
    // --mark clears a claim left behind by a killed apply, so a confirmed failure can be retried
    const kd = temp('graph-');
    const ks = check({ name: 'ks', limits: { max_agents: 1 }, writes: { note: { max: 1, run: ['node', '-e', '0', '${file}'] } }, nodes: {
      b: { agent: 'b', out: ['body'], write: 'note' } } });
    next(ks, kd); done(ks, kd, { node: 'b', output: { body: 'hi' }, model: 'm' });
    require('node:fs').appendFileSync(join(kd, 'run.jsonl'), JSON.stringify({ t: 1, type: 'write-claimed', id: 'note#1' }) + '\n');
    const deadPid = spawnSync(process.execPath, ['-e', '0']).pid; // this process has exited
    writeFileSync(join(kd, 'writes', 'note-1.md.lock'), JSON.stringify({ pid: deadPid, host: require('node:os').hostname() })); // the killed process never ran its finally
    assert.throws(() => apply(ks, kd, 'note#1', () => ({ status: 0 })), /note#1: outcome unknown/, 'a stale claim reports an unknown outcome');
    assert.equal(apply(ks, kd, 'note#1', null, { mark: 'failed' }).ok, false);
    let ran = 0;
    assert.equal(apply(ks, kd, 'note#1', () => { ran++; return { status: 0 }; }).ok, true, 'a write confirmed failed can be retried');
    assert.equal(ran, 1); assert.equal(status(ks, kd).state, 'done');
    // the lock a real apply takes names this process and host
    const od = temp('graph-');
    next(ks, od); done(ks, od, { node: 'b', output: { body: 'hi' }, model: 'm' });
    let seen;
    apply(ks, od, 'note#1', () => { seen = JSON.parse(require('node:fs').readFileSync(join(od, 'writes', 'note-1.md.lock'), 'utf8')); return { status: 0 }; });
    assert.deepEqual(seen, { pid: process.pid, host: require('node:os').hostname() }, 'the claim lock names its owner');
    // Review round 3 (OpenAI): a claim held by a live process is never treated as abandoned
    const ld2 = temp('graph-');
    next(ks, ld2); done(ks, ld2, { node: 'b', output: { body: 'hi' }, model: 'm' });
    require('node:fs').appendFileSync(join(ld2, 'run.jsonl'), JSON.stringify({ t: 1, type: 'write-claimed', id: 'note#1' }) + '\n');
    writeFileSync(join(ld2, 'writes', 'note-1.md.lock'), JSON.stringify({ pid: process.pid, host: require('node:os').hostname() }));
    assert.throws(() => apply(ks, ld2, 'note#1', () => ({ status: 0 })), /note#1: already being applied/, 'a live claim is not an unknown outcome');
    assert.throws(() => apply(ks, ld2, 'note#1', null, { mark: 'failed' }), /note#1: still being applied by process/, 'marking cannot unlock a running write');
    assert.ok(require('node:fs').existsSync(join(ld2, 'writes', 'note-1.md.lock')), 'the live lock survives');
    // limits and writes reject unknown keys; in must be references
    assert.throws(() => check({ name: 't', limits: { max_agents: 1, explroe: false }, nodes: { a: { agent: 'a' } } }), /limits: unknown key "explroe"/);
    assert.throws(() => check({ name: 't', limits: { max_agents: 1 }, writes: { w: { max: 1, run: ['echo'], runn: 1 } }, nodes: { a: { agent: 'a' } } }), /writes\.w: unknown key "runn"/);
    assert.throws(() => check({ name: 't', limits: { max_agents: 1 }, nodes: { a: { agent: 'a', in: true } } }), /a: in must be a \$\{node\.field\} reference or a list of them/);
    // Review round 2 (Moonshot): a block scalar's trailing newline does not slip past the whole-reference rule
    assert.throws(() => check({ name: 't', limits: { max_agents: 2 }, nodes: { p: { agent: 'p', out: ['xs'] }, a: { agent: 'a', for_each: '${p.xs}\n' } } }), /a: for_each must be a list or one/);
    // Review round 2 (Moonshot): a result and its write reservation are one event, so a crash cannot lose the write
    const cd = temp('graph-');
    const cs = check({ name: 'cs', limits: { max_agents: 1 }, writes: { note: { max: 1, run: ['node', '-e', '0', '${file}'] } }, nodes: {
      b: { agent: 'b', out: ['body'], write: 'note' } } });
    next(cs, cd);
    const { writes } = done(cs, cd, { node: 'b', output: { body: 'hi' }, model: 'm' });
    const logged = require('node:fs').readFileSync(join(cd, 'run.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
    const res = logged.find(e => e.type === 'result' && e.node === 'b');
    assert.equal(res.write?.id, writes[0].id, 'the result event carries its write reservation');
    assert.equal(logged.filter(e => e.type === 'write-reserved').length, 0);
  },

  async C19() {
    const { loadAll } = mod('data.js');
    // pick reads project notes from the run's recorded directory, not the caller's
    const project = temp('graph-project-');
    require('node:fs').mkdirSync(join(project, '.agents'));
    writeFileSync(join(project, '.agents', 'model-notes.yaml'), 'models:\n  gpt-6.1-sol:\n    avoid: [code]\n');
    const all = await loadAll({ cwd: project, aaLoader: () => [], arenaLoader: async () => ({}), usageFile: undefined });
    assert.deepEqual(all.notes['gpt-6.1-sol'].avoid, ['code']);
    const work = temp('graph-cli-'); const dir = join(work, 'run'); const spec = join(work, 's.yaml');
    writeFileSync(spec, 'name: s\nlimits: { max_agents: 1, explore: false }\nnodes:\n  a:\n    agent: a\n    kind: code\n');
    const cand = join(work, 'c.json'); writeFileSync(cand, JSON.stringify(cands.slice(0, 2)));
    const usage = join(work, 'u.json'); writeFileSync(usage, JSON.stringify({ accounts: [], notes: [] }));
    const cli = (...a) => spawnSync(process.execPath, [CLI, ...a], { encoding: 'utf8', cwd: work, env: process.env });
    assert.equal(cli('next', spec, dir, '--cwd', project).status, 0);
    writeFileSync(join(process.env.PLUGIN_DATA, 'arena.json'), JSON.stringify({ fetched_at: new Date().toISOString(), data: {} }));
    const r = cli('pick', spec, dir, 'a', '0', '--candidates', cand, '--usage', usage, '--exclude', 'claude-opus-5-5');
    assert.equal(r.status, 2, 'the project avoids the only remaining model');
    assert.match(r.stderr, /avoid: gpt-6\.1-sol/);
  }
};
