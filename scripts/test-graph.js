#!/usr/bin/env node
// Contract checks for agent-swarm graph mode. All data is local fakes; no network, no real state.
// Run all: node scripts/test-graph.js    Run some: node scripts/test-graph.js C1 C2
'use strict';
require('./graph-fixtures.js'); // isolates PLUGIN_DATA before any graph module loads
const groups = { ...require('./test-graph-run.js'), ...require('./test-graph-models.js'), ...require('./test-graph-review.js'), ...require('./test-graph-e2e.js'), ...require('./test-graph-later.js'), ...require('./test-graph-view.js') };
const order = Object.keys(groups).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

(async () => {
  const wanted = process.argv.slice(2);
  for (const name of order) {
    if (wanted.length && !wanted.includes(name)) continue;
    await groups[name]();
    console.log(`${name} ok`);
  }
  console.log('graph contract checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
