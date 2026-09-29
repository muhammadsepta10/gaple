import { afterEach, describe, expect, it, vi } from 'vitest';

describe('token pemain', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('tetap dibuat di halaman http non-localhost (tanpa crypto.randomUUID)', async () => {
    // Browser hanya menyediakan randomUUID di secure context; http://<IP LAN> bukan secure context.
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    const { tokenPemain } = await import('../src/online/sambungan');

    expect(tokenPemain()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
