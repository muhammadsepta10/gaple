import { chooseMove, legalMoves, seatView, type Seat } from '@gaple/aturan';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  BATAS_WAKTU,
  VERSI_PROTOKOL,
  buatRuang,
  jalankanTenggat,
  proyeksiLobi,
  pulihkan,
  terapkan,
  type Hasil,
  type Perintah,
  type PesanKeluar,
  type StateRuang,
} from '../src';

const benihTetap = (awal = 1) => {
  let n = awal;
  return () => n++;
};

const masuk = (token: string, nama = ''): Perintah => ({ jenis: 'masuk', token, nama, versi: VERSI_PROTOKOL });
const terputus = (token: string): Perintah => ({ jenis: 'terputus', token });

/** Snapshot seperti yang tersimpan di Redis: JSON apa adanya. */
const lewatJson = (state: StateRuang): StateRuang => JSON.parse(JSON.stringify(state));

const JAM = 60 * 60_000;

function jalankan(state: StateRuang, sekarang: number, ...perintah: Perintah[]): Hasil {
  const benih = benihTetap();
  let hasil: Hasil = { state, pesan: [], tenggatBerikutnya: null, hapus: false };
  for (const p of perintah) hasil = terapkan(hasil.state, p, sekarang, benih);
  return hasil;
}

/** Budi (host, kursi 0) dan Agus (kursi 1) di lobi. */
const ruangBerdua = (sekarang = 0) => jalankan(buatRuang('KODE22'), sekarang, masuk('tok-a', 'Budi'), masuk('tok-b', 'Agus')).state;

/** Game Budi + Agus + dua bot, dimajukan sampai giliran Budi terbuka. */
function giliranBudi(): StateRuang {
  const benih = benihTetap(3);
  let state = terapkan(ruangBerdua(), { jenis: 'mulai', token: 'tok-a' }, 0, benih).state;
  for (let i = 0; i < 200; i++) {
    const game = state.game!;
    if (state.tenggat) {
      state = jalankanTenggat(state, state.tenggat.pada, benih).state;
      continue;
    }
    if (game.session.turn === 0) return state;
    const turn = game.session.turn;
    const { cardId, end } = chooseMove(seatView(game, turn));
    state = terapkan(state, { jenis: 'pasang', token: state.kursi[turn]!, cardId, end }, state.jendelaSelesai, benih).state;
  }
  throw new Error('giliran Budi tidak pernah tiba');
}

describe('ruang: pulihkan setelah restart', () => {
  it('semua orang ditandai Terputus dan tenggat ambil alih bot digeser sebesar waktu henti', () => {
    const state = giliranBudi();
    const disimpanPada = state.jendelaSelesai + 60_000;
    const sisaAmbilAlih = state.ambilAlih!.pada - disimpanPada;
    const sekarang = disimpanPada + 3 * JAM;

    const hasil = pulihkan(lewatJson(state), disimpanPada, sekarang);
    expect(Object.values(hasil.state.orang).every((o) => !o.tersambung)).toBe(true);
    expect(proyeksiLobi(hasil.state).kursi.slice(0, 2).map((k) => k.terputus)).toEqual([true, true]);
    expect(hasil.state.ambilAlih).toEqual({ kursi: 0, pada: sekarang + sisaAmbilAlih });
    expect(hasil.state.jendelaSelesai).toBe(state.jendelaSelesai + 3 * JAM);
    expect(hasil.state.game).toEqual(state.game);
    expect(hasil.tenggatBerikutnya).toBe(sekarang + sisaAmbilAlih);

    // Waktu henti tidak dihitung: tepat sebelum sisa tenggat habis, bot belum mengambil alih.
    expect(jalankanTenggat(hasil.state, sekarang + sisaAmbilAlih - 1, benihTetap()).state.diambilAlih).toEqual([]);
    expect(jalankanTenggat(hasil.state, sekarang + sisaAmbilAlih, benihTetap()).state.diambilAlih).toEqual([0]);
  });

  it('pemain yang menyambung ulang kembali ke kursi dan kartunya; game berlanjut', () => {
    const state = giliranBudi();
    const pulih = pulihkan(lewatJson(state), state.jendelaSelesai, state.jendelaSelesai + JAM).state;
    const kembali = terapkan(pulih, masuk('tok-a'), state.jendelaSelesai + JAM + 500, benihTetap());
    const [snapshot] = kembali.pesan.filter((p) => p.untuk === 'tok-a').map((p) => p.pesan);
    expect(snapshot).toMatchObject({ jenis: 'snapshot', kursi: 0, pandangan: { hand: state.game!.session.hands[0] } });

    const { cardId, end } = legalMoves(pulih.game!)[0]!;
    const langkah = terapkan(kembali.state, { jenis: 'pasang', token: 'tok-a', cardId, end }, state.jendelaSelesai + JAM + 600, benihTetap());
    expect(langkah.pesan.map((p) => p.pesan.jenis)).toContain('transisi');
  });

  it('tenggat pindah host di lobi digeser sebesar waktu henti', () => {
    const putus = jalankan(ruangBerdua(), 1000, terputus('tok-a')).state;
    expect(putus.pindahHostPada).toBe(1000 + BATAS_WAKTU.pindahHost);
    const disimpanPada = 31_000;
    const sekarang = disimpanPada + 2 * JAM;
    const pulih = pulihkan(lewatJson(putus), disimpanPada, sekarang);
    expect(pulih.state.pindahHostPada).toBe(1000 + BATAS_WAKTU.pindahHost + 2 * JAM);
    expect(pulih.state.host).toBe('tok-a');
  });

  it('tenggat hapus ruang digeser sebesar waktu henti, lalu batal saat ada yang tersambung lagi', () => {
    const kosong = jalankan(ruangBerdua(), 0, terputus('tok-b'), terputus('tok-a')).state;
    expect(kosong.hapusPada).toBe(BATAS_WAKTU.hapusRuang);
    const pulih = pulihkan(lewatJson(kosong), 5000, 5000 + 5 * JAM);
    expect(pulih.state.hapusPada).toBe(BATAS_WAKTU.hapusRuang + 5 * JAM);
    expect(jalankanTenggat(pulih.state, BATAS_WAKTU.hapusRuang + 5 * JAM - 1, benihTetap()).hapus).toBe(false);
    expect(jalankanTenggat(pulih.state, BATAS_WAKTU.hapusRuang + 5 * JAM, benihTetap()).hapus).toBe(true);
    expect(terapkan(pulih.state, masuk('tok-b'), 5000 + 5 * JAM + 10, benihTetap()).state.hapusPada).toBeNull();
  });

  it('ruang yang semua orangnya tersambung saat disimpan mulai menghitung 10 menit hapus sejak pulih', () => {
    const pulih = pulihkan(lewatJson(ruangBerdua()), 0, JAM);
    expect(pulih.state.hapusPada).toBe(JAM + BATAS_WAKTU.hapusRuang);
  });

  it('jam yang mundur tidak memajukan tenggat', () => {
    const state = giliranBudi();
    const pulih = pulihkan(lewatJson(state), state.jendelaSelesai + 10_000, state.jendelaSelesai);
    expect(pulih.state.ambilAlih).toEqual(state.ambilAlih);
    expect(pulih.state.jendelaSelesai).toBe(state.jendelaSelesai);
  });
});

const TOKEN = ['tok-a', 'tok-b', 'tok-c', 'tok-d'];

const skenarioArb = fc.record({
  seedAwal: fc.integer({ min: 1, max: 1_000_000 }),
  jumlahManusia: fc.integer({ min: 1, max: 4 }),
  target: fc.integer({ min: 10, max: 120 }),
  // Jeda manusia sebelum bertindak sejak gilirannya terbuka (ms).
  tunda: fc.array(fc.nat({ max: 3000 }), { minLength: 1, maxLength: 40 }),
  pilihan: fc.nat(),
});

type Skenario = typeof skenarioArb extends fc.Arbitrary<infer T> ? T : never;
type Restart = { readonly langkahKe: number; readonly henti: number };

/**
 * Memainkan satu game sampai selesai. Jika `restart` diisi, di langkah ke-`langkahKe` state
 * disimpan sebagai JSON, server "mati" selama `henti` ms, lalu snapshot dipulihkan dan semua
 * orang menyambung ulang. Waktu tindakan manusia selalu relatif terhadap state, seperti klien.
 */
function mainkan(s: Skenario, restart?: Restart) {
  let n = s.seedAwal;
  const benih = () => n++;
  let state = buatRuang('KODE22');
  for (const token of TOKEN.slice(0, s.jumlahManusia)) state = terapkan(state, masuk(token, token), 0, benih).state;
  state = terapkan(state, { jenis: 'aturKonfigurasi', token: 'tok-a', config: { targetPoints: s.target, doubleBalak: false } }, 0, benih).state;
  let sekarang = 0;
  const pesan: PesanKeluar[] = [];
  let dipulihkan = false;
  const catat = (hasil: Hasil) => {
    pesan.push(...hasil.pesan);
    state = hasil.state;
  };
  catat(terapkan(state, { jenis: 'mulai', token: 'tok-a' }, sekarang, benih));
  for (let langkah = 0; state.game && !state.game.result && langkah < 4000; langkah++) {
    if (restart && langkah === restart.langkahKe) {
      const disimpanPada = sekarang;
      sekarang += restart.henti;
      state = pulihkan(lewatJson(state), disimpanPada, sekarang).state;
      for (const token of Object.keys(state.orang)) state = terapkan(state, masuk(token), sekarang, benih).state;
      dipulihkan = true;
    }
    if (state.tenggat) {
      sekarang = Math.max(sekarang, state.tenggat.pada);
      catat(jalankanTenggat(state, sekarang, benih));
      continue;
    }
    const game = state.game!;
    const seat = game.session.turn as Seat;
    sekarang = Math.max(sekarang, state.jendelaSelesai + s.tunda[langkah % s.tunda.length]!);
    // Seperti timer adaptor: tenggat lain (misalnya ambil alih bot) yang sudah lewat diproses dulu.
    const lewat = jalankanTenggat(state, sekarang, benih);
    if (lewat.state !== state) {
      catat(lewat);
      continue;
    }
    const legal = legalMoves(game);
    const { cardId, end } = legal[(s.pilihan + langkah) % legal.length]!;
    catat(terapkan(state, { jenis: 'pasang', token: state.kursi[seat]!, cardId, end }, sekarang, benih));
  }
  return { akhir: state, pesan, dipulihkan };
}

describe('ruang: properti pulihkan', () => {
  it('snapshot lalu pulihkan di titik acak menghasilkan permainan yang sama dengan tanpa restart, selain geseran waktu', () => {
    fc.assert(
      fc.property(skenarioArb, fc.nat({ max: 300 }), fc.integer({ min: 0, max: 6 * JAM }), (s, langkahKe, henti) => {
        const tanpa = mainkan(s);
        const dengan = mainkan(s, { langkahKe, henti });
        expect(tanpa.akhir.game!.result).not.toBeNull();
        expect(dengan.pesan).toEqual(tanpa.pesan);
        const geser = dengan.dipulihkan ? henti : 0;
        expect(dengan.akhir).toEqual({ ...tanpa.akhir, jendelaSelesai: tanpa.akhir.jendelaSelesai + geser });
      }),
      { numRuns: 60 },
    );
  });
});
