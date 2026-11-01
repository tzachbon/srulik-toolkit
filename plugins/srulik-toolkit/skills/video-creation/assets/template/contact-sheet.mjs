// Pulls a frame every 5 s out of the encoded video and lays them out in a grid with timestamps.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from './capture-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const video = join(here, 'out/video.mp4');
const dir = join(here, 'out/sheet');
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video]).toString());
for (let t = 0; t < duration; t += 5) {
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(t), '-i', video, '-frames:v', '1', join(dir, `t${String(t).padStart(3, '0')}.png`)]);
}
const files = readdirSync(dir).filter(f => f.endsWith('.png')).sort();
const cells = files.map(f => `<figure><img src="${f}"><figcaption>${Number(f.slice(1, 4))} s</figcaption></figure>`).join('');
writeFileSync(join(dir, 'index.html'), `<!doctype html><meta charset="utf-8"><style>
  body { margin: 0; padding: 24px; background: #111; font: 500 20px monospace; color: #ddd; display: grid; grid-template-columns: repeat(4, 640px); gap: 16px; width: max-content; }
  figure { margin: 0; } img { width: 640px; height: 360px; display: block; outline: 1px solid #333; } figcaption { padding: 6px 2px 0; }
</style>${cells}`);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2696, height: 400 } });
await page.goto(pathToFileURL(join(dir, 'index.html')).href);
await page.screenshot({ path: join(here, 'out/contact-sheet.png'), fullPage: true });
await browser.close();
process.stdout.write(`contact sheet: ${files.length} stills, every 5 s of ${duration.toFixed(2)} s\n`);
