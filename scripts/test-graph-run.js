// Graph contract: YAML, spec checks and the scheduler. Part of the graph contract (see test-graph.js); all data is local fakes.
'use strict';
const { assert, writeFileSync, readFileSync, appendFileSync, existsSync, join, spawnSync, http, temp, PLUGIN, mod, CLI, log, NOW,
  cands, aa, data } = require('./graph-fixtures.js');

module.exports = {
  // R1: strict YAML subset
  C1() {
    const { parse } = mod('yaml.js');
    assert.deepEqual(parse('a:\n  b: [x, y]\n  c: { d: 1, e: true }\nl:\n  - p\n  - q\n'),
      { a: { b: ['x', 'y'], c: { d: 1, e: true } }, l: ['p', 'q'] });
    assert.deepEqual(parse('p: |\n  line one\n  line two\nq: 2\n'), { p: 'line one\nline two\n', q: 2 });
    assert.deepEqual(parse('models:\n  gpt-6.1-sol:\n    prefer: [code-review]\n    avoid: [ui-ux]\n'),
      { models: { 'gpt-6.1-sol': { prefer: ['code-review'], avoid: ['ui-ux'] } } });
    assert.deepEqual(parse('run: [gh, pr, diff, "${inputs.pr}"]\n'), { run: ['gh', 'pr', 'diff', '${inputs.pr}'] });
    assert.throws(() => parse('a: &x 1\nb: *x\n'), /line 1: anchors are not supported/);
    assert.throws(() => parse('a: 1\n---\nb: 2\n'), /line 2: multiple documents/);
    assert.throws(() => parse('a: { b: [c] }\n'), /line 1: nested inline collections are not supported/);
    assert.throws(() => parse('a: 1\na: 2\n'), /line 2: duplicate key "a"/);
  },

  // R2: spec check
  C2() {
    const { check } = mod('spec.js');
    const base = { name: 'g', limits: { max_agents: 2 }, nodes: {} };
    assert.throws(() => check({ ...base, nodes: { a: { agent: 'x', in: '${nope.out}' } } }), /a: unknown node "nope"/);
    assert.throws(() => check({ ...base, nodes: { a: { agent: 'x', needs: ['b'] }, b: { agent: 'y', needs: ['a'] } } }), /cycle: a -> b -> a/);
    assert.throws(() => check({ ...base, nodes: { a: { agent: 'x' }, b: { run: ['echo', '${a.out}'] } } }), /b: run may reference only \$\{inputs/);
    assert.throws(() => check({ ...base, nodes: { b: { run: 'echo hi' } } }), /b: run must be a list/);
    assert.throws(() => check({ ...base, nodes: { a: { agent: 'x', for_each: ['1', '2', '3'] } } }), /needs at least 3 agents; max_agents is 2/);
    assert.throws(() => check({ ...base, nodes: { a: { agent: 'x', out: ['ok'], gate: 'ok > 1' } } }), /a: gate must be field == literal/);
    assert.throws(() => check({ ...base, nodes: { a: { agent: 'x', colour: 'red' } } }), /a: unknown key "colour"/);
    assert.throws(() => check({ ...base, nodes: { a: { agent: 'x', pick: { differ_from: 'zz' } } } }), /a: differ_from names unknown node "zz"/);
    assert.throws(() => check({ ...base, nodes: { f: { run: ['echo'] }, a: { agent: 'x', needs: ['f'], pick: { differ_from: 'f' } } } }), /a: differ_from must name an agent node/);
    const ordered = check({ ...base, nodes: { a: { agent: 'x', pick: { differ_from: 'b' } }, b: { agent: 'y' } } });
    assert.ok(ordered.order.indexOf('b') < ordered.order.indexOf('a'), 'differ_from adds an edge');
  },

  // R3: dispatch once, runtime fan-out with provenance, gates, needs; R8: producer outcomes; duplicate done
  C3() {
    const { check } = mod('spec.js'); const { next, done } = mod('run.js');
    const dir = temp('graph-');
    const spec = check({ name: 'g', limits: { max_agents: 8, explore: false }, nodes: {
      review: { agent: 'r {item}', for_each: ['bugs', 'perf'], out: ['findings'], kind: 'code-review' },
      verify: { agent: 'v {item}', for_each: '${review.findings}', out: ['confirmed'], gate: 'confirmed == true', kind: 'reasoning' },
      report: { agent: 'p', needs: ['verify'], kind: 'writing' } } });
    assert.deepEqual(next(spec, dir).map(t => `${t.node}#${t.index}`), ['review#0', 'review#1']);
    assert.deepEqual(next(spec, dir), [], 'in-flight attempts are not offered twice');
    done(spec, dir, { node: 'review', index: 0, output: { findings: [{ id: 1 }] }, model: 'rm0' });
    done(spec, dir, { node: 'review', index: 1, output: { findings: [{ id: 2 }] }, model: 'rm1' });
    const vs = next(spec, dir);
    assert.deepEqual(vs.map(t => `${t.node}#${t.index}`), ['verify#0', 'verify#1']);
    assert.deepEqual(vs[0].item, { id: 1 }); assert.match(vs[0].prompt, /"id":1/);
    assert.throws(() => done(spec, dir, { node: 'verify', index: 0, output: {}, model: 'vm' }), /verify#0: output missing "confirmed"/);
    done(spec, dir, { node: 'verify', index: 0, output: { confirmed: true }, model: 'vm' });
    done(spec, dir, { node: 'verify', index: 1, output: { confirmed: false }, model: 'vm' });
    assert.equal(done(spec, dir, { node: 'verify', index: 1, output: { confirmed: true }, model: 'vm' }).duplicate, true);
    const [rep] = next(spec, dir);
    assert.equal(rep.node, 'report'); assert.equal(rep.input.verify.length, 1);
    assert.deepEqual(rep.input.verify[0].item, { id: 1 }); assert.equal(rep.input.verify[0].output.confirmed, true);
    const events = log(dir);
    assert.ok(events.some(e => e.type === 'gate-dropped' && e.node === 'verify' && e.index === 1));
    assert.deepEqual(events.filter(e => e.type === 'outcome').map(o => [o.model, o.kind, o.ok]),
      [['rm0', 'code-review', true], ['rm1', 'code-review', false]]);
    const stats = readFileSync(join(process.env.PLUGIN_DATA, 'model-stats.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
    assert.deepEqual(stats.map(o => [o.model, o.kind, o.ok, o.src]), [['rm0', 'code-review', true, 'graph'], ['rm1', 'code-review', false, 'graph']]);
    assert.ok(stats.every(o => Object.keys(o).sort().join() === 'kind,model,ok,src,t'));
    const d5 = temp('graph-');
    const withIn = check({ name: 'i', limits: { max_agents: 2 }, nodes: { p: { agent: 'p', out: ['text'] },
      r: { agent: 'r', in: '${p.text}' } } });
    next(withIn, d5); done(withIn, d5, { node: 'p', output: { text: 'DIFF', extra: 'unrequested' }, model: 'm' });
    assert.deepEqual(next(withIn, d5)[0].input, { p: { text: 'DIFF' } }, 'in: delivers only the named field of a single-instance producer');
    // gate-dropped results never reserve writes
    const d8 = temp('graph-');
    const gw = check({ name: 'gw', limits: { max_agents: 1 }, writes: { note: { max: 1, run: ['node', '-e', '0', '${file}'] } }, nodes: {
      g: { agent: 'g', out: ['confirmed', 'body'], gate: 'confirmed == true', write: 'note' } } });
    next(gw, d8);
    assert.deepEqual(done(gw, d8, { node: 'g', output: { confirmed: false, body: 'x' }, model: 'm' }).writes, [], 'a dropped result reserves no write');
  },

  // R10: a final failure blocks only its descendants; status reflects what finished
  C7() {
    const { check } = mod('spec.js'); const { next, done, status } = mod('run.js');
    const dir = temp('graph-');
    const spec = check({ name: 'two', limits: { max_agents: 4 }, nodes: {
      a: { agent: 'a' }, c: { agent: 'c', needs: ['a'] }, b: { agent: 'b' }, d: { agent: 'd', needs: ['b'] } } });
    assert.deepEqual(next(spec, dir).map(t => t.node).sort(), ['a', 'b']);
    done(spec, dir, { node: 'a', failed: 'gave up', final: true, model: 'm' });
    assert.equal(status(spec, dir).state, 'running', 'b and d are still pending');
    assert.ok(log(dir).some(e => e.type === 'blocked' && e.node === 'c'));
    done(spec, dir, { node: 'b', output: {}, model: 'm' });
    assert.deepEqual(next(spec, dir).map(t => t.node), ['d']);
    done(spec, dir, { node: 'd', output: {}, model: 'm' });
    assert.equal(status(spec, dir).state, 'partial');
    const d2 = temp('graph-');
    const chain = check({ name: 'one', limits: { max_agents: 2 }, nodes: { a: { agent: 'a' }, c: { agent: 'c', needs: ['a'] } } });
    next(chain, d2); done(chain, d2, { node: 'a', failed: 'x', final: true, model: 'm' });
    assert.equal(status(chain, d2).state, 'blocked');
    const d4 = temp('graph-');
    const df = check({ name: 'df', limits: { max_agents: 2 }, nodes: { a: { agent: 'a' }, b: { agent: 'b', pick: { differ_from: 'a' } } } });
    assert.deepEqual(next(df, d4).map(t => t.node), ['a'], 'a differ_from target finishes before its dependent starts');
    const d3 = temp('graph-');
    const clean = check({ name: 'clean', limits: { max_agents: 3 }, nodes: {
      r: { agent: 'r', out: ['findings'] }, v: { agent: 'v {item}', for_each: '${r.findings}', out: ['ok'], gate: 'ok == true' },
      rep: { agent: 'p', needs: ['v'] } } });
    next(clean, d3); done(clean, d3, { node: 'r', output: { findings: [] }, model: 'm' });
    const [only] = next(clean, d3);
    assert.equal(only.node, 'rep', 'an empty review still reaches the report'); assert.deepEqual(only.input.v, []);
  },

  // Security: run nodes are argv, values pass whole, option-like inputs are refused
  C8() {
    const { check } = mod('spec.js'); const { next, exec } = mod('run.js');
    const spec = check({ name: 'x', limits: { max_agents: 1 }, inputs: { v: 'a' }, nodes: {
      x: { run: ['node', '-e', 'process.stdout.write(process.argv[1])', '${inputs.v}'] } } });
    const dir = temp('graph-'); const hostile = '1; touch pwned $(id) `id` "q"';
    assert.equal(next(spec, dir, { v: hostile })[0].taskType, 'run');
    assert.equal(exec(spec, dir, 'x').output.text, hostile);
    assert.equal(existsSync(join(dir, 'pwned')), false);
    assert.throws(() => next(spec, temp('graph-'), { v: '--upload-pack=x' }), /input "v" must not start with "-"/);
    const bad = check({ name: 'f', limits: { max_agents: 1 }, nodes: { f: { run: ['node', '-e', 'process.exit(3)'] } } });
    const fd = temp('graph-');
    next(bad, fd); exec(bad, fd, 'f');
    assert.equal(next(bad, fd)[0].attempt, 2); exec(bad, fd, 'f');
    assert.deepEqual(next(bad, fd), [], 'a run node stops after two failed attempts');
    assert.ok(log(fd).some(e => e.type === 'failed' && e.final === true));
    assert.throws(() => check({ name: 'g', limits: { max_agents: 1 }, nodes: { x: { run: ['echo'], for_each: ['a'] } } }), /x: for_each is only allowed on agent nodes/);
  },

  // R10/R11: retry re-offer, final failure continues, partial header, writes acknowledged once
  C9() {
    const { check } = mod('spec.js'); const { next, done, apply, status } = mod('run.js');
    const dir = temp('graph-');
    const spec = check({ name: 'w', limits: { max_agents: 4 }, writes: { note: { max: 1, run: ['node', '-e', '0', '${file}'] } }, nodes: {
      a: { agent: 'a', for_each: ['x', 'y'], out: ['v'] }, b: { agent: 'b', needs: ['a'], write: 'note' } } });
    next(spec, dir);
    done(spec, dir, { node: 'a', index: 0, output: { v: 1 }, model: 'm' });
    done(spec, dir, { node: 'a', index: 1, failed: 'schema invalid', model: 'm' });
    const retry = next(spec, dir); assert.equal(retry.length, 1); assert.equal(retry[0].attempt, 2);
    done(spec, dir, { node: 'a', index: 1, failed: 'gave up after retry and re-pick', final: true, model: 'm2' });
    assert.deepEqual(next(spec, dir).map(t => t.node), ['b']);
    const { writes } = done(spec, dir, { node: 'b', output: { body: 'All good' }, model: 'm' });
    assert.equal(writes.length, 1); assert.equal(writes[0].id, 'note#1');
    assert.match(readFileSync(writes[0].file, 'utf8'), /^Partial run: a#1 did not complete/);
    assert.equal(writes[0].argv.at(-1), writes[0].file);
    const d6 = temp('graph-');
    const many = check({ name: 'm', limits: { max_agents: 2 }, writes: { note: { max: 1, run: ['node', '-e', '0', '${file}'] } }, nodes: {
      s: { agent: 's {item}', for_each: ['x', 'y'], write: 'note' } } });
    next(many, d6);
    assert.equal(done(many, d6, { node: 's', index: 0, output: { body: 'one' }, model: 'm' }).writes.length, 1);
    assert.equal(done(many, d6, { node: 's', index: 1, output: { body: 'two' }, model: 'm' }).writes.length, 0, 'max caps writes across instances');
    let calls = 0; const runner = () => ({ status: ++calls === 1 ? 1 : 0, stderr: 'network' });
    assert.equal(apply(spec, dir, 'note#1', runner).ok, false);
    assert.equal(apply(spec, dir, 'note#1', runner).ok, true);
    assert.throws(() => apply(spec, dir, 'note#1', runner), /note#1: already applied/);
    assert.equal(calls, 2, 'an applied write never runs again');
    assert.throws(() => apply(spec, dir, 'note#9', runner), /note#9: not reserved/);
    assert.equal(calls, 2, 'an unknown write id never runs');
    assert.equal(status(spec, dir).state, 'partial');
  },

  // R3: runtime fan-out keeps room for required downstream agents
  C10() {
    const { check } = mod('spec.js'); const { next, done } = mod('run.js');
    const dir = temp('graph-');
    const spec = check({ name: 'c', limits: { max_agents: 3 }, nodes: {
      r: { agent: 'r', out: ['items'] }, v: { agent: 'v {item}', for_each: '${r.items}' }, rep: { agent: 'p', needs: ['v'] } } });
    next(spec, dir); done(spec, dir, { node: 'r', output: { items: [1, 2, 3] }, model: 'm' });
    const vs = next(spec, dir); assert.equal(vs.length, 1);
    assert.deepEqual(next(spec, dir), [], 'admission is decided once');
    assert.equal(log(dir).filter(e => e.type === 'cap-skipped' && e.node === 'v' && e.count === 2).length, 1);
    done(spec, dir, { node: 'v', index: 0, output: {}, model: 'm' });
    assert.deepEqual(next(spec, dir).map(t => t.node), ['rep']);
    const d2 = temp('graph-');
    const wide = check({ name: 'w', limits: { max_agents: 5 }, nodes: {
      r: { agent: 'r', out: ['items'] }, v: { agent: 'v {item}', for_each: '${r.items}' },
      rep: { agent: 'p {item}', for_each: ['x', 'y', 'z'], needs: ['v'] } } });
    next(wide, d2); done(wide, d2, { node: 'r', output: { items: [1, 2, 3] }, model: 'm' });
    assert.equal(next(wide, d2).length, 1, 'three report instances stay reserved');
    done(wide, d2, { node: 'v', index: 0, output: {}, model: 'm' });
    assert.equal(next(wide, d2).length, 3);
    assert.equal(log(d2).filter(e => e.type === 'dispatch').length, 5, 'never more than max_agents instances');
    const d7 = temp('graph-');
    const side = check({ name: 's', limits: { max_agents: 3 }, nodes: {
      r: { agent: 'r', out: ['items'] }, v: { agent: 'v {item}', for_each: '${r.items}' },
      f: { run: ['node', '-e', '0'] }, b: { agent: 'b', needs: ['f'] } } });
    next(side, d7); done(side, d7, { node: 'r', output: { items: [1, 2] }, model: 'm' });
    assert.equal(next(side, d7).filter(t => t.node === 'v').length, 1, 'independent pending agent nodes stay reserved');
    mod('run.js').exec(side, d7, 'f');
    assert.deepEqual(next(side, d7).map(t => t.node), ['b']);
    assert.equal(log(d7).filter(e => e.type === 'dispatch' && e.taskType === 'agent').length, 3);
  }
};
