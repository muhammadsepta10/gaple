import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buatServer } from '../src/server';

const PORT = 2602;
const alamat = `http://127.0.0.1:${PORT}`;

let server: ReturnType<typeof buatServer>;

beforeAll(async () => {
  // Hasil build web tiruan: halaman, service worker, dan satu aset ber-hash.
  const web = mkdtempSync(path.join(tmpdir(), 'gaple-web-'));
  mkdirSync(path.join(web, 'assets'));
  writeFileSync(path.join(web, 'index.html'), '<!doctype html><title>Gaple</title>');
  writeFileSync(path.join(web, 'sw.js'), '// sw');
  writeFileSync(path.join(web, 'assets', 'index-abc123.js'), 'console.log(1)');
  server = buatServer({ web });
  await server.listen(PORT);
});
afterAll(async () => { await server.gracefullyShutdown(false); });

describe('server: aplikasi web statis di origin yang sama', () => {
  it('menyajikan halaman di akar dan di tautan ruang /r/<kode>', async () => {
    for (const jalur of ['/', '/r/ABCDEF']) {
      const res = await fetch(`${alamat}${jalur}`);
      expect(res.status, jalur).toBe(200);
      expect(await res.text()).toContain('<title>Gaple</title>');
      // Halaman dan service worker selalu diperiksa ulang, supaya versi baru langsung terlihat.
      expect(res.headers.get('cache-control')).toBe('no-cache');
    }
  });

  it('service worker tidak di-cache; aset ber-hash di-cache lama', async () => {
    const sw = await fetch(`${alamat}/sw.js`);
    expect(sw.status).toBe(200);
    expect(sw.headers.get('cache-control')).toBe('no-cache');
    const aset = await fetch(`${alamat}/assets/index-abc123.js`);
    expect(aset.status).toBe(200);
    expect(aset.headers.get('cache-control')).toMatch(/max-age=31536000.*immutable/);
  });

  it('endpoint server tetap berjalan, dan berkas yang tidak ada tidak jatuh ke halaman', async () => {
    expect(await (await fetch(`${alamat}/kesehatan`)).json()).toEqual({ ruangAktif: 0 });
    expect((await fetch(`${alamat}/assets/tidak-ada.js`)).status).toBe(404);
  });
});
