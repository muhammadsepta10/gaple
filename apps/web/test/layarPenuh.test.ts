import { describe, expect, it, vi } from 'vitest';
import { bisaKunciLandscape, kunciLandscape, lepasLandscape, type Lingkungan } from '../src/layarPenuh';

function lingkungan(opsi: { sentuh?: boolean; fullscreen?: boolean; lock?: boolean; lockGagal?: boolean } = {}) {
  const log: string[] = [];
  const dokumen = {
    fullscreenElement: null as Element | null,
    exitFullscreen: vi.fn(async () => { log.push('exitFullscreen'); dokumen.fullscreenElement = null; }),
    documentElement: {
      requestFullscreen: opsi.fullscreen === false ? undefined : vi.fn(async () => { log.push('requestFullscreen'); dokumen.fullscreenElement = {} as Element; }),
    },
  };
  const orientasi = opsi.lock === false ? {} : {
    lock: vi.fn(async (o: string) => { log.push(`lock:${o}`); if (opsi.lockGagal) throw new Error('NotSupportedError'); }),
    unlock: vi.fn(() => { log.push('unlock'); }),
  };
  const env: Lingkungan = { dokumen, orientasi, sentuh: opsi.sentuh ?? true };
  return { env, log };
}

describe('kunciLandscape', () => {
  it('di HP Android: masuk layar penuh lalu mengunci landscape', async () => {
    const { env, log } = lingkungan();
    expect(await kunciLandscape(env)).toBe(true);
    expect(log).toEqual(['requestFullscreen', 'lock:landscape']);
  });

  it('requestFullscreen dipanggil sinkron, masih di dalam ketukan pengguna', () => {
    const { env, log } = lingkungan();
    void kunciLandscape(env);
    expect(log).toEqual(['requestFullscreen']);
  });

  it('tidak melakukan apa pun di laptop (bukan layar sentuh)', async () => {
    const { env, log } = lingkungan({ sentuh: false });
    expect(bisaKunciLandscape(env)).toBe(false);
    expect(await kunciLandscape(env)).toBe(false);
    expect(log).toEqual([]);
  });

  it('tidak melakukan apa pun di iPhone (tanpa Fullscreen API atau kunci orientasi)', async () => {
    for (const opsi of [{ fullscreen: false }, { lock: false }]) {
      const { env, log } = lingkungan(opsi);
      expect(bisaKunciLandscape(env)).toBe(false);
      expect(await kunciLandscape(env)).toBe(false);
      expect(log).toEqual([]);
    }
  });

  it('kunci yang ditolak browser tidak melempar galat', async () => {
    const { env } = lingkungan({ lockGagal: true });
    expect(await kunciLandscape(env)).toBe(false);
  });
});

describe('lepasLandscape', () => {
  it('melepas kunci dan keluar dari layar penuh yang dimasuki oleh game', async () => {
    const { env, log } = lingkungan();
    await kunciLandscape(env);
    lepasLandscape(env);
    expect(log).toEqual(['requestFullscreen', 'lock:landscape', 'unlock', 'exitFullscreen']);
  });

  it('tidak keluar dari layar penuh yang dimasuki pemain sendiri', async () => {
    const { env, log } = lingkungan();
    env.dokumen.fullscreenElement = {} as Element;
    await kunciLandscape(env);
    lepasLandscape(env);
    expect(log).toEqual(['lock:landscape', 'unlock']);
  });
});
