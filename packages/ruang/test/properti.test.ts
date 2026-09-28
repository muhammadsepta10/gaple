import { legalMoves, type Seat } from '@gaple/aturan';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BATAS_WAKTU, DURASI, VERSI_PROTOKOL, buatRuang, jalankanTenggat, terapkan, type Hasil, type Perintah, type PesanKeluar, type StateRuang } from '../src';

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
const PENONTON = 'tok-penonton';

type Langkah = { readonly sebelum: StateRuang; readonly hasil: Hasil; readonly sekarang: number; readonly manusia: boolean };

/**
 * Menjalankan skenario: tenggat diproses satu per satu tepat pada waktunya, dan setiap aksi
 * membuat manusia yang sedang giliran mengirim langkah (legal atau acak) di sekitar akhir jendela.
 */
function jalankan(s: { seedAwal: number; jumlahManusia: number; target: number; aksi: readonly Aksi[] }, batas = 4000): Langkah[] {
  let n = s.seedAwal;
  const benih = () => n++;
  let state: StateRuang = buatRuang('KODE22');
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
  // Penonton datang di tengah game dan menerima snapshot serta semua event berikutnya.
  catat(terapkan(state, { jenis: 'masuk', token: PENONTON, nama: 'Penonton', versi: VERSI_PROTOKOL }, sekarang, benih), false);
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
  it('tidak ada pesan ke kursi mana pun yang memuat kartu tangan kursi lain, dan tidak ada pesan ke penonton yang memuat tangan siapa pun', () => {
    fc.assert(
      fc.property(skenarioArb, (s) => {
        let kePenonton = 0;
        for (const { hasil } of jalankan(s, 600)) {
          const { state } = hasil;
          if (!state.game) continue;
          for (const keluar of hasil.pesan) {
            if (keluar.untuk === PENONTON) kePenonton++;
            const kursi = state.orang[keluar.untuk]?.kursi ?? null;
            const terlihat = new Set(idKartu(yangRahasia(keluar)));
            for (const lain of [0, 1, 2, 3] as Seat[]) {
              if (lain === kursi) continue;
              for (const c of state.game.session.hands[lain]!) expect(terlihat.has(c.id)).toBe(false);
            }
          }
        }
        expect(kePenonton).toBeGreaterThan(1);
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

const TOKEN_LOBI = ['tok-a', 'tok-b', 'tok-c', 'tok-d', 'tok-e', 'tok-f'];

const kejadianArb = fc.record({
  jenis: fc.constantFrom('masuk', 'terputus', 'keluar', 'pilihKursi', 'pindahkan', 'kosongkan', 'ambilKendali', 'main', 'tunggu'),
  orang: fc.nat({ max: TOKEN_LOBI.length - 1 }),
  kursi: fc.constantFrom<Seat>(0, 1, 2, 3),
  jeda: fc.integer({ min: 0, max: 400_000 }),
});

type Kejadian = { jenis: string; orang: number; kursi: Seat; jeda: number };

/** Perintah acak dari satu orang (atau host, untuk perintah host) pada waktu `sekarang`. */
function perintahAcak(state: StateRuang, k: Kejadian): Perintah | null {
  const token = TOKEN_LOBI[k.orang]!;
  const host = state.host ?? token;
  switch (k.jenis) {
    case 'masuk': return { jenis: 'masuk', token, nama: `N${k.orang}`, versi: VERSI_PROTOKOL };
    case 'terputus': return { jenis: 'terputus', token };
    case 'keluar': return { jenis: 'keluar', token };
    case 'pilihKursi': return { jenis: 'pilihKursi', token, kursi: k.kursi };
    case 'pindahkan': return { jenis: 'pindahkan', token: host, dari: k.kursi, ke: ((k.kursi + k.orang + 1) % 4) as Seat };
    case 'kosongkan': return { jenis: 'kosongkan', token: host, kursi: k.kursi };
    case 'ambilKendali': return { jenis: 'ambilKendali', token };
    case 'main': {
      const game = state.game;
      if (state.fase !== 'bermain' || !game || game.session.result) return null;
      const seat = game.session.turn;
      const pemilik = state.kursi[seat];
      if (!pemilik) return null;
      const m = legalMoves(game)[k.orang % legalMoves(game).length]!;
      return { jenis: 'pasang', token: pemilik, cardId: m.cardId, end: m.end };
    }
    default: return null;
  }
}

describe('ruang: properti terputus dan host', () => {
  it('token yang sama selalu kembali ke kursi, kartu, dan total poin yang sama', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 4 }), fc.integer({ min: 1, max: 1e6 }), fc.array(kejadianArb, { minLength: 1, maxLength: 120 }), (jumlah, seed, kejadian) => {
        let n = seed;
        const benih = () => n++;
        let state = buatRuang('KODE22');
        for (const token of TOKEN.slice(0, jumlah)) state = terapkan(state, { jenis: 'masuk', token, nama: token, versi: VERSI_PROTOKOL }, 0, benih).state;
        state = terapkan(state, { jenis: 'mulai', token: 'tok-a' }, 0, benih).state;
        const kursiAwal = Object.fromEntries(Object.entries(state.orang).map(([t, o]) => [t, o.kursi]));
        let sekarang = 0;
        for (const k of kejadian) {
          if (state.fase !== 'bermain') break;
          sekarang += k.jeda % 20_000;
          state = jalankanTenggat(state, sekarang, benih).state;
          // Hanya pemain yang sudah duduk; token baru saat game berjalan tidak relevan di sini.
          const token = TOKEN[k.orang % jumlah]!;
          const perintah = k.jenis === 'masuk' ? { jenis: 'masuk' as const, token, nama: '', versi: VERSI_PROTOKOL } : perintahAcak(state, { ...k, orang: k.orang % jumlah });
          if (!perintah) continue;
          const sebelum = state;
          const hasil = terapkan(state, perintah, Math.max(sekarang, perintah.jenis === 'pasang' ? state.jendelaSelesai : 0), benih);
          state = hasil.state;
          if (perintah.jenis === 'masuk' && state.fase === 'bermain') {
            const seat = kursiAwal[token]!;
            const [snapshot] = hasil.pesan.filter((p) => p.untuk === token).map((p) => p.pesan);
            expect(snapshot).toMatchObject({ jenis: 'snapshot', kursi: seat });
            if (snapshot?.jenis !== 'snapshot') throw new Error();
            expect(snapshot.pandangan).toMatchObject({ hand: sebelum.game!.session.hands[seat!] });
            expect(snapshot.pandangan!.totals).toEqual(sebelum.game!.totals);
          }
          for (const [t, o] of Object.entries(state.orang)) expect(o.kursi).toBe(kursiAwal[t]);
        }
      }),
      { numRuns: 80 },
    );
  });

  it('di luar game, selama ada pemain tersambung, ruang tidak pernah lebih dari 2 menit tanpa host tersambung', () => {
    fc.assert(
      fc.property(fc.array(kejadianArb, { minLength: 1, maxLength: 150 }), (kejadian) => {
        const benih = () => 1;
        let state = terapkan(buatRuang('KODE22'), { jenis: 'masuk', token: 'tok-a', nama: 'A', versi: VERSI_PROTOKOL }, 0, benih).state;
        let sekarang = 0;
        let tanpaHostSejak: number | null = null;
        const periksa = () => {
          const adaPemain = Object.values(state.orang).some((o) => o.tersambung && o.kursi !== null);
          const hostTersambung = state.host !== null && state.orang[state.host]!.tersambung && state.orang[state.host]!.kursi !== null;
          if (!adaPemain || hostTersambung) tanpaHostSejak = null;
          else {
            tanpaHostSejak ??= sekarang;
            expect(sekarang - tanpaHostSejak).toBeLessThanOrEqual(BATAS_WAKTU.pindahHost);
          }
        };
        for (const k of kejadian) {
          sekarang += k.jeda;
          const hasil = jalankanTenggat(state, sekarang, benih);
          if (hasil.hapus) return;
          state = hasil.state;
          periksa();
          const perintah = perintahAcak(state, k);
          if (!perintah || perintah.jenis === 'pasang') continue;
          state = terapkan(state, perintah, sekarang, benih).state;
          periksa();
        }
      }),
      { numRuns: 300 },
    );
  });
});
