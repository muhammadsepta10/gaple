import { expect, test } from '@playwright/test';

test('gambar bawaan dan shell bisa dibuka setelah kunjungan pertama tanpa jaringan', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Gaple' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Hijau klasik' })).toBeChecked();
  await page.getByRole('button', { name: 'Main offline' }).click();
  await expect(page.getByTestId('table-background')).toHaveCSS('background-image', /hijau\.svg/);
  expect(await page.evaluate(async () => (await fetch('/meja/hijau.svg')).ok)).toBe(true);
  await page.waitForFunction(() => document.querySelector('[data-testid="legal-move"]'));
});

test('satu ronde selesai, gambar meja bertahan, game tetap bisa dimainkan offline', async ({ page, context }) => {
  const requestedTables: string[] = [];
  context.on('request', (request) => {
    if (request.url().includes('/meja/')) requestedTables.push(request.url());
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Gaple' })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);

  const initialCache = await page.evaluate(async () => {
    const urls = (await Promise.all((await caches.keys()).map(async (name) =>
      (await (await caches.open(name)).keys()).map((request) => request.url)))).flat();
    return urls;
  });
  expect(initialCache.some((url) => url.endsWith('/meja/hijau.svg'))).toBe(true);
  expect(initialCache.some((url) => url.endsWith('/meja/kayu.svg'))).toBe(false);
  expect(initialCache.some((url) => url.endsWith('/meja/biru.svg'))).toBe(false);
  expect(initialCache.some((url) => url.endsWith('/sfx/card-place-1.m4a'))).toBe(true);
  expect(initialCache.some((url) => /\/assets\/.*\.js$/.test(url))).toBe(true);

  await page.getByRole('radio', { name: 'Kayu hangat' }).check();
  await page.waitForFunction(async () => !!await caches.match(new URL('/meja/kayu.svg', location.href).href));
  await expect(page.getByRole('radio', { name: 'Kayu hangat' })).toBeChecked();
  await page.getByLabel('Target poin').fill('1000');
  await page.getByRole('button', { name: 'Main offline' }).click();
  await expect(page.getByTestId('table-background')).toHaveCSS('background-image', /kayu\.svg/);

  for (let move = 0; move < 28; move++) {
    await page.waitForFunction(() => document.querySelector('[data-testid="session-summary"]') || document.querySelector('[data-testid="legal-move"]'));
    if (await page.getByTestId('session-summary').count()) break;
    await page.getByTestId('legal-move').first().dispatchEvent('click');
    await expect(page.getByTestId('legal-move')).toHaveCount(0);
  }
  await expect(page.getByTestId('session-summary')).toBeVisible();
  expect(requestedTables.some((url) => url.endsWith('/meja/biru.svg'))).toBe(false);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Gaple' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Kayu hangat' })).toBeChecked();
  expect(await page.evaluate(async () => (await fetch('/meja/kayu.svg')).ok)).toBe(true);
  await page.getByRole('button', { name: 'Main offline' }).click();
  await expect(page.getByTestId('table-background')).toHaveCSS('background-image', /kayu\.svg/);
  await page.waitForFunction(() => document.querySelector('[data-testid="legal-move"]'));
  await page.getByTestId('legal-move').first().dispatchEvent('click');
  await expect(page.getByTestId('legal-move')).toHaveCount(0);
});
