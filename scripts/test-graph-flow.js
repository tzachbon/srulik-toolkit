// Graph contract: parent tasks, loops, previous-round refs, ordered fan-out, when conditions, back-compat,
// the round-aware index and view, and the bundled task.yaml. Local fakes only.
'use strict';
const { assert, writeFileSync, readFileSync, existsSync, join, spawnSync, http, temp, mod, CLI, log, PLUGIN } = require('./graph-fixtures.js');
const { copyFileSync, appendFileSync } = require('node:fs');
const vm = require('node:vm');

const ids = tasks => tasks.map(t => `${t.node}#${t.index}`);
const events = (dir, type) => log(dir).filter(e => e.type === type);
const TASK_YAML = join(PLUGIN, 'skills', 'agent-swarm', 'graphs', 'task.yaml');

// Answer every ready task with answer(task) until nothing is left. Resumed parent tasks come back until answered.
function drive(spec, dir, answer, inputs = {}) {
  const { next, done } = mod('run.js');
  for (let guard = 0; guard < 300; guard++) {
    const tasks = next(spec, dir, inputs);
    if (!tasks.length) return;
    for (const t of tasks) {
      const output = answer(t);
      done(spec, dir, { node: t.node, index: t.index, round: t.round, attempt: t.attempt, ...(output && output.failed ? output : { output, model: 'fake' }) });
    }
  }
  throw new Error('walk did not finish');
}

const get = (port, path) => new Promise((ok, bad) => http.get({ host: '127.0.0.1', port, path, timeout: 2000 },
  res => { let body = ''; res.on('data', c => { body += c; }); res.on('end', () => ok({ status: res.statusCode, body })); })
  .on('timeout', function () { this.destroy(new Error('no response within 2 s')); }).on('error', bad));

module.exports = {
  // parent tasks: done by the orchestrator, never charged to max_agents, offered again until settled; a rejection blocks
  C40() {
    const { check } = mod('spec.js'); const { next, done, status } = mod('run.js');
    const dir = temp('graph-');
    const spec = check({ name: 'p', limits: { max_agents: 2 }, nodes: {
      a: { agent: 'a', out: ['plan'] },
      ask: { parent: 'Ask the owner about ${a.plan}', out: ['ok'], gate: 'ok == true' },
      b: { agent: 'b', needs: ['ask'] } } });
    assert.deepEqual(ids(next(spec, dir)), ['a#0'], 'parent text refs add an edge, so ask waits for a');
    done(spec, dir, { node: 'a', output: { plan: 'P1' }, model: 'm' });
    const [ask] = next(spec, dir);
    assert.equal(ask.taskType, 'parent');
    assert.equal(ask.prompt, 'Ask the owner about P1', 'parent text is substituted like an agent prompt');
    assert.equal(ask.round, 1);
    assert.equal(ask.pick, undefined, 'a parent task is not picked'); assert.equal(ask.model, undefined);
    const [again] = next(spec, dir);
    assert.ok(again, 'an open parent task comes back from every next');
    assert.equal(again.node, 'ask'); assert.equal(again.resumed, true, 'an open parent task comes back from every next');
    assert.equal(events(dir, 'dispatch').filter(e => e.node === 'ask').length, 1, 'resuming does not dispatch again');
    done(spec, dir, { node: 'ask', output: { ok: true } });
    assert.deepEqual(ids(next(spec, dir)), ['b#0']);
    done(spec, dir, { node: 'b', output: {}, model: 'm' });
    assert.equal(status(spec, dir).state, 'done');
    const base = { name: 'x', limits: { max_agents: 2 } };
    assert.throws(() => check({ ...base, nodes: { p: { parent: 'x', for_each: ['a'] } } }), /p: for_each is only allowed on agent nodes/);
    assert.throws(() => check({ ...base, nodes: { p: { parent: 'x', pick: { tier: 'cheap' } } } }), /p: pick is only allowed on agent nodes/);
    assert.throws(() => check({ ...base, nodes: { p: { parent: 'x', agent: 'y' } } }), /p: needs exactly one of run, agent or parent/);
    assert.throws(() => check({ ...base, nodes: { p: { parent: 'x ${zz.f}' } } }), /p: unknown node "zz"/, 'parent text refs are checked and add edges');

    // a rejected approval blocks everything after it and ends the run, with no next in between
    const d2 = temp('graph-');
    const file = join(d2, 'rej.yaml');
    writeFileSync(file, ['name: rej', 'limits:', '  max_agents: 4', 'loops:', '  rounds:', '    nodes: [r, fix]', '    until: fix.clean == true',
      '    max_rounds: 2', 'nodes:', '  ask:', '    parent: Approve?', '    out: [merge]', '  r:', '    agent: review', '    needs: [ask]',
      '  fix:', '    parent: fix it', '    needs: [r]', '    out: [clean]', '  wrap:', '    parent: wrap up', '    needs: [fix]', ''].join('\n'));
    const rej = check(mod('yaml.js').parse(readFileSync(file, 'utf8')));
    const run = join(d2, 'run');
    next(rej, run);
    done(rej, run, { node: 'ask', attempt: 1, failed: 'owner said no', final: true });
    assert.deepEqual(events(run, 'loop-exit').map(e => [e.loop, e.reason]), [['rounds', 'failed']], 'the loop exits as failed once all its nodes are blocked');
    assert.equal(status(rej, run).state, 'blocked');
    const cli = spawnSync(process.execPath, [CLI, 'status', file, run], { encoding: 'utf8', env: process.env });
    assert.equal(cli.status, 0, cli.stderr);
    assert.equal(events(run, 'end').at(-1)?.state, 'blocked', 'graph.js status writes the end event');
  },

  // loops: rounds, isolation, stale reports, outside nodes wait for the exit, siblings delay the decision
  C41() {
    const { check } = mod('spec.js'); const { next, done, status } = mod('run.js');
    const dir = temp('graph-');
    const spec = check({ name: 'l', limits: { max_agents: 8 },
      loops: { lp: { nodes: ['rev', 'side', 'fix'], until: 'fix.clean == true', max_rounds: 3 } },
      nodes: {
        start: { agent: 's', out: ['x'] },
        rev: { agent: 'r {item}', for_each: ['a', 'b'], needs: ['start'], out: ['n'] },
        side: { parent: 'side', needs: ['rev'], out: ['k'] },
        fix: { parent: 'fix', needs: ['rev'], out: ['clean'] },
        outside: { agent: 'o', in: '${fix.clean}' } } });
    next(spec, dir); done(spec, dir, { node: 'start', output: { x: 1 }, model: 'm' });
    const r1 = next(spec, dir);
    assert.deepEqual(ids(r1), ['rev#0', 'rev#1']); assert.equal(r1[0].round, 1);
    done(spec, dir, { node: 'rev', index: 0, round: 1, output: { n: 1 }, model: 'm' });
    done(spec, dir, { node: 'rev', index: 1, round: 1, attempt: 1, failed: 'crashed', final: true });
    assert.deepEqual(ids(next(spec, dir)).sort(), ['fix#0', 'side#0']);
    done(spec, dir, { node: 'fix', round: 1, output: { clean: false } });
    assert.equal(events(dir, 'round').length, 0, 'a sibling still running delays the round');
    assert.equal(status(spec, dir).state, 'running');
    assert.deepEqual(ids(next(spec, dir)), ['side#0'], 'only the open sibling comes back; outside waits');
    done(spec, dir, { node: 'side', round: 1, output: { k: 1 } });
    assert.deepEqual(events(dir, 'round').map(e => [e.loop, e.round]), [['lp', 2]], 'the last settle in the round starts the next one');
    assert.equal(status(spec, dir).state, 'running', 'between rounds the run is still running');
    const r2 = next(spec, dir);
    assert.equal(done(spec, dir, { node: 'rev', index: 1, round: 1, output: { n: 9 }, model: 'late' }).duplicate, true, 'a late round-1 report is ignored');
    assert.throws(() => done(spec, dir, { node: 'rev', index: 1, attempt: 1, output: { n: 9 }, model: 'late' }), /rev#1: a loop node's report must carry its round/,
      'a report without round can\'t be told from a late one, so it is refused');
    assert.deepEqual(ids(r2), ['rev#0', 'rev#1']); assert.equal(r2[0].round, 2);
    done(spec, dir, { node: 'rev', index: 0, round: 2, output: { n: 2 }, model: 'm' });
    done(spec, dir, { node: 'rev', index: 1, round: 2, output: { n: 3 }, model: 'm' });
    assert.ok(existsSync(join(dir, 'nodes', 'rev-0.r2.md')), 'a later round writes .r<n> files');
    assert.ok(existsSync(join(dir, 'nodes', 'rev-0.md')), 'round 1 files are kept');
    next(spec, dir);
    done(spec, dir, { node: 'side', round: 2, output: { k: 2 } });
    done(spec, dir, { node: 'fix', round: 2, output: { clean: true } });
    assert.deepEqual(events(dir, 'loop-exit').map(e => [e.loop, e.round, e.reason]), [['lp', 2, 'until']]);
    const [out] = next(spec, dir);
    assert.equal(out.node, 'outside'); assert.deepEqual(out.input.fix, { clean: true }, 'outside sees the final round');
    const lines = log(dir);
    assert.ok(lines.findIndex(e => e.type === 'dispatch' && e.node === 'outside') > lines.findIndex(e => e.type === 'loop-exit'), 'outside starts only after the exit');
    done(spec, dir, { node: 'outside', output: {}, model: 'm' });
    const st = status(spec, dir);
    assert.equal(st.state, 'done', 'a round-1 failure does not make a clean later round partial');
    assert.deepEqual(st.loops, { lp: { round: 2, exit: 'until' } });

    // an exit node that fails finally ends the loop as failed and blocks its consumers
    const d2 = temp('graph-');
    next(spec, d2); done(spec, d2, { node: 'start', output: { x: 1 }, model: 'm' });
    next(spec, d2);
    done(spec, d2, { node: 'rev', index: 0, output: { n: 1 }, model: 'm' }); done(spec, d2, { node: 'rev', index: 1, output: { n: 1 }, model: 'm' });
    next(spec, d2);
    done(spec, d2, { node: 'side', output: { k: 1 } });
    done(spec, d2, { node: 'fix', attempt: 1, failed: 'cannot fix', final: true });
    assert.deepEqual(events(d2, 'loop-exit').map(e => e.reason), ['failed']);
    assert.ok(events(d2, 'blocked').some(e => e.node === 'outside'), 'consumers of a failed exit are blocked');
    assert.equal(status(spec, d2).state, 'blocked');

    // a run node inside a loop records its round through exec, in every round
    const { exec } = mod('run.js');
    const d3 = temp('graph-');
    const withRun = check({ name: 'x', limits: { max_agents: 2 }, loops: { lp: { nodes: ['t', 'j'], until: 'j.ok == true', max_rounds: 2 } },
      nodes: { t: { run: [process.execPath, '-e', 'process.stdout.write("hi")'] }, j: { agent: 'j', needs: ['t'], out: ['ok'] } } });
    next(withRun, d3); exec(withRun, d3, 't');
    next(withRun, d3); done(withRun, d3, { node: 'j', round: 1, output: { ok: false }, model: 'm' });
    assert.deepEqual(ids(next(withRun, d3)), ['t#0']);
    assert.equal(exec(withRun, d3, 't').output.text, 'hi', 'exec records a round-2 run node');
    assert.ok(existsSync(join(d3, 'nodes', 't-0.r2.md')));
  },

  // ${prev.node.field}: the previous round's value, null in round 1, no edge, same loop only
  C42() {
    const { check } = mod('spec.js'); const { next, done } = mod('run.js');
    const dir = temp('graph-');
    const loops = { lp: { nodes: ['a', 'b'], until: 'b.stop == true', max_rounds: 2 } };
    const spec = check({ name: 'v', limits: { max_agents: 4 }, loops, nodes: {
      a: { agent: 'seen ${prev.b.v}', out: ['x'] }, b: { agent: 'b', needs: ['a'], out: ['v', 'stop'] } } });
    assert.equal(next(spec, dir)[0].prompt, 'seen null');
    done(spec, dir, { node: 'a', output: { x: 1 }, model: 'm' }); next(spec, dir);
    done(spec, dir, { node: 'b', output: { v: 'one', stop: false }, model: 'm' });
    assert.equal(next(spec, dir)[0].prompt, 'seen one');
    const base = { name: 'v', limits: { max_agents: 6 } };
    assert.throws(() => check({ ...base, loops, nodes: { a: { agent: 'a', out: ['x'] }, b: { agent: 'b', needs: ['a'], out: ['v', 'stop'] }, c: { agent: '${prev.b.v}', needs: ['b'] } } }),
      /c: \$\{prev\.b\.v\} is only allowed inside the same loop/);
    assert.throws(() => check({ ...base, loops: { ...loops, mp: { nodes: ['c'], until: 'c.stop == true', max_rounds: 1 } },
      nodes: { a: { agent: 'a', out: ['x'] }, b: { agent: 'b', needs: ['a'], out: ['v', 'stop'] }, c: { agent: '${prev.b.v}', needs: ['b'], out: ['stop'] } } }),
      /c: \$\{prev\.b\.v\} is only allowed inside the same loop/);
    assert.throws(() => check({ ...base, nodes: { prev: { agent: 'x' } } }), /prev: the name "prev" is reserved/);
    assert.throws(() => check({ ...base, loops, nodes: { a: { agent: 'a ${prev.foo}', out: ['x'] }, b: { agent: 'b', needs: ['a'], out: ['v', 'stop'] } } }),
      /a: \$\{prev\.foo\} must be \$\{prev\.<node>\.<field>\}/);
    assert.throws(() => check({ ...base, loops, nodes: { a: { agent: 'a', in: '${prev.foo}', out: ['x'] }, b: { agent: 'b', needs: ['a'], out: ['v', 'stop'] } } }),
      /a: \$\{prev\.foo\} must be \$\{prev\.<node>\.<field>\}/);
  },

  // loop limits: max_rounds, the total cap across rounds, and contiguity
  C43() {
    const { check } = mod('spec.js'); const { next, done, status } = mod('run.js');
    const dir = temp('graph-');
    const spec = check({ name: 'm', limits: { max_agents: 2 }, loops: { lp: { nodes: ['a'], until: 'a.stop == true', max_rounds: 2 } },
      nodes: { a: { agent: 'a', out: ['stop'] } } });
    for (let i = 0; i < 2; i++) { const [t] = next(spec, dir); done(spec, dir, { node: 'a', round: t.round, output: { stop: false }, model: 'm' }); }
    assert.deepEqual(events(dir, 'loop-exit').map(e => e.reason), ['max_rounds']);
    assert.equal(status(spec, dir).state, 'partial', 'running out of rounds is partial');

    // a fan-out before a loop is trimmed so every round of the loop still fits
    const d2 = temp('graph-');
    const wide = check({ name: 'w', limits: { max_agents: 6 }, loops: { lp: { nodes: ['r'], until: 'r.stop == true', max_rounds: 3 } }, nodes: {
      fan: { agent: 'f', out: ['items'] }, many: { agent: 'm {item}', for_each: '${fan.items}' }, r: { agent: 'r', needs: ['many'], out: ['stop'] } } });
    next(wide, d2); done(wide, d2, { node: 'fan', output: { items: Array.from({ length: 10 }, (_, i) => i) }, model: 'm' });
    const fanned = next(wide, d2);
    assert.equal(fanned.length, 2, 'room left for the loop\'s 3 rounds');
    fanned.forEach(t => done(wide, d2, { node: 'many', index: t.index, output: {}, model: 'm' }));
    for (const stop of [false, false, true]) { const [t] = next(wide, d2); assert.equal(t.node, 'r'); done(wide, d2, { node: 'r', round: t.round, output: { stop }, model: 'm' }); }
    assert.deepEqual(events(d2, 'loop-exit').map(e => [e.round, e.reason]), [[3, 'until']], 'all three rounds ran');

    const base = { name: 'c', limits: { max_agents: 10 } };
    const L = nodes => ({ lp: { nodes, until: 'g2.stop == true', max_rounds: 2 } });
    assert.throws(() => check({ name: 'c', limits: { max_agents: 2 }, loops: { lp: { nodes: ['a'], until: 'a.stop == true', max_rounds: 3 } }, nodes: { a: { agent: 'a', out: ['stop'] } } }),
      /graph needs at least 3 agents; max_agents is 2/, 'rounds count toward the cap');
    assert.throws(() => check({ ...base, loops: L(['g1', 'g2']), nodes: { g1: { agent: 'x' }, x: { agent: 'x', needs: ['g1'] }, g2: { agent: 'y', needs: ['x'], out: ['stop'] } } }),
      /loops\.lp: x is outside the loop but between its nodes/);
    assert.throws(() => check({ ...base, loops: L(['g1', 'g2']), nodes: { g1: { agent: 'x' }, g2: { agent: 'y', needs: ['g1'], out: ['stop'] }, o: { agent: 'o', needs: ['g1', 'g2'] } } }),
      /loops\.lp: only g2, the until node, may have dependents outside the loop/);
    assert.throws(() => check({ ...base, loops: { lp: { nodes: ['g1', 'g2'], until: 'g1.stop == true', max_rounds: 2 } },
      nodes: { g1: { agent: 'x', out: ['stop'] }, g2: { agent: 'y', needs: ['g1'] }, o: { agent: 'o', needs: ['g2'] } } }), /loops\.lp: only g1, the until node, may have dependents outside the loop/);
    assert.throws(() => check({ ...base, loops: { ...L(['g1', 'g2']), mp: { nodes: ['g1'], until: 'g1.stop == true', max_rounds: 1 } },
      nodes: { g1: { agent: 'x', out: ['stop'] }, g2: { agent: 'y', needs: ['g1'], out: ['stop'] } } }), /loops\.mp: g1 is already in loop lp/);
    assert.throws(() => check({ ...base, loops: { lp: { nodes: ['a'], until: 'a.stop == true', max_rounds: 0 } }, nodes: { a: { agent: 'a', out: ['stop'] } } }),
      /loops\.lp: max_rounds must be an integer from 1 to 20/);
    assert.throws(() => check({ ...base, loops: { lp: { nodes: ['a'], until: 'a.stop == true', max_rounds: 2 } }, nodes: { a: { agent: 'a' } } }),
      /loops\.lp: until field "stop" must be listed in a's out/);
    assert.throws(() => check({ ...base, loops: { lp: { nodes: ['a'], until: 'b.stop == true', max_rounds: 2 } }, nodes: { a: { agent: 'a' }, b: { agent: 'b', out: ['stop'] } } }),
      /loops\.lp: until node b must be in the loop/);
  },

  // after: items wait for the items they name, get their files, and fail when one of them fails
  C44() {
    const { check } = mod('spec.js'); const { next, done } = mod('run.js');
    const spec = check({ name: 'a', limits: { max_agents: 8 }, nodes: {
      plan: { agent: 'p', out: ['tasks'] }, impl: { agent: 'do {item}', for_each: '${plan.tasks}', after: 'id', out: ['branch'] } } });
    const start = tasks => { const dir = temp('graph-'); next(spec, dir); done(spec, dir, { node: 'plan', output: { tasks }, model: 'm' }); return dir; };
    const dir = start([{ id: 'a' }, { id: 'b', after: ['a'] }, { id: 'c' }]);
    assert.deepEqual(ids(next(spec, dir)), ['impl#0', 'impl#2'], 'b waits for a');
    done(spec, dir, { node: 'impl', index: 0, output: { branch: 'ba' }, model: 'm' });
    const [b] = next(spec, dir);
    assert.equal(b.index, 1);
    assert.deepEqual(b.input.after, [{ id: 'a', file: join(dir, 'nodes', 'impl-0.md'), summary: 'branch: ba' }]);
    const d2 = start([{ id: 'a' }, { id: 'b', after: ['a'] }, { id: 'c' }]);
    next(spec, d2);
    done(spec, d2, { node: 'impl', index: 0, attempt: 1, failed: 'broke', final: true });
    const failed = events(d2, 'failed').find(e => e.index === 1);
    assert.equal(failed?.reason, 'blocked by a'); assert.equal(failed.final, true);
    done(spec, d2, { node: 'impl', index: 2, output: { branch: 'bc' }, model: 'm' });
    assert.deepEqual(next(spec, d2), [], 'independent items finish; nothing is left');
    for (const [tasks, re] of [[[{ id: 'a', after: ['b'] }, { id: 'b', after: ['a'] }], /cycle/], [[{ id: 'a', after: ['zz'] }], /unknown id "zz"/],
      [[{ id: 'a' }, { id: 'a' }], /duplicate id "a"/], [['plain'], /must be an object with "id"/]]) {
      const d = start(tasks);
      assert.deepEqual(next(spec, d), [], 'nothing is dispatched from a bad list');
      const fails = events(d, 'failed');
      assert.equal(fails.length, tasks.length); assert.ok(fails.every(e => e.final && re.test(e.reason)), String(re));
    }
    assert.throws(() => check({ name: 'x', limits: { max_agents: 2 }, nodes: { a: { agent: 'a', after: 'id' } } }), /a: after is only allowed with for_each/);
    // a cap trim fails only the items that wait for a trimmed one; independent items still run
    const capped = check({ name: 'c', limits: { max_agents: 3 }, nodes: {
      plan: { agent: 'p', out: ['tasks'] }, impl: { agent: 'do {item}', for_each: '${plan.tasks}', after: 'id' } } });
    const d3 = temp('graph-'); next(capped, d3);
    done(capped, d3, { node: 'plan', output: { tasks: [{ id: 'a', after: ['c'] }, { id: 'b' }, { id: 'c' }] }, model: 'm' });
    assert.deepEqual(ids(next(capped, d3)), ['impl#1'], 'b runs although c was cap-skipped');
    assert.equal(events(d3, 'failed').find(e => e.index === 0)?.reason, 'blocked by c (cap-skipped)');
  },

  // when: a false condition skips only its node; a missing survivor is false; re-checked each round
  C45() {
    const { check } = mod('spec.js'); const { next, done, status } = mod('run.js');
    const spec = check({ name: 'w', limits: { max_agents: 4 }, nodes: {
      cfg: { agent: 'c', out: ['hosted', 'ok'], gate: 'ok == true' }, pub: { parent: 'publish', when: 'cfg.hosted == true', out: ['url'] },
      fin: { agent: 'f', in: '${pub.url}' } } });
    const run = output => { const dir = temp('graph-'); next(spec, dir); done(spec, dir, { node: 'cfg', output, model: 'm' }); return dir; };
    const off = run({ hosted: false, ok: true });
    const [fin] = next(spec, off);
    assert.equal(fin.node, 'fin', 'a skipped node does not block its consumers');
    assert.deepEqual(fin.input.pub, { url: null });
    assert.deepEqual(events(off, 'skipped').map(e => e.node), ['pub']);
    done(spec, off, { node: 'fin', output: {}, model: 'm' });
    const st = status(spec, off);
    assert.equal(st.state, 'done'); assert.deepEqual(st.skipped, ['pub']);
    assert.deepEqual(ids(next(spec, run({ hosted: true, ok: true }))), ['pub#0']);
    next(spec, run({ hosted: true, ok: false }));
    const dropped = run({ hosted: true, ok: false }); next(spec, dropped);
    assert.deepEqual(events(dropped, 'skipped').map(e => e.node), ['pub'], 'a reference with no survivor is false');
    // inside a loop the condition is checked again each round
    const d3 = temp('graph-');
    const loop = check({ name: 'r', limits: { max_agents: 2 }, loops: { lp: { nodes: ['g', 'h'], until: 'g.stop == true', max_rounds: 2 } },
      nodes: { g: { agent: 'g', out: ['on', 'stop'] }, h: { parent: 'h', needs: ['g'], when: 'g.on == true' } } });
    next(loop, d3); done(loop, d3, { node: 'g', output: { on: false, stop: false }, model: 'm' });
    next(loop, d3); done(loop, d3, { node: 'g', round: 2, output: { on: true, stop: true }, model: 'm' });
    assert.deepEqual(ids(next(loop, d3)), ['h#0'], 'round 2 runs h');
    const base = { name: 'x', limits: { max_agents: 4 } };
    assert.throws(() => check({ ...base, nodes: { f: { agent: 'f', for_each: ['a'], out: ['on'] }, h: { parent: 'h', when: 'f.on == true' } } }), /h: when must refer to a single-instance node/);
    assert.throws(() => check({ ...base, nodes: { f: { agent: 'f' }, h: { parent: 'h', when: 'f.on == true' } } }), /h: when field "on" must be listed in f's out/);
    assert.throws(() => check({ ...base, nodes: { h: { parent: 'h', out: ['on'], when: 'h.on == true' } } }), /h: when must refer to another node/);
    assert.throws(() => check({ ...base, nodes: { h: { parent: 'h', when: 'on == true' } } }), /h: when must be node\.field == literal/);
  },

  // logs written by 1.22.0 fold to the same status; pr-review still checks; new runs record the engine
  C46() {
    const { check } = mod('spec.js'); const { next, status } = mod('run.js');
    const dir = temp('graph-');
    copyFileSync(join(__dirname, 'fixtures', 'graph-1.22-run.jsonl'), join(dir, 'run.jsonl'));
    const spec = check({ name: 'old', limits: { max_agents: 6 }, nodes: {
      review: { agent: 'r {item}', for_each: ['bugs', 'perf'], out: ['findings'] },
      verify: { agent: 'v {item}', for_each: '${review.findings}', out: ['confirmed'], gate: 'confirmed == true' },
      report: { agent: 'p', needs: ['verify'], out: ['body'] } } });
    const st = status(spec, dir);
    assert.equal(st.state, 'partial');
    assert.deepEqual(st.failed, ['review#1']); assert.deepEqual(st.dropped, ['verify#1']);
    assert.deepEqual(st.completed, ['review', 'verify', 'report']);
    const r = spawnSync(process.execPath, [CLI, 'check', join(PLUGIN, 'skills', 'agent-swarm', 'graphs', 'pr-review.yaml')], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const fresh = temp('graph-'); next(spec, fresh);
    assert.equal(events(fresh, 'spec')[0].engine, 2);
  },

  // the run index and the live view know rounds, parents and skips
  async C47() {
    const { check } = mod('spec.js'); const { next, done } = mod('run.js');
    const dir = temp('graph-');
    const spec = check({ name: 'i', limits: { max_agents: 4 }, loops: { lp: { nodes: ['rev', 'fix'], until: 'fix.clean == true', max_rounds: 2 } }, nodes: {
      rev: { agent: 'r', out: ['n'] }, fix: { parent: 'fix', needs: ['rev'], out: ['clean'] }, pub: { parent: 'p', needs: ['fix'], when: 'fix.clean == false' } } });
    next(spec, dir); done(spec, dir, { node: 'rev', output: { n: 1 }, model: 'm1' });
    next(spec, dir);
    const index = () => readFileSync(join(dir, 'nodes', 'index.md'), 'utf8');
    assert.match(index(), /\| fix#0 \| \| waiting on orchestrator \| parent \|/);
    done(spec, dir, { node: 'fix', output: { clean: false } });
    next(spec, dir);
    done(spec, dir, { node: 'rev', round: 2, output: { n: 2 }, model: 'm2', attachments: [{ name: 'notes.md', text: 'round two' }] });
    assert.match(index(), /\| rev#0 \| \| done \| m1 \| n: 1 \| nodes\/rev-0\.md \|/, 'round 1 stays in the index');
    assert.match(index(), /\| rev#0\.r2 \| \| done \| m2 \| n: 2 \| nodes\/rev-0\.r2\.md \+ notes\.md \|/);
    assert.equal(readFileSync(join(dir, 'nodes', 'rev-0.r2', 'notes.md'), 'utf8'), 'round two');
    next(spec, dir); done(spec, dir, { node: 'fix', round: 2, output: { clean: true } });
    next(spec, dir);
    assert.match(index(), /\| pub \| \| skipped \|/);
    const { serve, PAGE } = mod('view.js');
    const server = await serve(dir, 0);
    try {
      const { port } = server.address();
      assert.equal((await get(port, '/nodes/rev-0.r2.md')).status, 200);
      assert.equal((await get(port, '/nodes/rev-0.r2/notes.md')).body, 'round two');
      assert.equal((await get(port, '/nodes/rev-0.r2x.md')).status, 404);
    } finally { server.close(); }
    // the page's reducer, run on this log
    const section = PAGE.split('// ---- state folded from run.jsonl')[1].split('// ---- preferences')[0];
    const page = vm.runInNewContext(section + '\n;({ run, apply })');
    log(dir).forEach(e => page.apply(e));
    assert.ok(page.run.inst['rev#0'] && page.run.inst['rev#0.r2'], 'each round keeps its own card');
    assert.equal(page.run.inst['rev#0.r2'].round, 2);
    assert.equal(page.run.inst['fix#0'].parent, true, 'parent cards are marked');
    assert.equal(page.run.skipped.pub, 'when false');
    assert.deepEqual(JSON.parse(JSON.stringify(page.run.loops.lp)), { round: 2, max: 2, exit: 'until' });
    assert.match(PAGE, /waiting on orchestrator/);
    // a node skipped in round 1 and run in round 2 shows its round-2 card
    const page2 = vm.runInNewContext(section + '\n;({ run, apply })');
    page2.apply({ type: 'spec', t: 1, name: 'x', nodes: ['g', 'h'], edges: {}, loops: { lp: { nodes: ['g', 'h'], max_rounds: 2 } } });
    page2.apply({ type: 'skipped', node: 'h', reason: 'when false' });
    page2.apply({ type: 'cap-skipped', node: 'g', count: 1 });
    page2.apply({ type: 'round', loop: 'lp', round: 2 });
    assert.equal(page2.run.skipped.h, undefined, 'a new round clears the loop\'s skips');
    assert.equal(page2.run.capSkipped.g, undefined, 'and its cap skips');
    // render one card with a stub DOM: a same-creator review is marked on the card itself
    const cardSrc = PAGE.split('function card(i) {')[1].split('\nlet queued')[0];
    const texts = [];
    const fake = () => ({ className: '', dataset: {}, classList: { add() {} }, append(...xs) { xs.forEach(x => x && x.text !== undefined && texts.push(x.text)); }, setAttribute() {}, set title(v) {} });
    const render = vm.runInNewContext(`const el = (t, c, x) => { const e = mk(); if (x != null) e.text = String(x); return e; };
      const label = () => ''; const dur = () => ''; let open = null; const openPanel = () => {};
      (function card(i) {${cardSrc})`, { mk: fake });
    render({ node: 'verify', state: 'done', id: 'verify#0', reason: { independence: 'same-creator' } });
    assert.ok(texts.includes('same-creator review'), 'a same-creator review is marked on its card');
    // pick events from the CLI carry the round, so a later round's model lands on its own card
    const d4 = temp('graph-'); const file = join(d4, 'g.yaml');
    writeFileSync(file, 'name: g\nlimits:\n  max_agents: 2\nloops:\n  lp:\n    nodes: [a]\n    until: a.stop == true\n    max_rounds: 2\nnodes:\n  a:\n    agent: a\n    pick: { tier: cheap }\n    out: [stop]\n');
    const g = check(mod('yaml.js').parse(readFileSync(file, 'utf8'))); const run = join(d4, 'run');
    next(g, run); done(g, run, { node: 'a', round: 1, output: { stop: false }, model: 'm1' }); next(g, run);
    const cf = join(d4, 'c.json'); writeFileSync(cf, JSON.stringify([{ provider: 'p', model: 'm2', effort: 'high' }]));
    const uf = join(d4, 'u.json'); writeFileSync(uf, JSON.stringify({ accounts: [], notes: [] }));
    const picked = spawnSync(process.execPath, [CLI, 'pick', file, run, 'a', '0', '--candidates', cf, '--usage', uf], { encoding: 'utf8', env: process.env });
    assert.equal(picked.status, 0, picked.stderr);
    assert.equal(events(run, 'pick').at(-1).round, 2, 'a pick in round 2 records round 2');
    // a round that ends while pick works makes the pick stale: it is refused, not logged into the next round
    const hook = join(d4, 'hook.js');
    writeFileSync(hook, `const fs = require('fs'), read = fs.readFileSync; fs.readFileSync = function (f, ...a) { const out = read.call(this, f, ...a);
      if (String(f) === ${JSON.stringify(cf)}) fs.appendFileSync(${JSON.stringify(join(run, 'run.jsonl'))}, JSON.stringify({ t: 1, type: 'round', loop: 'lp', round: 3 }) + '\\n');
      return out; };`);
    const before = events(run, 'pick').length;
    const stale = spawnSync(process.execPath, ['--require', hook, CLI, 'pick', file, run, 'a', '0', '--candidates', cf, '--usage', uf], { encoding: 'utf8', env: process.env });
    assert.notEqual(stale.status, 0, 'a stale pick fails');
    assert.match(stale.stderr, /a: round 2 ended while picking; pick again/);
    assert.equal(events(run, 'pick').length, before, 'and logs nothing');
  },

  // review fixes: loop sinks, admission failures, the after field, view rounds, and task.yaml stop points
  C49() {
    const { check } = mod('spec.js'); const { next, done, status } = mod('run.js');
    // a loop whose until node feeds another loop node: the until node is still the loop's output
    const sinkSpec = check({ name: 's', limits: { max_agents: 4 }, loops: { lp: { nodes: ['g', 'tail'], until: 'g.stop == true', max_rounds: 1 } },
      nodes: { g: { agent: 'g', out: ['stop'] }, tail: { agent: 't', needs: ['g'] } } });
    assert.deepEqual([...sinkSpec.sinks], ['g']);
    const sd = temp('graph-'); drive(sinkSpec, sd, t => t.node === 'g' ? { stop: true } : {});
    assert.equal(status(sinkSpec, sd).state, 'done');
    // two loops whose nodes wait on each other's exit can never run: check rejects them
    assert.throws(() => check({ name: 'c', limits: { max_agents: 8 }, loops: { la: { nodes: ['a', 'atail'], until: 'a.stop == true', max_rounds: 1 },
      lb: { nodes: ['b', 'btail'], until: 'b.stop == true', max_rounds: 1 } }, nodes: { a: { agent: 'a', out: ['stop'] }, b: { agent: 'b', out: ['stop'] },
      atail: { agent: 't', needs: ['a', 'b'] }, btail: { agent: 't', needs: ['a', 'b'] } } }), /loops: (la -> lb -> la|lb -> la -> lb) wait on each other's exit/);
    // the same wait routed through ordinary nodes is caught too
    assert.throws(() => check({ name: 'c', limits: { max_agents: 8 }, loops: { la: { nodes: ['a', 'atail'], until: 'a.stop == true', max_rounds: 1 },
      lb: { nodes: ['b', 'btail'], until: 'b.stop == true', max_rounds: 1 } }, nodes: { a: { agent: 'a', out: ['stop'] }, b: { agent: 'b', out: ['stop'] },
      x: { agent: 'x', needs: ['b'] }, y: { agent: 'y', needs: ['a'] }, atail: { agent: 't', needs: ['a', 'x'] }, btail: { agent: 't', needs: ['b', 'y'] } } }),
      /loops: (la -> lb -> la|lb -> la -> lb) wait on each other's exit/);
    // a fan-out whose after lists fail ordering blocks its consumer instead of dispatching it
    const ad = temp('graph-');
    const aspec = check({ name: 'a', limits: { max_agents: 6 }, nodes: { p: { agent: 'p', out: ['tasks'] },
      w: { agent: 'w {item}', for_each: '${p.tasks}', after: 'task_id' }, c: { agent: 'c', needs: ['w'] } } });
    next(aspec, ad); done(aspec, ad, { node: 'p', output: { tasks: [{ task_id: 'x', after: ['nope'] }] }, model: 'm' });
    assert.deepEqual(ids(next(aspec, ad)), [], 'nothing is ready');
    assert.ok(!events(ad, 'dispatch').some(e => e.node === 'c'), 'the consumer never dispatched');
    assert.equal(events(ad, 'blocked').find(e => e.node === 'c')?.cause, 'w');
    // the spec event carries each node's after field, so the view draws task_id edges
    assert.deepEqual(events(ad, 'spec')[0].after, { w: 'task_id' });
    // the view: a skip in round 2 keeps round 1's card; a fan-out from outside the loop draws from round 1
    const { PAGE } = mod('view.js');
    const section = PAGE.split('// ---- state folded from run.jsonl')[1].split('// ---- preferences')[0];
    const cardsSrc = 'function cards(node) {' + PAGE.split('function cards(node) {')[1].split(/\r?\n}\r?\n/)[0] + '\n}';
    const pre = PAGE.split('const itemLabel')[1].split('function cards(node) {')[0];
    const pg = vm.runInNewContext(section + '\nconst itemLabel' + pre + cardsSrc + '\n;({ run, apply, cards })');
    pg.apply({ type: 'spec', t: 1, name: 'x', nodes: ['h'], edges: {}, loops: { lp: { nodes: ['h'], max_rounds: 2 } } });
    pg.apply({ type: 'admit', node: 'h', count: 1, items: [{}], round: 1 });
    pg.apply({ type: 'result', node: 'h', index: 0, round: 1, output: {} });
    pg.apply({ type: 'round', loop: 'lp', round: 2 });
    pg.apply({ type: 'skipped', node: 'h', reason: 'when false' });
    assert.equal(pg.cards('h').map(c => c.state).join(), 'done,skipped', 'round 1 stays visible beside the round-2 skip');
    assert.match(PAGE, /to\.src \? \[key\(to\.src\.node, to\.src\.index, run\.loopOf\?\.\[to\.src\.node\] === run\.loopOf\?\.\[node\]/);
    // task.yaml: approve refuses a plan whose loops ran out, publication needs a passing audit, babysit re-reviews
    const yaml = readFileSync(TASK_YAML, 'utf8'); const spec48 = () => check(mod('yaml.js').parse(yaml));
    // a loop that runs out of rounds blocks the work after it: an unready plan never reaches approve
    const ex = temp('graph-');
    const early = { research: { notes: 'n' }, grill: { answers: 'a' }, reresearch: { ready: false, questions: ['q'], notes: 'n' } };
    drive(spec48(), ex, t => { assert.ok(t.node in early, `${t.node} must not start after an unready plan`); return early[t.node]; });
    assert.equal(events(ex, 'blocked').find(e => e.node === 'draft')?.cause, 'grill-rounds (max_rounds)');
    assert.equal(status(spec48(), ex).state, 'blocked');
    assert.match(yaml, /rerun the audit until ok is true; if a gap cannot close, report failed with final true/);
    assert.match(yaml, /If the checks cannot pass, report this task failed with final true/);
    assert.match(yaml, /nested graphs\/pr-review\.yaml run before MERGE READY/);
    assert.match(yaml, /With no Git repository,\r?\n\s+back up each file first/);
  },

  // #82: a dispatched agent task whose next output was lost comes back from next --resume, with its pick
  C50() {
    const { check } = mod('spec.js'); const { next, done } = mod('run.js');
    const dir = temp('graph-');
    const spec = check({ name: 'r', limits: { max_agents: 2 }, nodes: { a: { agent: 'a', out: ['x'] }, b: { agent: 'b', needs: ['a'] } } });
    assert.deepEqual(ids(next(spec, dir)), ['a#0']);
    assert.deepEqual(next(spec, dir), [], 'plain next offers an agent attempt once, so a polling orchestrator never dispatches it twice');
    appendFileSync(join(dir, 'run.jsonl'), JSON.stringify({ t: Date.now(), type: 'pick', node: 'a', index: 0, provider: 'p', model: 'm1', effort: 'high', creator: 'C' }) + '\n');
    const [lost] = next(spec, dir, {}, { resume: true });
    assert.equal(lost.node, 'a'); assert.equal(lost.resumed, true, 'next --resume returns the open agent task');
    assert.deepEqual(lost.picked, { provider: 'p', model: 'm1', effort: 'high' }, 'a resumed agent task carries its latest pick');
    assert.equal(lost.attempt, 1); assert.equal(events(dir, 'dispatch').filter(e => e.node === 'a').length, 1, 'resuming does not dispatch again');
    done(spec, dir, { node: 'a', attempt: 1, output: { x: 1 }, model: 'm' });
    assert.deepEqual(ids(next(spec, dir, {}, { resume: true })), ['b#0'], 'a recorded task is not resumed');
    const rdir = temp('graph-');
    const rspec = check({ name: 'r2', limits: { max_agents: 1 }, nodes: { c: { run: ['true'] } } });
    assert.deepEqual(ids(next(rspec, rdir)), ['c#0']);
    assert.deepEqual(next(rspec, rdir, {}, { resume: true }), [], 'a run task is never re-offered, so exec cannot repeat its effect');
  },

  // the bundled task graph walks a task with and without Git hosting
  C48() {
    const { check } = mod('spec.js'); const { status } = mod('run.js');
    const spec = check(mod('yaml.js').parse(readFileSync(TASK_YAML, 'utf8')));
    const answers = (hosted, plan, fixes, reviews) => {
      let planRound = 0, fixRound = 0, reviewCall = 0;
      return t => {
        switch (t.node) {
          case 'research': return { notes: 'n' };
          case 'grill': return { answers: 'a' };
          case 'reresearch': return { ready: true, questions: [], notes: 'n' };
          case 'draft': return { plan_file: `/p${t.round}` };
          case 'plan-review': return { ...plan[planRound++], findings: [], hosted };
          case 'approve': return { merge: true };
          case 'issue': return { url: 'u' };
          case 'implement': return { branch: `b-${t.item.id}`, checks: 'ok' };
          case 'integrate': return { base: 'main', branch: 'feat', ok: true };
          case 'audit': return { ok: true, gaps: [] };
          case 'pr': return { number: 7, url: 'u' };
          case 'review': return { findings: reviews(t, reviewCall++) };
          case 'verify': return { confirmed: true, evidence: 'e' };
          case 'post': return { posted: true };
          case 'fix': return fixes[fixRound++];
          case 'babysit': return { state: 'MERGE READY', merge: true };
          case 'merge': return { merged: true };
          case 'recap': return { text: 'r' };
          default: throw new Error(`unexpected node ${t.node}`);
        }
      };
    };
    const dispatched = dir => events(dir, 'dispatch').map(e => e.node);
    // no Git hosting: the hosted-only nodes are skipped, merge too although the owner authorized it
    const local = temp('graph-');
    drive(spec, local, answers(false, [{ clean: true, plan_file: '/p1', tasks: [{ id: 't1' }] }], [{ clean: true, decided: [] }], () => []), { request: 'fix a typo' });
    for (const node of ['issue', 'pr', 'post', 'babysit', 'merge']) assert.ok(!dispatched(local).includes(node), `${node} is skipped without hosting`);
    assert.deepEqual(events(local, 'skipped').map(e => e.node).sort(), ['babysit', 'issue', 'merge', 'post', 'pr']);
    assert.ok(dispatched(local).includes('recap'));
    assert.equal(status(spec, local).state, 'done');
    // hosted: two plan rounds, ordered implementation, two review rounds, merge after babysit
    const hosted = temp('graph-');
    drive(spec, hosted, answers(true,
      [{ clean: false, plan_file: '/p1', tasks: [{ id: 'old' }] }, { clean: true, plan_file: '/p2', tasks: [{ id: 't1' }, { id: 't2', after: ['t1'] }] }],
      [{ clean: false, decided: ['found x'] }, { clean: true, decided: ['found x'] }],
      (t, n) => (t.round === 1 && t.item === 'bugs' ? [{ title: 'x' }] : [])), { request: 'a feature' });
    const lines = log(hosted);
    const draft2 = lines.find(e => e.type === 'dispatch' && e.node === 'draft' && e.round === 2);
    assert.ok(draft2, 'the plan loop ran twice');
    assert.deepEqual(lines.filter(e => e.type === 'admit' && e.node === 'implement').at(-1).items.map(i => i.item.id), ['t1', 't2'], 'implementation uses the reviewed plan');
    assert.equal(lines.filter(e => e.type === 'dispatch' && e.node === 'post').length, 2, 'one post per review round');
    const at = pred => lines.findIndex(pred);
    assert.ok(at(e => e.type === 'dispatch' && e.node === 'implement' && e.index === 1) > at(e => e.type === 'result' && e.node === 'implement' && e.index === 0), 't2 waits for t1');
    assert.ok(at(e => e.type === 'dispatch' && e.node === 'merge') > at(e => e.type === 'result' && e.node === 'babysit'), 'merge waits for babysit');
    assert.equal(status(spec, hosted).state, 'done');
    // prompts carry the previous round: the reviewed plan file and the decided findings
    const { next } = mod('run.js');
    const probe = temp('graph-');
    let seen = {};
    drive(spec, probe, (() => { const a = answers(true,
      [{ clean: false, plan_file: '/p1', tasks: [{ id: 't1' }] }, { clean: true, plan_file: '/p2', tasks: [{ id: 't1' }] }],
      [{ clean: false, decided: ['found x'] }, { clean: true, decided: ['found x'] }], () => []);
      return t => { if (t.round === 2) seen[t.node] = t.prompt; return a(t); }; })(), { request: 'r' });
    assert.match(seen.draft, /\/p1/, 'the second draft sees the reviewed plan file');
    assert.match(seen.review, /found x/, 'the second review round sees decided findings');
    void next;
  },
};
