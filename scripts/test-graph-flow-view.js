// Graph contract: the run index, the live view, and review fixes. Local fakes only.
'use strict';
const { assert, writeFileSync, readFileSync, existsSync, join, spawnSync, http, temp, mod, CLI, log, PLUGIN } = require('./graph-fixtures.js');
const { ids, events, TASK_YAML, drive, get, copyFileSync, vm } = require('./graph-flow-helpers.js');

module.exports = {
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
    assert.match(yaml, /run a PR as a nested graphs\/task\.yaml run/);
    assert.match(yaml, /Record it only when the plan's own\r?\n\s+Definition of Done holds/);
    assert.match(yaml, /in the plan's dependency order/);
    assert.match(yaml, /tasks lists only the first PR's tasks/);
    assert.match(yaml, /With no Git repository,\r?\n\s+back up each file first/);
  },

  // the live view scrolls the last dispatched card into view once, not on every re-render
  C50() {
    const { PAGE } = mod('view.js');
    const section = PAGE.split('// ---- state folded from run.jsonl')[1].split('// ---- preferences')[0];
    const pg = vm.runInNewContext(section + '\n;({ run, apply })');
    pg.apply({ type: 'spec', t: 1, name: 'x', nodes: ['a', 'b'], edges: {} });
    assert.equal(pg.run.active, undefined, 'nothing is active before a dispatch');
    pg.apply({ type: 'dispatch', t: 2, node: 'a', index: 0, taskType: 'agent' });
    assert.equal(pg.run.active, 'a#0');
    pg.apply({ type: 'dispatch', t: 3, node: 'b', index: 1, round: 2, taskType: 'agent' });
    assert.equal(pg.run.active, 'b#1.r2', 'the latest dispatch wins, round included');
    pg.apply({ type: 'result', t: 4, node: 'b', index: 1, round: 2, output: {} });
    assert.equal(pg.run.active, 'b#1.r2', 'a result keeps the last active card');
    // render's scroll step: scrolls once per new active card
    const step = PAGE.split('// ---- follow the active card')[1].split(/\r?\n}\r?\n/)[0] + '\n}';
    const scrolled = [];
    const board = { querySelector: sel => ({ scrollIntoView: o => scrolled.push([sel, o.behavior]) }) };
    const run = { active: 'a#0', dispatches: 1 }; let reduce = true;
    const f = vm.runInNewContext(step + '\n;follow', { run, CSS: { escape: s => s }, matchMedia: () => ({ matches: reduce }) });
    f({ querySelector: () => null });
    f(board); f(board);
    assert.deepEqual(scrolled, [['[data-id="a#0"]', 'auto']], 'a card not drawn yet is retried; then one scroll per dispatch; reduced motion jumps');
    run.dispatches = 2; reduce = false; f(board);
    assert.deepEqual(scrolled[1], ['[data-id="a#0"]', 'smooth'], 'a retry of the same card scrolls again, smoothly by default');
    pg.apply({ type: 'dispatch', t: 5, node: 'b', index: 1, round: 2, taskType: 'agent', attempt: 2 });
    assert.equal(pg.run.dispatches, 3, 'every dispatch counts, retries included');
    assert.match(PAGE.split('function render() {')[1].split('\n}\n')[0], /follow\(board\);/, 'render follows the active card');
  },
};
