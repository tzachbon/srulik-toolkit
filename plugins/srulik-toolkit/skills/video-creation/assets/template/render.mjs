// Renders index.html frame by frame: seek(t), screenshot, then ffmpeg joins the frames.
// node render.mjs              writes out/video.mp4 and out/poster.png
// node render.mjs --stills 2,8 writes out/stills/t2.0.png and out/stills/t8.0.png
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from './capture-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const FPS = 30;
const OUT = join(here, 'out/video.mp4');
const POSTER = { scene: 's-demo', at: 0.5 };
const i = process.argv.indexOf('--stills');
const stills = i > 0 ? process.argv[i + 1].split(',').map(Number) : null;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', e => { process.stderr.write(`page error: ${e.message}\n`); process.exitCode = 1; });
await page.goto(pathToFileURL(join(here, 'index.html')).href);
await page.evaluate(() => window.ready);
const duration = await page.evaluate(() => window.DURATION);
const scenes = await page.evaluate(() => window.SCENES);
mkdirSync(join(here, 'out'), { recursive: true });

if (stills) {
  mkdirSync(join(here, 'out/stills'), { recursive: true });
  for (const t of stills) {
    await page.evaluate(t => window.seek(t), t);
    await page.screenshot({ path: join(here, `out/stills/t${t.toFixed(1)}.png`) });
  }
  process.stdout.write(`duration ${duration.toFixed(2)}s, wrote ${stills.length} stills\n`);
} else {
  const dir = join(here, 'out/frames');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const total = Math.ceil(duration * FPS);
  for (let f = 0; f < total; f++) {
    await page.evaluate(t => window.seek(t), f / FPS);
    await page.screenshot({ path: join(dir, `${String(f).padStart(5, '0')}.png`) });
  }
  execFileSync('ffmpeg', [
    '-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', join(dir, '%05d.png'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    OUT,
  ]);
  const poster = scenes.find(s => s.id === POSTER.scene);
  await page.evaluate(t => window.seek(t), poster.start + poster.dur * POSTER.at);
  await page.screenshot({ path: join(here, 'out/poster.png') });
  rmSync(dir, { recursive: true, force: true });
  process.stdout.write(`duration ${duration.toFixed(2)}s, ${total} frames\n`);
}
// Scene starts: copy these into the T map at the top of music.mjs after a timing change.
process.stdout.write(`${scenes.map(s => `${s.id} ${s.start.toFixed(2)}-${(s.start + s.dur).toFixed(2)}`).join('\n')}\n`);
await browser.close();
