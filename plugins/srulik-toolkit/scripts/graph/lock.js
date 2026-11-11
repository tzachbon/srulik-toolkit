// Owner-recording file locks for the run log, writes and scoring. A lock is live while its process runs on this host.
'use strict';
const { readFileSync, mkdirSync, openSync, closeSync, rmSync, writeSync } = require('node:fs');
const { hostname } = require('node:os');
const { join } = require('node:path');

// A claim lock names its owner. It is live while that process runs on this host; a lock from another
// host, or one that can't be read, is treated as live, so recovery never unlocks a write that may be running.
function lockOwnerAlive(lock) {
  let owner;
  try { owner = JSON.parse(readFileSync(lock, 'utf8')); } catch { return true; }
  if (owner?.host !== hostname() || !Number.isInteger(owner?.pid)) return true;
  try { process.kill(owner.pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}


// One writer at a time: each state-changing call holds <run-dir>/run.lock while it folds and appends,
// so parallel next/done calls never decide from the same stale state. The lock records its owner.
function withRunLock(dir, fn, name = 'run.lock') {
  mkdirSync(dir, { recursive: true });
  const lock = join(dir, name);
  const until = Date.now() + 30000;
  for (;;) {
    if (tryLock(lock)) break;
    if (!lockOwnerAlive(lock) && reclaimStale(lock)) continue;
    if (Date.now() > until) throw new Error(`busy: ${lock} is held by another process`);
    pause();
  }
  try { return fn(); } finally { rmSync(lock, { force: true }); }
}

const pause = () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);

// Create a lock file exclusively, recording its owner. False when it already exists.
function tryLock(lock) {
  let fd;
  try { fd = openSync(lock, 'wx'); } catch (error) { if (error.code === 'EEXIST') return false; throw error; }
  try { writeSync(fd, JSON.stringify({ pid: process.pid, host: hostname() })); } finally { closeSync(fd); }
  return true;
}

// Remove a lock whose owner is gone. Only the holder of <lock>.reclaim removes it, after reading it again,
// so a reclaimer that saw the old lock can never delete a replacement another process just took.
// Returns false when another reclaimer holds the guard.
function reclaimStale(lock) {
  const guard = `${lock}.reclaim`;
  if (!tryLock(guard)) {
    // ponytail: a reclaimer that died inside the three lines below leaves a dead guard, removed here.
    // Two processes racing on such a dead guard could still collide; add a lease if that ever shows up.
    if (!lockOwnerAlive(guard)) rmSync(guard, { force: true });
    return false;
  }
  try { if (!lockOwnerAlive(lock)) rmSync(lock, { force: true }); } finally { rmSync(guard, { force: true }); }
  return true;
}

// Take the claim lock for one write. Returns the release function. A lock whose owner is still running
// always refuses; one whose owner is gone refuses as an unknown outcome unless `takeStale` (only --mark).
function claim(dir, id, lock, takeStale) {
  for (;;) {
    if (tryLock(lock)) return () => rmSync(lock, { force: true });
    if (lockOwnerAlive(lock)) throw new Error(`${id}: still being applied by process ${readFileSync(lock, 'utf8').trim() || 'unknown'}; wait for it to finish`);
    if (!takeStale) throw new Error(`${id}: outcome unknown; check the target, then apply with --mark applied or --mark failed`);
    if (!reclaimStale(lock)) pause(); // the owner is gone; retry the exclusive create, which a live apply could still win
  }
}

module.exports = { withRunLock, claim, pause, tryLock, reclaimStale, lockOwnerAlive };
