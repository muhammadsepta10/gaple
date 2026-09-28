import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { arch, cpus, platform, totalmem } from 'node:os';

const origin = 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true });
const results = {
  machine: { platform: platform(), arch: arch(), cpu: cpus()[0]?.model, memoryGiB: +(totalmem() / 2 ** 30).toFixed(1) },
  browser: browser.version(),
  runs: [],
};
mkdirSync('.scratch/mode-offline/review', { recursive: true });

async function measureFrames(page, duration = 5000) {
  return page.evaluate(async (ms) => {
    const frames = [];
    const started = performance.now();
    let last;
    await new Promise((resolve) => {
      function frame(now) {
        if (last !== undefined) frames.push(now - last);
        last = now;
        if (now - started < ms) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
    frames.sort((a, b) => a - b);
    const elapsed = frames.reduce((sum, frame) => sum + frame, 0);
    return {
      samples: frames.length,
      elapsedMs: Math.round(elapsed),
      fps: +(frames.length * 1000 / elapsed).toFixed(1),
      p95FrameMs: +frames[Math.floor(frames.length * .95)].toFixed(1),
      framesOver20ms: frames.filter((frame) => frame > 20).length,
      framesOver50ms: frames.filter((frame) => frame > 50).length,
      maxFrameMs: +frames.at(-1).toFixed(1),
    };
  }, duration);
}

for (const [width, height, label] of [[844, 390, 'phone viewport'], [1440, 900, 'laptop viewport']]) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'allow' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(origin);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.getByLabel('Target poin').fill('1000');
  await page.getByRole('button', { name: 'Main offline' }).click();
  const initialTable = await measureFrames(page);
  const move = page.getByTestId('legal-move').first();
  await move.waitFor({ timeout: 30000 });
  await page.screenshot({ path: `.scratch/mode-offline/review/${width}-table.png` });
  await move.dispatchEvent('click');
  const afterMove = await measureFrames(page);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Keluar' }).click();
  await page.getByRole('heading', { name: 'Gaple' }).waitFor();
  await context.setOffline(true);
  const navStart = Date.now();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Main offline' }).waitFor();
  const cachedReadyMs = Date.now() - navStart;
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
  results.runs.push({ label, viewport: `${width}x${height}`, initialTable, afterMove, cachedReadyMs });
  await context.close();
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
