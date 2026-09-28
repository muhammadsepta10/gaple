import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buatKodeUndangan, normalisasiKode } from '../src';

describe('ruang: kode undangan', () => {
  it('6 karakter huruf besar dan angka tanpa 0 O 1 I L', () => {
    fc.assert(fc.property(fc.array(fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }), { minLength: 6, maxLength: 6 }), (angka) => {
      let i = 0;
      const kode = buatKodeUndangan(() => angka[i++]!, () => false);
      expect(kode).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    }));
  });

  it('mengulang sampai kode tidak bentrok dengan yang dipakai', () => {
    let n = 0;
    const acak = () => (Math.floor(n++ / 6) * 0.1) % 1;
    const dipakai = new Set<string>();
    const pertama = buatKodeUndangan(acak, (k) => dipakai.has(k));
    dipakai.add(pertama);
    n = 0;
    const kedua = buatKodeUndangan(acak, (k) => dipakai.has(k));
    expect(kedua).not.toBe(pertama);
  });

  it('input manual dinormalisasi: tidak peka huruf besar-kecil, spasi dan tanda hubung diabaikan', () => {
    expect(normalisasiKode(' ab-c 7xz ')).toBe('ABC7XZ');
    expect(normalisasiKode('abc7x')).toBeNull();
    expect(normalisasiKode('ABC7X0')).toBeNull();
    expect(normalisasiKode('ABC7XZZ')).toBeNull();
  });
});
