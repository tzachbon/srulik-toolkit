// Time to state. window.seek(t) sets every element for time t, so any frame can be rendered
// on its own. No CSS transitions and no timers: the renderer does not wait for them.
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const outCubic = p => 1 - Math.pow(1 - p, 3);
const inOutCubic = p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const lerp = (a, b, k) => a + (b - a) * k;
const $ = id => document.getElementById(id);

// Fade in and rise; a line grows from the left.
const appear = (el, lt, delay, dur = 0.7, rise = 24) => {
  const e = outCubic(clamp((lt - delay) / dur));
  el.style.opacity = e;
  el.style.transform = `translateY(${(1 - e) * rise}px)`;
};
const draw = (el, lt, delay, dur = 0.8) => {
  el.style.transform = `scaleX(${inOutCubic(clamp((lt - delay) / dur))})`;
};

// Captured footage: segments of capture time, each at its own speed, then a short hold.
const clip = (meta, segments, hold = 0.6) => {
  let sum = 0;
  for (const s of segments) { s.out = sum; sum += (s.to - s.from) / s.speed; }
  const dur = sum + hold;
  const captureAt = lt => {
    for (const s of segments) if (lt < s.out + (s.to - s.from) / s.speed) return s.from + Math.max(0, lt - s.out) * s.speed;
    return segments.at(-1).to;
  };
  const outOf = c => {
    for (const s of segments) if (c <= s.to) return s.out + Math.max(0, c - s.from) / s.speed;
    return dur;
  };
  const frameAt = lt => {
    const ms = captureAt(Math.min(lt, dur - hold)) * 1000;
    const t = meta.times;
    let lo = 0, hi = t.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (t[mid] <= ms) lo = mid; else hi = mid - 1;
    }
    return lo;
  };
  return { dur, frameAt, mark: k => outOf(meta.marks[k] / 1000) };
};
const mk = (meta, k, d = 0) => meta.marks[k] / 1000 + d;
const showFrame = (img, dir, frame) => {
  const src = `capture/${dir}/f${String(frame).padStart(5, '0')}.jpg`;
  if (img.dataset.src === src) return null;
  img.dataset.src = src;
  img.src = src;
  return img.decode().catch(() => {});
};
// Puts the region {cx, cy, cw} of a 1440x900 capture into the card box {x, y, w, h}.
const frameCard = (card, shot, r) => {
  const s = r.w / r.cw;
  Object.assign(card.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
  shot.style.transform = `translate(${-r.cx * s}px, ${-r.cy * s}px) scale(${s})`;
};
const tween = (a, b, k) => Object.fromEntries(Object.keys(a).map(key => [key, lerp(a[key], b[key], k)]));
const camera = (keys, lt, dur = 1.0) => {
  let r = keys[0].r;
  for (const key of keys.slice(1)) r = tween(r, key.r, inOutCubic(clamp((lt - key.at) / dur)));
  return r;
};

// ---------- Demo footage, keyed to the capture's named marks ----------
const META = window.META_EXAMPLE;
const DEMO = META
  ? clip(META, [
    { from: mk(META, 'list'), to: mk(META, 'toItem'), speed: 1.5 },
    { from: mk(META, 'toItem'), to: mk(META, 'end'), speed: 1 },
  ])
  : { dur: 6, mark: () => 2.5 };
const BOX = { x: 96, y: 96, w: 1120, h: 700 };
const DEMO_CAM = [
  { at: 0, r: { ...BOX, cx: 0, cy: 0, cw: 1440 } },
  { at: DEMO.mark('detail'), r: { ...BOX, cx: 240, cy: 64, cw: 900 } },
];
const demoShot = META ? $('demo-shot') : $('demo-ph');
(META ? $('demo-ph') : $('demo-shot')).style.display = 'none';

// ---------- Scenes: durations in seconds; starts are computed ----------
const SCENES = [
  { id: 's-title', dur: 4 },
  { id: 's-demo', dur: DEMO.dur },
  { id: 's-stat', dur: 4 },
  { id: 's-end', dur: 4, last: true },
];
let start = 0;
for (const s of SCENES) { s.start = start; start += s.dur; }
window.DURATION = start;
window.SCENES = SCENES.map(({ id, start, dur }) => ({ id, start, dur }));

const scenes = {
  's-title'(lt) {
    appear($('t-label'), lt, 0.3);
    appear($('t-sub'), lt, 0.5);
    appear($('t-l1'), lt, 0.8, 0.8, 32);
    appear($('t-l2'), lt, 1.4, 0.8, 32);
  },
  's-demo'(lt) {
    frameCard($('demo-card'), demoShot, camera(DEMO_CAM, lt, 1.2));
    appear($('d-label'), lt, 0.3);
    appear($('d-h'), lt, 0.5, 0.8, 32);
    appear($('d-foot'), lt, 0.9);
    return META ? showFrame(demoShot, 'example', DEMO.frameAt(lt)) : null;
  },
  's-stat'(lt) {
    appear($('st-label'), lt, 0.2);
    draw($('st-rule'), lt, 0.3);
    appear($('st-a'), lt, 0.5, 0.8, 32);
    appear($('st-src'), lt, 1.2);
  },
  's-end'(lt) {
    $('lockup').style.opacity = clamp(lt / 1.0);
  },
};

window.ready = document.fonts.ready;
window.seek = async t => {
  const waits = [];
  for (const s of SCENES) {
    const el = $(s.id);
    const lt = t - s.start;
    if (lt < 0 || lt >= s.dur + (s.last ? 1 : 0)) {
      el.style.opacity = 0;
      continue;
    }
    const fadeIn = s.last ? 1 : clamp(lt / 0.5);
    const fadeOut = s.last ? 1 : clamp((s.dur - lt) / 1.0);
    el.style.opacity = Math.min(fadeIn, fadeOut);
    waits.push(scenes[s.id](lt));
  }
  await Promise.all(waits);
};
