import { legalMoves, type Seat } from '@gaple/aturan';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DURASI, VERSI_PROTOKOL, buatRuang, jalankanTenggat, terapkan, type Hasil, type PesanKeluar, type StateRuang } from '../src';

type Aksi = { readonly tunda: number; readonly pilihan: number; readonly acak: boolean };

const aksiArb = fc.record({
  // Negatif = mencoba bertindak sebelum jendela presentasi selesai.
  tunda: fc.integer({ min: -3000, max: 3000 }),
  pilihan: fc.nat(),
  acak: fc.boolean(),
});

const skenarioArb = fc.record({
  seedAwal: fc.integer({ min: 1, max: 1_000_000 }),
  jumlahManusia: fc.integer({ min: 1, max: 4 }),
  target: fc.integer({ min: 10, max: 120 }),
  aksi: fc.array(aksiArb, { minLength: 1, maxLength: 60 }),
});

const TOKEN = ['tok-a', 'tok-b', 'tok-c', 'tok-d'];

type Langkah = { readonly sebelum: StateRuang; readonly hasil: Hasil; readonly sekarang: number; readonly manusia: boolean };

/**
 * Menjalankan skenario: tenggat diproses satu per satu tepat pada waktunya, dan setiap aksi
 * membuat manusia yang sedang giliran mengirim langkah (legal atau acak) di sekitar akhir jendela.
 */
function jalankan(s: { seedAwal: number; jumlahManusia: number; target: number; aksi: readonly Aksi[] }, batas = 4000): Langkah[] {
  let n = s.seedAwal;
  const benih = () => n++;
  let state: StateRuang = buatRuang();
  for (const token of TOKEN.slice(0, s.jumlahManusia)) {
    state = terapkan(state, { jenis: 'masuk', token, nama: token, versi: VERSI_PROTOKOL }, 0, benih).state;
  }
  state = { ...state, config: { ...state.config, targetPoints: s.target } };
  const langkah: Langkah[] = [];
  let sekarang = 0;
  const catat = (hasil: Hasil, manusia: boolean) => {
    langkah.push({ sebelum: state, hasil, sekarang, manusia });
    state = hasil.state;
  };
  catat(terapkan(state, { jenis: 'mulai', token: 'tok-a' }, sekarang, benih), false);
  let i = 0;
  let ditolak = false;
  while (state.game && !state.game.result && langkah.length < batas) {
    if (state.tenggat) {
      sekarang = Math.max(sekarang, state.tenggat.pada);
      catat(jalankanTenggat(state, sekarang, benih), false);
      continue;
    }
    // Setelah penolakan, pemain mencoba lagi dengan langkah legal agar game tetap maju.
    const aksi = ditolak ? { tunda: 0, pilihan: i, acak: false } : s.aksi[i % s.aksi.length]!;
    i++;
    const seat = state.game.session.turn;
    const token = state.kursi[seat]!;
    sekarang = Math.max(sekarang, state.jendelaSelesai + aksi.tunda);
    const legal = legalMoves(state.game);
    const tangan = state.game.session.hands[seat]!;
    const pilih = aksi.acak
      ? { cardId: tangan[aksi.pilihan % tangan.length]!.id, end: aksi.pilihan % 2 ? 'left' as const : 'right' as const }
      : legal[aksi.pilihan % legal.length]!;
    const sebelum = state;
    catat(terapkan(state, { jenis: 'pasang', token, cardId: pilih.cardId, end: pilih.end }, sekarang, benih), true);
    ditolak = state === sebelum;
  }
  return langkah;
}

const idKartu = (x: unknown) => [...JSON.stringify(x).matchAll(/"id":"(\d-\d)"/g)].map((m) => m[1]!);

/**
 * Membuang yang memang sah terlihat: sisa tangan yang dibuka saat ronde berakhir, dan tangan
 * penerima sendiri pada pembagian yang dibatalkan (pembagian ulang).
 */
function yangRahasia(p: PesanKeluar) {
  const pesan = p.pesan;
  if (pesan.jenis !== 'transisi') return pesan;
  const terakhir = pesan.events.map((e) => e.type).lastIndexOf('dealt');
  return { ...pesan, events: pesan.events.filter((e, i) => e.type !== 'sessionEnded' && (e.type !== 'dealt' || i === terakhir)) };
}

describe('ruang: properti', () => {
  it('tidak ada pesan ke kursi mana pun yang memuat kartu tangan kursi lain', () => {
    fc.assert(
      fc.property(skenarioArb, (s) => {
        for (const { hasil } of jalankan(s, 600)) {
          const { state } = hasil;
          if (!state.game) continue;
          for (const keluar of hasil.pesan) {
            const kursi = state.orang[keluar.untuk]?.kursi ?? null;
            const terlihat = new Set(idKartu(yangRahasia(keluar)));
            for (const lain of [0, 1, 2, 3] as Seat[]) {
              if (lain === kursi) continue;
              for (const c of state.game.session.hands[lain]!) expect(terlihat.has(c.id)).toBe(false);
            }
          }
        }
      }),
      { numRuns: 60 },
    );
  });

  it('tidak ada langkah diterima atau dijadwalkan sebelum jendela presentasi selesai', () => {
    fc.assert(
      fc.property(skenarioArb, (s) => {
        for (const { sebelum, hasil, sekarang, manusia } of jalankan(s, 600)) {
          const diterima = hasil.state !== sebelum;
          if (manusia && diterima) expect(sekarang).toBeGreaterThanOrEqual(sebelum.jendelaSelesai);
          if (manusia && sekarang < sebelum.jendelaSelesai) {
            expect(hasil.pesan.map((p) => p.pesan)).toEqual([{ jenis: 'ditolak', alasan: 'masih-presentasi' }]);
          }
          const tenggat = hasil.state.tenggat;
          if (tenggat?.jenis === 'langkahBot') expect(tenggat.pada).toBe(hasil.state.jendelaSelesai + DURASI.botBerpikir);
          if (tenggat?.jenis === 'rondeBerikutnya') expect(tenggat.pada).toBe(hasil.state.jendelaSelesai);
          if (tenggat) expect(hasil.tenggatBerikutnya).toBe(tenggat.pada);
        }
      }),
      { numRuns: 60 },
    );
  });

  it('game dengan campuran manusia dan bot selalu selesai tanpa macet', () => {
    fc.assert(
      fc.property(skenarioArb, (s) => {
        const langkah = jalankan(s);
        const akhir = langkah.at(-1)!.hasil.state;
        expect(akhir.game!.result).not.toBeNull();
        expect(akhir.fase).toBe('hasil');
        expect(akhir.tenggat).toBeNull();
      }),
      { numRuns: 40 },
    );
  });
});
