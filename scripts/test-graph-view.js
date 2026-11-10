// Graph contract: node output files, attachments, the run index and the live view's /nodes route. Local fakes only.
'use strict';
const { assert, writeFileSync, readFileSync, join, http, temp, mod, log } = require('./graph-fixtures.js');
const { existsSync, mkdirSync, readdirSync, rmSync, symlinkSync } = require('node:fs');

const get = (port, path, host = `127.0.0.1:${port}`) => new Promise((ok, bad) => http.get({ host: '127.0.0.1', port, path, headers: { host }, timeout: 2000 },
  res => { let body = ''; res.on('data', c => { body += c; }); res.on('end', () => ok({ status: res.statusCode, type: res.headers['content-type'], sniff: res.headers['x-content-type-options'], body })); })
  .on('timeout', function () { this.destroy(new Error('no response within 2 s')); }).on('error', bad));

module.exports = {
  // node output files and attachments
  C35() {
    const { check } = mod('spec.js'); const { next, done, exec } = mod('run.js');
    const dir = temp('graph-');
    const spec = check({ name: 'g', limits: { max_agents: 4 }, nodes: { r: { agent: 'r {item}', for_each: ['bugs'], out: ['findings'] } } });
    next(spec, dir);
    const bad = (attachments, re) => assert.throws(() => done(spec, dir, { node: 'r', index: 0, output: { findings: [] }, attachments, model: 'm' }), re);
    bad([{ name: '../x', text: 'a' }], /r#0: attachment name "\.\.\/x" is invalid/);
    bad([{ name: '.hidden', text: 'a' }], /r#0: attachment name "\.hidden" is invalid/);
    bad(Array.from({ length: 11 }, (_, i) => ({ name: `a${i}`, text: '' })), /r#0: attachments must be a list of at most 10 \{name, text\}/);
    bad([{ name: 'big.txt', text: 'x'.repeat(1024 * 1024 + 1) }], /r#0: attachment "big\.txt" is over 1 MB/);
    bad([{ name: 'n.md', text: 3 }], /r#0: attachments must be a list of at most 10 \{name, text\}/);
    assert.equal(log(dir).some(e => e.type === 'result'), false, 'a rejected attachment records no result, so the instance stays retryable');
    // the index becomes part of a file path, so only an admitted instance may report
    const victim = join(dir, '..', `victim-${process.pid}.md`);
    for (const index of [`0/../../../victim-${process.pid}`, 1, -1, 0.5])
      assert.throws(() => done(spec, dir, { node: 'r', index, output: { findings: [] } }), /r#.*: no such instance/, `index ${index} is refused`);
    assert.ok(!existsSync(victim), 'nothing is written outside the run directory');
    done(spec, dir, { node: 'r', index: 0, output: { findings: [{ title: 'Lock leak' }, { title: 'Off by one' }] }, model: 'opus',
      attachments: [{ name: 'notes.md', text: '# How I reviewed' }] });
    const res = log(dir).find(e => e.type === 'result');
    assert.equal(res.file, join(dir, 'nodes', 'r-0.md'), 'the result names its absolute output file');
    assert.equal(res.summary, 'findings: 2');
    assert.deepEqual(res.attachments, ['notes.md'], 'the log keeps attachment names, not their text');
    const body = readFileSync(res.file, 'utf8');
    assert.match(body, /^# r#0\nitem: bugs\nmodel: opus\n\n```json\n/, 'the file starts with the node, item and model');
    assert.match(body, /"title": "Lock leak"/, 'a JSON output is pretty-printed');
    assert.equal(readFileSync(join(dir, 'nodes', 'r-0', 'notes.md'), 'utf8'), '# How I reviewed');
    // a command node gets its file through exec
    const d2 = temp('graph-');
    const cmd = check({ name: 'c', limits: { max_agents: 1 }, nodes: { f: { run: [process.execPath, '-e', 'process.stdout.write("diff --git a b\\nline 2")'] } } });
    next(cmd, d2); exec(cmd, d2, 'f');
    assert.equal(readFileSync(join(d2, 'nodes', 'f-0.md'), 'utf8'), '# f#0\n\ndiff --git a b\nline 2', 'a text output is written verbatim, with no item line for a single instance');
    assert.equal(log(d2).find(e => e.type === 'result').summary, 'text: diff --git a b');
    const mixed = require('../plugins/srulik-toolkit/scripts/graph/nodes.js').writeNodeFiles(d2, 'm', 0, null, null, { text: 'short', findings: [{ id: 7 }] }, []);
    assert.match(readFileSync(mixed, 'utf8'), /short\n\n```json\n[\s\S]*"findings"[\s\S]*"id": 7/, 'text plus other fields keeps the other fields in the file');
  },

  // needs: gives paths and summaries, agent tasks get the run index, and the index tracks every state
  C36() {
    const { check } = mod('spec.js'); const { next, done } = mod('run.js');
    const dir = temp('graph-');
    const spec = check({ name: 'g', limits: { max_agents: 8 }, nodes: {
      review: { agent: 'r {item}', for_each: ['bugs', 'perf', 'sec'], out: ['findings'] },
      verify: { agent: 'v {item}', for_each: '${review.findings}', out: ['confirmed'], gate: 'confirmed == true' },
      report: { agent: 'p', needs: ['verify'] }, other: { agent: 'o', needs: ['report'] } } });
    const tasks = next(spec, dir);
    assert.equal(tasks[0].graph, join(dir, 'nodes', 'index.md'), 'every agent task carries the run index path');
    const index = () => readFileSync(join(dir, 'nodes', 'index.md'), 'utf8');
    assert.match(index(), /\| review#0 \| bugs \| running \|/);
    assert.match(index(), /\| verify \| \| not started \|/);
    done(spec, dir, { node: 'review', index: 0, output: { findings: [{ id: 1 }, { id: 2 }] }, model: 'm0' });
    done(spec, dir, { node: 'review', index: 1, attempt: 1, failed: 'crashed' });
    done(spec, dir, { node: 'review', index: 2, attempt: 1, failed: 'crashed', final: true });
    assert.match(index(), /\| review#0 \| bugs \| done \| m0 \| findings: 2 \| nodes\/review-0\.md \|/);
    assert.match(index(), /\| review#1 \| perf \| retrying \(attempt 2\) \|/);
    assert.match(index(), /\| review#2 \| sec \| failed \|.*crashed/);
    next(spec, dir); // re-dispatch perf
    done(spec, dir, { node: 'review', index: 1, attempt: 2, output: { findings: [] }, model: 'm1' });
    next(spec, dir);
    done(spec, dir, { node: 'verify', index: 0, output: { confirmed: true }, model: 'v', attachments: [{ name: 'repro.js', text: 'x' }] });
    done(spec, dir, { node: 'verify', index: 1, output: { confirmed: false }, model: 'v' });
    assert.match(index(), /\| verify#0 \| \{"id":1\} \| done \| v \| confirmed: true \| nodes\/verify-0\.md \+ repro\.js \|/);
    assert.match(index(), /\| verify#1 \| \{"id":2\} \| dropped \|/);
    const [rep] = next(spec, dir);
    assert.deepEqual(rep.input.verify, [{ index: 0, item: { id: 1 }, file: join(dir, 'nodes', 'verify-0.md'), summary: 'confirmed: true' }],
      'needs: gives each survivor\'s file and summary, not its output');
    assert.match(index(), /\| report#0 \| \| running \|/);
    assert.match(index(), /\| other \| \| not started \|/);
    // a failing index write never breaks the state transition
    rmSync(join(dir, 'nodes', 'index.md')); mkdirSync(join(dir, 'nodes', 'index.md'));
    done(spec, dir, { node: 'report', output: {}, model: 'p' });
    assert.ok(log(dir).some(e => e.type === 'result' && e.node === 'report'), 'the event is recorded although the index could not be replaced');
    assert.deepEqual(readdirSync(join(dir, 'nodes')).filter(f => f.endsWith('.tmp')), [], 'no temp file is left behind');
    rmSync(join(dir, 'nodes', 'index.md'), { recursive: true });
    // the CLI's direct appends (pick, end) refresh the index too
    const { refreshIndex } = mod('run.js');
    refreshIndex(dir);
    assert.match(index(), /\| report#0 \| \| done \|/);
    const blocked = temp('graph-');
    const bspec = check({ name: 'b', limits: { max_agents: 2 }, nodes: { a: { agent: 'a' }, b: { agent: 'b', needs: ['a'] } } });
    next(bspec, blocked); done(bspec, blocked, { node: 'a', attempt: 1, failed: 'x', final: true });
    assert.match(readFileSync(join(blocked, 'nodes', 'index.md'), 'utf8'), /\| b \| \| blocked by a \|/);
    // apply holds no run lock, so a done landing while it runs must still show in the index it leaves behind
    const { apply } = mod('run.js');
    const d6 = temp('graph-');
    const wspec = check({ name: 'w', limits: { max_agents: 2 }, writes: { note: { max: 1, run: [process.execPath, '-e', '0', '${file}'] } },
      nodes: { s: { agent: 's', out: ['body'], write: 'note' }, o: { agent: 'o' } } });
    next(wspec, d6); done(wspec, d6, { node: 's', output: { body: 'b' }, model: 'm' });
    apply(wspec, d6, 'note#1', () => { done(wspec, d6, { node: 'o', output: {}, model: 'm' }); return { status: 0 }; });
    assert.match(readFileSync(join(d6, 'nodes', 'index.md'), 'utf8'), /\| o#0 \| \| done \|/, 'the index keeps a result recorded during apply');
    // in: still delivers the named field inline
    const d5 = temp('graph-');
    const withIn = check({ name: 'i', limits: { max_agents: 2 }, nodes: { p: { agent: 'p', out: ['text'] }, r: { agent: 'r', in: '${p.text}' } } });
    next(withIn, d5); done(withIn, d5, { node: 'p', output: { text: 'DIFF' }, model: 'm' });
    assert.deepEqual(next(withIn, d5)[0].input, { p: { text: 'DIFF' } });
  },

  // node names are safe file names
  C37() {
    const { check } = mod('spec.js');
    const base = { name: 'g', limits: { max_agents: 2 } };
    assert.throws(() => check({ ...base, nodes: { Bad: { agent: 'x' } } }), /Bad: node name must match \[a-z0-9_-\]\+/);
    assert.throws(() => check({ ...base, nodes: { 'a.b': { agent: 'x' } } }), /a\.b: node name must match \[a-z0-9_-\]\+/);
    assert.ok(check({ ...base, nodes: { 'fetch_2-x': { agent: 'x' } } }));
  },

  // the view serves node files read-only, and nothing outside nodes/
  async C38() {
    const { serve } = mod('view.js');
    const dir = temp('view-');
    mkdirSync(join(dir, 'nodes', 'r-0'), { recursive: true });
    writeFileSync(join(dir, 'run.jsonl'), '{"type":"spec"}\n');
    writeFileSync(join(dir, 'nodes', 'index.md'), '# index');
    writeFileSync(join(dir, 'nodes', 'r-0.md'), '<script>x</script>');
    writeFileSync(join(dir, 'nodes', 'r-0', 'notes.md'), 'notes');
    const outside = join(temp('outside-'), 'secret.txt'); writeFileSync(outside, 'secret');
    let linked = true;
    try { symlinkSync(outside, join(dir, 'nodes', 'r-0', 'link.txt')); } catch { linked = false; } // Windows without symlink rights
    const server = await serve(dir, 0);
    const { port } = server.address();
    try {
      for (const [path, body] of [['/nodes/index.md', '# index'], ['/nodes/r-0.md', '<script>x</script>'], ['/nodes/r-0/notes.md', 'notes']]) {
        const r = await get(port, path);
        assert.equal(r.status, 200, path); assert.equal(r.body, body, path);
        assert.equal(r.type, 'text/plain; charset=utf-8', `${path} is plain text, so markup never runs`);
        assert.equal(r.sniff, 'nosniff', path);
      }
      for (const path of ['/nodes/../run.jsonl', '/nodes/r-0/../../run.jsonl', '/nodes/%2e%2e/run.jsonl', '/nodes/r-0/%2e%2e%2f%2e%2e%2frun.jsonl', '/nodes/missing-0.md', '/nodes/r-0/', '/nodes/R-0.md'])
        assert.equal((await get(port, path)).status, 404, `${path} is refused`);
      if (linked) assert.equal((await get(port, '/nodes/r-0/link.txt')).status, 404, 'a symlink leading outside nodes/ is refused');
      assert.equal((await get(port, '/nodes/r-0.md', 'evil.example')).status, 403, 'the Host check still runs first');
    } finally { server.close(); }
  },

  // the page: no markup injection, a remembered theme and layout, reduced motion
  C39() {
    const { PAGE } = mod('view.js');
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(PAGE), 'the page writes values with textContent only');
    assert.match(PAGE, /get\('graph-theme'\)/, 'the theme choice is remembered');
    assert.match(PAGE, /try \{ return localStorage\.getItem\(k\); \} catch/, 'blocked storage falls back to the defaults instead of stopping the page');
    assert.match(PAGE, /if \(!list\.length && !run\.capSkipped\[node\]\) return/, 'a fan-out skipped by max_agents shows its skipped card, not "no items"');
    assert.match(PAGE, /const run = \{ spec: null, admitted: map\(\), inst: map\(\), blocked: map\(\), capSkipped: map\(\)/, 'node-keyed page state has no prototype');
    assert.match(PAGE, /const map = \(\) => Object\.create\(null\)/);
    assert.match(PAGE, /matchMedia\('\(prefers-color-scheme: dark\)'\)/, 'without a choice, the theme follows the system');
    assert.match(PAGE, /get\('graph-layout'\)/, 'the layout choice is remembered');
    assert.match(PAGE, /\|\| 'down'/, 'top-down is the default layout');
    assert.match(PAGE, /@media \(prefers-reduced-motion: ?reduce\)/, 'animation stops under reduced motion');
    assert.match(PAGE, /getText\(`nodes\/\$\{i\.node\}-/, 'attachments are fetched from /nodes');
    assert.match(PAGE, /getText\('nodes\/index\.md'\)/, 'the run index is fetched from /nodes');
    assert.match(PAGE, /case 'result':[^\n]*\n[^\n]*error: undefined|case 'result':[^\n]*error: undefined/, 'a successful retry clears the earlier attempt\'s error');
  },
};
