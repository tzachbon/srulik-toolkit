// Shared setup for the graph contract tests. Loaded before any graph module so durable state is isolated.
'use strict';
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, readFileSync, appendFileSync, existsSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const http = require('node:http');

const temps = [];
const temp = prefix => { const d = mkdtempSync(join(tmpdir(), prefix)); temps.push(d); return d; };
process.env.PLUGIN_DATA = temp('graph-state-'); // isolate durable state before any module loads
delete process.env.CLAUDE_PLUGIN_DATA;
process.on('exit', () => temps.forEach(d => rmSync(d, { recursive: true, force: true })));

const PLUGIN = resolve(__dirname, '../plugins/srulik-toolkit');
const G = join(PLUGIN, 'scripts', 'graph');
const mod = name => require(join(G, name)); // lazy: each group needs only its own modules
const CLI = join(PLUGIN, 'scripts', 'graph.js');
const log = dir => readFileSync(join(dir, 'run.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const NOW = Date.parse('2026-11-09T00:00:00Z');

const cands = [
  { provider: 'claudeAgent', model: 'claude-opus-5-5', effort: 'high' },
  { provider: 'codex', model: 'gpt-6.1-sol', effort: 'high' },
  { provider: 'oh-my-pi', model: '9router/kimi/k3.1-pro', effort: 'high' }];
const aaModel = (slug, creator, ii, tb, hle, inP, outP) => ({ slug, id: slug, name: slug, creator, intelligence_index: ii,
  input_usd_per_million_tokens: inP, output_usd_per_million_tokens: outP,
  benchmarks: { terminal_bench_4_0: tb, humanitys_last_exam: hle } });
const aa = [
  aaModel('claude-opus-5-5', 'Anthropic', 59, 0.6, 0.6, 4, 20),
  aaModel('gpt-6-1-sol', 'OpenAI', 57, 0.58, 0.5, 2, 10),
  aaModel('kimi-k3-1-pro', 'Moonshot AI', 46, 0.4, 0.4, 0.5, 2),
  aaModel('weak-a', 'X', 20, 0.1, 0.1, 1, 1),
  aaModel('weak-b', 'Y', 25, 0.2, 0.2, 1, 1)];
const data = () => ({ aa, arena: { webdev: [{ model_name: 'Claude Opus 5.5 (Max)', rating: 1818 }, { model_name: 'GPT-6.1 Sol (Max)', rating: 1743 }] },
  notes: { 'gpt-6.1-sol': { prefer: ['code-review'], avoid: ['ui-ux'] } }, outcomes: [], usage: { accounts: [] },
  now: NOW, explore: false, random: () => { throw new Error('random used without explore'); } });

module.exports = { assert, mkdtempSync, writeFileSync, readFileSync, appendFileSync, existsSync, rmSync, tmpdir, join, resolve,
  spawnSync, http, temp, PLUGIN, G, mod, CLI, log, NOW, cands, aaModel, aa, data };
