import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = new URL('../src/', import.meta.url);

describe('ruang: kemurnian', () => {
  it('sumber paket tidak memakai jam, timer, acak global, atau jaringan', () => {
    for (const berkas of readdirSync(src)) {
      const isi = readFileSync(new URL(berkas, src), 'utf8');
      expect(isi, berkas).not.toMatch(/\bDate\b|performance\.|Math\.random|setTimeout|setInterval|\bfetch\(|WebSocket|colyseus|redis/i);
      for (const [, dari] of isi.matchAll(/from '([^']+)'/g)) expect(dari, berkas).toMatch(/^(\.\/|@gaple\/aturan$)/);
    }
  });
});
