// Synthesizes an original background track timed to the scene cuts and writes out/music.wav.
// No samples and no packages: everything is generated here, so there is nothing to license.
// node music.mjs <video duration in seconds>
import { mkdirSync, writeFileSync } from 'node:fs';

// Scene cuts in seconds, from the scene starts that render.mjs prints. Update after a timing change.
const T = { demo: 4, stat: 10, end: 14 };
// Pick BAR so bar lines land on the cuts: here every cut is a whole number of 2 s bars (120 BPM).
const BAR = 2;

const SR = 44100;
const DUR = Number(process.argv[2]);
if (!(DUR > 0)) throw new Error('Pass the video duration in seconds, for example: node music.mjs 18');
const N = Math.ceil(DUR * SR);
const BEAT = BAR / 4;

const L = new Float32Array(N), R = new Float32Array(N); // dry bus
const sendL = new Float32Array(N), sendR = new Float32Array(N); // reverb send
const kickEnv = new Float32Array(N); // drives ducking

const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
let seed = 1;
const noise = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 31) - 1;

// C G Am F on a loop, ending on a held Cmaj9.
const CHORDS = [
  { bass: 48, pad: [60, 64, 67], arp: [72, 76, 79, 84] },
  { bass: 43, pad: [59, 62, 67], arp: [71, 74, 79, 83] },
  { bass: 45, pad: [60, 64, 69], arp: [72, 76, 81, 84] },
  { bass: 41, pad: [60, 65, 69], arp: [72, 77, 81, 84] },
];
const FINAL = { bass: 48, pad: [60, 64, 67, 71, 74], arp: [72, 76, 79, 83, 86] };

const add = (i, l, r, send = 0) => {
  if (i < 0 || i >= N) return;
  L[i] += l; R[i] += r;
  if (send) { sendL[i] += l * send; sendR[i] += r * send; }
};

// Additive tone: harmonics 1..H at 1/n^tilt, with optional per-harmonic decay for plucks.
function tone({ t0, dur, midi, amp, pan = 0, attack = 0.01, release = 0.3, tilt = 1.5, H = 8, hDecay = 0, decay = 0, send = 0, detune = 0 }) {
  const f = hz(midi) * 2 ** (detune / 1200);
  const s0 = Math.floor(t0 * SR), len = Math.floor((dur + release) * SR);
  const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
  const hs = [];
  for (let n = 1; n <= H && f * n < 9000; n++) hs.push(n);
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    let env = t < attack ? t / attack : 1;
    if (t > dur) env *= Math.max(0, 1 - (t - dur) / release);
    if (decay) env *= Math.exp(-t * decay);
    if (env < 1e-4 && t > attack) break;
    let v = 0;
    for (const n of hs) v += Math.sin(2 * Math.PI * f * n * t) / n ** tilt * (hDecay ? Math.exp(-t * hDecay * (n - 1)) : 1);
    v *= env * amp;
    add(s0 + k, v * gl, v * gr, send);
  }
}

function kick(t0, amp) {
  const s0 = Math.floor(t0 * SR);
  let ph = 0;
  for (let k = 0; k < 0.45 * SR; k++) {
    const t = k / SR;
    ph += 2 * Math.PI * (48 + 85 * Math.exp(-t * 28)) / SR;
    const v = Math.sin(ph) * Math.exp(-t * 7.5) * amp + (t < 0.004 ? noise() * 0.25 * amp : 0);
    add(s0 + k, v, v);
    if (s0 + k < N) kickEnv[s0 + k] = Math.max(kickEnv[s0 + k], Math.exp(-t * 6));
  }
}

function hiss(t0, dur, amp, { hp = 2, decay = 30, pan = 0, send = 0 } = {}) {
  const s0 = Math.floor(t0 * SR);
  const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
  let a = 0, b = 0;
  for (let k = 0; k < dur * SR; k++) {
    const x = noise();
    let v = x - a; a = x; // first difference is a highpass
    if (hp > 1) { const y = v; v = y - b; b = y; }
    v *= Math.exp(-(k / SR) * decay) * amp;
    add(s0 + k, v * gl, v * gr, send);
  }
}

function clap(t0, amp) {
  for (const d of [0, 0.011, 0.022]) hiss(t0 + d, 0.18, amp * (d ? 0.6 : 1), { hp: 1, decay: d === 0.022 ? 18 : 60, send: 0.35 });
}

// Noise through a rising lowpass, swelling into the cut.
function riser(t0, dur, amp) {
  const s0 = Math.floor(t0 * SR);
  let lp = 0;
  for (let k = 0; k < dur * SR; k++) {
    const p = k / (dur * SR);
    lp += (0.01 + 0.5 * p ** 2) * (noise() - lp);
    const v = lp * amp * p ** 1.5;
    add(s0 + k, v, v * 0.9, 0.5);
  }
}

function impact(t0, amp) {
  kick(t0, amp);
  tone({ t0, dur: 0.1, midi: 24, amp: amp * 0.6, attack: 0.002, release: 1.6, tilt: 3, H: 3 });
  hiss(t0, 2.5, amp * 0.18, { hp: 2, decay: 1.6, send: 0.6 });
}

// Arrangement: 0 pad, 1 adds bass and arpeggio, 2 adds kick and hats, 3 full groove, 4 end chord.
const level = (t) => (t < T.demo ? 0 : t < T.stat ? 3 : t < T.end ? 2 : 4);
for (let bar = 0; bar * BAR < DUR; bar++) {
  const t0 = bar * BAR;
  const lv = level(t0 + 0.01);
  if (lv === 4) break;
  const ch = CHORDS[bar % 4];
  const bright = lv === 0 ? 2.4 - 0.5 * (t0 / T.demo) : lv === 3 ? 1.35 : 1.7;

  for (const [i, m] of ch.pad.entries()) {
    for (const dt of [-7, 7]) tone({ t0, dur: BAR, midi: m, amp: 0.05, pan: (i - 1) * 0.5 + dt / 30, attack: 0.5, release: 0.6, tilt: bright, H: 10, detune: dt, send: 0.45 });
  }
  if (lv >= 1) {
    const hits = lv >= 3 ? [0, 1, 1.5, 2, 3, 3.5] : [0, 2];
    for (const h of hits) tone({ t0: t0 + h * BEAT, dur: lv >= 3 ? BEAT * 0.45 : BEAT * 1.8, midi: ch.bass, amp: lv >= 3 ? 0.2 : 0.14, attack: 0.008, release: 0.12, tilt: 1.8, H: 5 });
    const step = lv >= 2 ? BEAT / 2 : BEAT;
    const pattern = [0, 1, 2, 3, 2, 1, 2, 3];
    for (let s = 0; s * step < BAR - 1e-6; s++) {
      const n = ch.arp[pattern[s % pattern.length]] + (lv >= 3 && s % 4 === 3 ? 12 : 0);
      tone({ t0: t0 + s * step, dur: 0.05, midi: n, amp: lv >= 3 ? 0.055 : 0.04, pan: s % 2 ? 0.45 : -0.45, attack: 0.003, release: 0.35, tilt: 1.2, H: 6, hDecay: 6, decay: 5, send: 0.5 });
    }
  }
  if (lv >= 2) {
    for (const b of lv >= 3 ? [0, 1, 2, 3] : [0, 2]) kick(t0 + b * BEAT, lv >= 3 ? 0.55 : 0.4);
    for (let b = 0; b < 4; b++) hiss(t0 + (b + 0.5) * BEAT, 0.06, lv >= 3 ? 0.09 : 0.06, { decay: 70, pan: 0.25 });
    if (lv >= 3) for (const b of [1, 3]) clap(t0 + b * BEAT, 0.16);
  }
}
// Accents on cuts: a riser into the demo, a hit on its first frame, a soft swell under the number.
riser(T.demo - 4 * BEAT, 4 * BEAT, 0.22);
impact(T.demo, 0.7);
hiss(T.stat, 1.8, 0.08, { decay: 2.2, send: 0.5 });

// End card: the held chord and a rising arpeggio, ringing out.
if (T.end < DUR) {
  for (const [i, m] of FINAL.pad.entries()) for (const dt of [-6, 6]) tone({ t0: T.end, dur: Math.max(0.1, DUR - T.end - 1.5), midi: m, amp: 0.045, pan: (i - 2) * 0.3, attack: 0.3, release: 1.5, tilt: 1.6, H: 10, detune: dt, send: 0.55 });
  tone({ t0: T.end, dur: 0.1, midi: FINAL.bass, amp: 0.18, release: 3, tilt: 2, H: 4 });
  for (const [i, m] of FINAL.arp.entries()) tone({ t0: T.end + i * BEAT / 2, dur: 0.05, midi: m, amp: 0.05, pan: (i - 2) * 0.35, attack: 0.003, release: 1.2, tilt: 1.1, H: 6, hDecay: 4, decay: 1.6, send: 0.6 });
}

// Duck the bed under each kick.
for (let i = 0; i < N; i++) { const g = 1 - 0.3 * kickEnv[i]; L[i] *= g; R[i] *= g; }

// Freeverb-style reverb on the send bus.
function reverb(inp, spread) {
  const out = new Float32Array(N);
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((d) => ({ buf: new Float32Array(d + spread), i: 0, lp: 0 }));
  const aps = [556, 441, 341, 225].map((d) => ({ buf: new Float32Array(d + spread), i: 0 }));
  for (let n = 0; n < N; n++) {
    const x = inp[n] * 0.015;
    let y = 0;
    for (const c of combs) {
      const o = c.buf[c.i];
      c.lp = o * 0.8 + c.lp * 0.2;
      c.buf[c.i] = x + c.lp * 0.86;
      c.i = (c.i + 1) % c.buf.length;
      y += o;
    }
    for (const a of aps) {
      const o = a.buf[a.i];
      a.buf[a.i] = y + o * 0.5;
      a.i = (a.i + 1) % a.buf.length;
      y = o - y;
    }
    out[n] = y;
  }
  return out;
}
const wl = reverb(sendL, 0), wr = reverb(sendR, 23);

// Master: mix, fade in and out, tanh soft clip, normalize the peak to about -1 dBFS.
const fade = Math.min(2.5, DUR / 4);
let peak = 1e-9;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const g = clamp(t / fade) * clamp((DUR - t) / fade);
  L[i] = Math.tanh((L[i] + wl[i] * 0.9) * 1.2) * g;
  R[i] = Math.tanh((R[i] + wr[i] * 0.9) * 1.2) * g;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.89 / peak;
const pcm = Buffer.alloc(44 + N * 4);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 4, 4); pcm.write('WAVE', 8);
pcm.write('fmt ', 12); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22);
pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34);
pcm.write('data', 36); pcm.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  pcm.writeInt16LE(Math.round(clamp(L[i] * norm, -1, 1) * 32767), 44 + i * 4);
  pcm.writeInt16LE(Math.round(clamp(R[i] * norm, -1, 1) * 32767), 46 + i * 4);
}
const outDir = new URL('out/', import.meta.url);
mkdirSync(outDir, { recursive: true });
writeFileSync(new URL('music.wav', outDir), pcm);
console.log(`wrote out/music.wav ${DUR}s, cuts at ${Object.values(T).join(', ')}s`);
