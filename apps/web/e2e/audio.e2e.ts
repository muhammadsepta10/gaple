import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

async function watchAudio(page: Page) {
  await page.addInitScript(() => {
    const starts: number[] = [];
    Object.defineProperty(window, '__audioBufferStarts', { value: starts });
    Object.defineProperty(window, '__decodedAudio', { value: { count: 0 } });
    const originalStart = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      starts.push(this.buffer?.duration ?? 0);
      return originalStart.apply(this, args);
    };
    const originalDecode = AudioContext.prototype.decodeAudioData;
    AudioContext.prototype.decodeAudioData = function (...args) {
      return originalDecode.apply(this, args).then((buffer) => {
        (window as typeof window & { __decodedAudio: { count: number } }).__decodedAudio.count++;
        return buffer;
      });
    };
    const originalCreateSource = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function (...args) {
      Object.defineProperty(window, '__audioContext', { value: this, configurable: true });
      return originalCreateSource.apply(this, args);
    };
  });
}

async function playFirstCard(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Main offline' }).click();
  await page.getByTestId('legal-move').first().waitFor();
  await page.evaluate(() => { (window as typeof window & { __audioBufferStarts: number[] }).__audioBufferStarts.length = 0; });
  await page.getByTestId('legal-move').first().dispatchEvent('click');
}

async function expectCardSound(page: Page) {
  await expect.poll(async () => page.evaluate(() =>
    (window as typeof window & { __audioBufferStarts: number[] }).__audioBufferStarts
      .some((duration) => duration > 0.1)
  ), { timeout: 1_500 }).toBe(true);
}

test('kartu pertama bersuara setelah berkas efek siap', async ({ page }) => {
  await watchAudio(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Main offline' }).click();
  await page.getByTestId('legal-move').first().waitFor();
  await page.waitForFunction(() =>
    (window as typeof window & { __decodedAudio: { count: number } }).__decodedAudio.count >= 11);
  await page.evaluate(() => { (window as typeof window & { __audioBufferStarts: number[] }).__audioBufferStarts.length = 0; });
  await page.getByTestId('legal-move').first().dispatchEvent('click');
  await expectCardSound(page);
});

test('kartu pertama tetap bersuara ketika berkas efek belum selesai dimuat', async ({ page }) => {
  // Tahan respons audio seperti jaringan HP yang lambat, sementara shell game tetap siap.
  let heldRequests = 0;
  await page.route('**/sfx/*.m4a', async (route) => {
    heldRequests++;
    await new Promise((resolve) => setTimeout(resolve, 15_000));
    await route.continue();
  });
  await watchAudio(page);

  await playFirstCard(page);
  expect(heldRequests).toBeGreaterThan(0);
  await expectCardSound(page);
});

test('suara pulih ketika browser menangguhkan audio di tengah game', async ({ page }) => {
  await watchAudio(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Main offline' }).click();
  await page.getByTestId('legal-move').first().waitFor();
  await page.waitForFunction(() =>
    (window as typeof window & { __decodedAudio: { count: number } }).__decodedAudio.count >= 11);
  await page.evaluate(async () => {
    const context = (window as typeof window & { __audioContext: AudioContext }).__audioContext;
    await context.suspend();
    (window as typeof window & { __audioBufferStarts: number[] }).__audioBufferStarts.length = 0;
  });
  await page.mouse.click(400, 10);
  await page.getByTestId('legal-move').first().dispatchEvent('click');
  await expectCardSound(page);
});

test('berkas efek yang sempat gagal dimuat dicoba lagi saat interaksi berikutnya', async ({ page }) => {
  let attempts = 0;
  await page.route('**/sfx/card-place-1.m4a', async (route) => {
    attempts++;
    if (attempts === 1) await route.fulfill({ status: 503, body: 'temporary error' });
    else await route.continue();
  });
  await watchAudio(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Main offline' }).click();
  await page.getByTestId('legal-move').first().waitFor();
  await page.waitForFunction(() =>
    (window as typeof window & { __decodedAudio: { count: number } }).__decodedAudio.count >= 10);
  expect(attempts).toBe(1);
  await page.mouse.click(400, 10);
  await expect.poll(() => attempts, { timeout: 1_500 }).toBe(2);
});
