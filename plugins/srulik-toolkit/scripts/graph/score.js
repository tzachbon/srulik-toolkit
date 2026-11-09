// Weekly thread scoring: labeled threads become counted outcomes. Never keeps text or thread IDs.
'use strict';

const FAILURE = new Set(['verify-confirmed-defect', 'user-redirect', 'reverted', 'redone-other-model']);

function scoreThreads(threads, { now = Date.now(), since = 0 } = {}) {
  return threads.flatMap(thread => {
    if (!(thread.updated > since) || !thread.model || !thread.kind) return [];
    const signals = thread.signals ?? [];
    const ok = signals.some(s => FAILURE.has(s)) ? false : signals.includes('pr-merged') ? true : null;
    return ok === null ? [] : [{ t: now, model: thread.model, kind: thread.kind, ok, src: 'thread' }];
  });
}

module.exports = { scoreThreads };
