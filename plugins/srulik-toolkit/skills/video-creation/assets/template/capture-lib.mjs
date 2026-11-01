// Shared capture session: headless Chromium at 1440x900 @2x, a drawn cursor with a click ripple,
// eased mouse moves, a screenshot loop with per-frame timestamps, and named marks.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
export const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');

// Headless browsers draw no pointer, so the page draws one.
const CURSOR = () => {
  const install = () => {
    if (document.getElementById('capture-cursor')) return;
    const c = document.createElement('div');
    c.id = 'capture-cursor';
    c.innerHTML = '<svg width="26" height="34" viewBox="0 0 22 30"><path d="M2 2 L2 23 L7.5 18 L11.5 27 L15.5 25.2 L11.5 16.5 L19 16.5 Z" fill="#000" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: '2147483647', pointerEvents: 'none', transform: `translate(${window.__cx ?? -200}px, ${window.__cy ?? -200}px)` });
    document.documentElement.appendChild(c);
  };
  window.addEventListener('mousemove', (e) => {
    window.__cx = e.clientX - 2;
    window.__cy = e.clientY - 2;
    install();
    document.getElementById('capture-cursor').style.transform = `translate(${window.__cx}px, ${window.__cy}px)`;
  }, true);
  window.addEventListener('mousedown', (e) => {
    const r = document.createElement('div');
    Object.assign(r.style, { position: 'fixed', left: `${e.clientX - 16}px`, top: `${e.clientY - 16}px`, width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,0,0,0.2)', zIndex: '2147483646', pointerEvents: 'none', transition: 'transform 450ms ease-out, opacity 450ms ease-out' });
    document.documentElement.appendChild(r);
    requestAnimationFrame(() => { r.style.transform = 'scale(2)'; r.style.opacity = '0'; });
    setTimeout(() => r.remove(), 500);
  }, true);
};

export async function session(dir, contextOptions = {}) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, ...contextOptions });
  await context.addInitScript(CURSOR);
  const page = await context.newPage();

  let mx = 720, my = 450;
  const moveTo = async (x, y, ms = 800) => {
    const steps = Math.max(10, Math.round(ms / 20));
    const sx = mx, sy = my;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      await page.mouse.move(sx + (x - sx) * e, sy + (y - sy) * e);
      await page.waitForTimeout(16);
    }
    mx = x; my = y;
  };
  const clickOn = async (locator, ms) => {
    const b = await locator.boundingBox();
    await moveTo(b.x + b.width / 2, b.y + b.height / 2, ms);
    await page.waitForTimeout(150);
    await page.mouse.down();
    await page.waitForTimeout(70);
    await page.mouse.up();
  };

  // Screenshots arrive unevenly; the timeline picks frames by these timestamps.
  const times = [];
  const marks = {};
  let capturing = false;
  let n = 0;
  let t0 = 0;
  let loop;
  const start = () => {
    capturing = true;
    t0 = Date.now();
    loop = (async () => {
      while (capturing) {
        const a = Date.now();
        const ok = await page.screenshot({ path: join(dir, `f${String(n).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 90 }).then(() => true, () => false);
        if (!ok) continue;
        times.push(Math.round((a + Date.now()) / 2 - t0));
        n++;
      }
    })();
  };
  const mark = (k) => { marks[k] = Date.now() - t0; };
  const finish = async (name, extra = {}) => {
    capturing = false;
    await loop;
    await browser.close();
    const meta = { frames: n, marks, times, ...extra };
    writeFileSync(join(dir, 'meta.js'), `window.${name} = ${JSON.stringify(meta)};\n`);
    return meta;
  };
  return { page, context, moveTo, clickOn, start, mark, finish };
}
