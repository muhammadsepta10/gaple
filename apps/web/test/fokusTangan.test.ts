import { describe, expect, it } from 'vitest';
import { FOKUS_AWAL, fokusTangan, type AksiFokus, type Fokus } from '../src/meja/fokusTangan';

const jalankan = (aksi: AksiFokus[], awal: Fokus = FOKUS_AWAL) => {
  let fokus = awal;
  const klik: string[] = [];
  for (const a of aksi) {
    const hasil = fokusTangan(fokus, a);
    fokus = hasil.fokus;
    if (hasil.klik) klik.push(hasil.klik);
  }
  return { fokus, klik };
};

describe('fokusTangan: mouse', () => {
  it('kartu terangkat saat mouse di atasnya dan turun saat mouse keluar', () => {
    expect(jalankan([{ tipe: 'masuk', kartu: 'a', alat: 'mouse' }]).fokus.kartu).toBe('a');
    expect(jalankan([{ tipe: 'masuk', kartu: 'a', alat: 'mouse' }, { tipe: 'keluar', kartu: 'a', alat: 'mouse' }]).fokus.kartu).toBeNull();
  });

  it('klik terjadi saat tombol dilepas di atas kartu yang ditekan, dan kartu tetap terangkat karena mouse masih di atasnya', () => {
    const { fokus, klik } = jalankan([
      { tipe: 'masuk', kartu: 'a', alat: 'mouse' },
      { tipe: 'tekan', kartu: 'a', alat: 'mouse' },
      { tipe: 'lepas', kartu: 'a', alat: 'mouse' },
    ]);
    expect(klik).toEqual(['a']);
    expect(fokus.kartu).toBe('a');
  });
});

describe('fokusTangan: sentuh', () => {
  it('menyentuh tanpa melepas hanya mengangkat kartu, belum mengklik', () => {
    const { fokus, klik } = jalankan([{ tipe: 'tekan', kartu: 'a', alat: 'touch' }]);
    expect(fokus.kartu).toBe('a');
    expect(klik).toEqual([]);
  });

  it('melepas di atas kartu yang sama mengklik kartu itu lalu menurunkannya', () => {
    const { fokus, klik } = jalankan([{ tipe: 'tekan', kartu: 'a', alat: 'touch' }, { tipe: 'lepas', kartu: 'a', alat: 'touch' }]);
    expect(klik).toEqual(['a']);
    expect(fokus.kartu).toBeNull();
  });

  it('menggeser jari ke kartu lain memindahkan angkatan; melepas di sana mengklik kartu tersebut', () => {
    const { fokus, klik } = jalankan([
      { tipe: 'tekan', kartu: 'a', alat: 'touch' },
      { tipe: 'keluar', kartu: 'a', alat: 'touch' },
      { tipe: 'masuk', kartu: 'b', alat: 'touch' },
      { tipe: 'lepas', kartu: 'b', alat: 'touch' },
      { tipe: 'lepasDiLuar', alat: 'touch' },
    ]);
    expect(klik).toEqual(['b']);
    expect(fokus.kartu).toBeNull();
  });

  it('menggeser jari keluar dari tangan lalu melepas membatalkan klik', () => {
    const { fokus, klik } = jalankan([
      { tipe: 'tekan', kartu: 'a', alat: 'touch' },
      { tipe: 'keluar', kartu: 'a', alat: 'touch' },
      { tipe: 'lepasDiLuar', alat: 'touch' },
    ]);
    expect(klik).toEqual([]);
    expect(fokus).toEqual(FOKUS_AWAL);
  });

  it('jari yang lewat tanpa menekan kartu (mis. mulai dari meja) tidak mengangkat atau mengklik', () => {
    const { fokus, klik } = jalankan([{ tipe: 'masuk', kartu: 'a', alat: 'touch' }, { tipe: 'lepas', kartu: 'a', alat: 'touch' }]);
    expect(klik).toEqual([]);
    expect(fokus.kartu).toBeNull();
  });
});
