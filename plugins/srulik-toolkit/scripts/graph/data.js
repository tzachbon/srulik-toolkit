// Data for model resolution: state directory, LMArena leaderboard cache, owner notes, outcomes, usage, AA.
'use strict';
const { readFileSync, writeFileSync, renameSync, rmSync, mkdirSync, existsSync } = require('node:fs');
const { join, dirname } = require('node:path');
const { spawnSync } = require('node:child_process');
const { parse } = require('./yaml.js');

const ARENA = 'https://datasets-server.huggingface.co/rows?dataset=lmarena-ai/leaderboard-dataset';
const ARENA_CONFIGS = ['webdev', 'agent', 'agent_steerability'];
const DAY = 864e5;
const PAGE = 100; // the rows endpoint rejects length > 100

// Durable graph state never falls back to the OS temp directory: losing it erases evidence.
const stateDir = env => env.PLUGIN_DATA || env.CLAUDE_PLUGIN_DATA || join(env.HOME || env.USERPROFILE, '.srulik-toolkit');

function writeAtomic(path, text) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temp = `${path}.${process.pid}.tmp`;
  try { writeFileSync(temp, text, { mode: 0o600 }); renameSync(temp, path); } finally { rmSync(temp, { force: true }); }
}

function readJSON(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

async function fetchConfig(fetch, config) {
  const rows = [];
  for (let offset = 0, total = Infinity; offset < total; offset += PAGE) {
    const url = `${ARENA}&config=${encodeURIComponent(config)}&split=latest&offset=${offset}&length=${PAGE}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`LMArena ${config} returned HTTP ${response.status}`);
    const body = await response.json();
    total = Number(body.num_rows_total ?? 0);
    for (const { row } of body.rows ?? []) {
      if (row.category !== 'overall') continue;
      rows.push({ model_name: row.model_name, ...(row.rating !== undefined ? { rating: row.rating } : { score: row.score }) });
    }
    if (!(body.rows ?? []).length) break;
  }
  return rows;
}

async function loadArena({ fetch = globalThis.fetch, cachePath, now = Date.now(), configs = ARENA_CONFIGS, force = false } = {}) {
  const cache = readJSON(cachePath);
  const fresh = cache && now - Date.parse(cache.fetched_at) < DAY && now >= Date.parse(cache.fetched_at);
  if (cache && fresh && !force) return { ...cache.data, stale: false, fetched_at: cache.fetched_at };
  try {
    const data = {};
    for (const config of configs) data[config] = await fetchConfig(fetch, config);
    const fetched_at = new Date(now).toISOString();
    writeAtomic(cachePath, JSON.stringify({ fetched_at, data }));
    return { ...data, stale: false, fetched_at };
  } catch (error) {
    if (cache) return { ...cache.data, stale: true, fetched_at: cache.fetched_at, error: error.message };
    return { ...Object.fromEntries(configs.map(c => [c, []])), stale: true, error: error.message };
  }
}

function readNotes(paths) {
  const notes = {}; const errors = [];
  for (const path of paths) {
    if (!existsSync(path)) continue;
    try { Object.assign(notes, parse(readFileSync(path, 'utf8'))?.models ?? {}); }
    catch (error) { errors.push(`${path}: ${error.message}`); }
  }
  return { notes, errors };
}

function readOutcomes(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').flatMap(line => {
    try { const o = JSON.parse(line); return o && o.model && o.kind && typeof o.ok === 'boolean' ? [o] : []; } catch { return []; }
  });
}

// Artificial Analysis models through the existing models.js cache, run as a child so its cache rules apply.
function loadAA() {
  const script = join(__dirname, '..', 'models.js');
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8', timeout: 70000, maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error((result.stderr || 'models.js failed').trim());
  const out = JSON.parse(result.stdout);
  return { models: out.models.filter(m => !m.deprecated), fetched_at: out.fetched_at };
}

async function loadAll({ env = process.env, usageFile, cwd = process.cwd(), aaLoader = loadAA, arenaLoader } = {}) {
  const state = stateDir(env); const errors = {};
  const guard = async (name, fn, empty) => { try { return await fn(); } catch (e) { errors[name] = e.message; return empty; } };
  const aa = await guard('aa', aaLoader, { models: [] });
  const arena = await guard('arena', () => (arenaLoader || (() => loadArena({ cachePath: join(state, 'arena.json') })))(), { stale: true });
  if (arena.error) errors.arena = arena.error;
  const { notes, errors: noteErrors } = readNotes([join(state, 'model-notes.yaml'), join(cwd, '.agents', 'model-notes.yaml')]);
  if (noteErrors.length) errors.notes = noteErrors.join('; ');
  const outcomes = readOutcomes(join(state, 'model-stats.jsonl'));
  const usage = await guard('usage', () => usageFile ? JSON.parse(readFileSync(usageFile, 'utf8'))
    : require('../models.js').readUsage(), { accounts: [], notes: ['quota unknown'] });
  return { aa: Array.isArray(aa) ? aa : aa.models ?? [], aa_fetched_at: aa.fetched_at ?? null, arena, notes, outcomes, usage, errors };
}

module.exports = { stateDir, loadArena, readNotes, readOutcomes, loadAll };
