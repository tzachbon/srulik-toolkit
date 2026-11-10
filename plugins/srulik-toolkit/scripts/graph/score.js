// Weekly thread scoring: labeled threads become counted outcomes. Never keeps text or thread IDs.
'use strict';

const FAILURE = new Set(['verify-confirmed-defect', 'user-redirect', 'reverted', 'redone-other-model']);

// true or false when a thread's outcome is decided; null while it isn't yet.
const verdict = thread => {
  const signals = thread.signals ?? [];
  return signals.some(s => FAILURE.has(s)) ? false : signals.includes('pr-merged') ? true : null;
};

function scoreThreads(threads, { now = Date.now(), since = 0 } = {}) {
  return threads.flatMap(thread => {
    if (!(thread.updated > since) || !thread.model || !thread.kind) return [];
    const ok = verdict(thread);
    return ok === null ? [] : [{ t: now, model: thread.model, kind: thread.kind, ok, src: 'thread' }];
  });
}

// The newest time that can be marked scored: just before the oldest thread still undecided.
// Only a scorable thread waits, and only for MAX_WAIT; one that never gets a signal stops holding the rest back.
const MAX_WAIT = 30 * 864e5;
function nextWatermark(threads, since, now = Date.now()) {
  const fresh = threads.filter(t => t.updated > since);
  const undecided = fresh.filter(t => t.model && t.kind && verdict(t) === null && now - t.updated < MAX_WAIT).map(t => t.updated);
  return undecided.length ? Math.max(since, Math.min(...undecided) - 1) : Math.max(since, ...fresh.map(t => t.updated));
}

module.exports = { scoreThreads, nextWatermark };
