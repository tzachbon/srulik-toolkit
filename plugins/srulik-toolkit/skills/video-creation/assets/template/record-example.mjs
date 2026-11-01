// Records one flow of the app into capture/example/ (numbered JPEGs and meta.js).
// Read-only: every request that is not a read is aborted, and event or analytics posts are
// answered locally with 204, so the take changes no real data and adds no usage.
// Replace BASE, the selectors and the flow with your own. Sign in beforehand and pass the
// saved Playwright storage state in STORAGE_STATE; read secrets from the environment, never print them.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { session } from './capture-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const BASE = 'https://app.example.com';
const EVENTS = /\/(events|analytics|telemetry)\b/;
const PRIVATE = '[data-person-name], .user-email';

const s = await session(join(here, 'capture/example'), process.env.STORAGE_STATE ? { storageState: process.env.STORAGE_STATE } : {});
const { page, context } = s;

const blocked = [];
await context.route('**/*', (route) => {
  const req = route.request();
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method())) return route.fallback();
  if (EVENTS.test(new URL(req.url()).pathname)) return route.fulfill({ status: 204, body: '' });
  blocked.push(`${req.method()} ${new URL(req.url()).pathname}`);
  return route.abort();
});

// Blur real people's names and customer data before they reach a frame.
await context.addInitScript((selector) => {
  const blur = () => { for (const el of document.querySelectorAll(selector)) el.style.filter = 'blur(6px)'; };
  new MutationObserver(blur).observe(document, { childList: true, subtree: true });
}, PRIVATE);

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.getByRole('main').waitFor({ timeout: 30_000 });
await page.waitForTimeout(800);

s.start();
s.mark('list');
await page.waitForTimeout(1500);
s.mark('toItem');
await s.clickOn(page.getByRole('link').first(), 900);
await page.waitForLoadState('domcontentloaded');
s.mark('detail');
await page.waitForTimeout(2500);
s.mark('end');

const meta = await s.finish('META_EXAMPLE', { blocked });
console.log(JSON.stringify({ frames: meta.frames, marks: meta.marks, blocked }));
