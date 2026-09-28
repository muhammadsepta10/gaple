import { chooseMove, seatView, type Seat } from '@gaple/aturan';
import { describe, expect, it } from 'vitest';
import {
  BATAS_WAKTU,
  DURASI,
  VERSI_PROTOKOL,
  buatRuang,
  jalankanTenggat,
  proyeksiLobi,
  terapkan,
  type Hasil,
  type Perintah,
  type Pesan,
  type StateRuang,
} from '../src';

const benihTetap = (awal = 1) => {
  let n = awal;
  return () => n++;
};

const masuk = (token: string, nama = ''): Perintah => ({ jenis: 'masuk', token, nama, versi: VERSI_PROTOKOL });
const terputus = (token: string): Perintah => ({ jenis: 'terputus', token });
const keluar = (token: string): Perintah => ({ jenis: 'keluar', token });

const pesanUntuk = (hasil: Hasil, token: string): Pesan[] => hasil.pesan.filter((p) => p.untuk === token).map((p) => p.pesan);

/** Menerapkan perintah berurutan pada waktu `sekarang`; hasil terakhir dikembalikan. */
function jalankan(state: StateRuang, sekarang: number, ...perintah: Perintah[]): Hasil {
  const benih = benihTetap();
  let hasil: Hasil = { state, pesan: [], tenggatBerikutnya: null, hapus: false };
  for (const p of perintah) hasil = terapkan(hasil.state, p, sekarang, benih);
  return hasil;
}

/** Budi (host, kursi 0), Agus (kursi 1), dan Joko (kursi 2) di lobi. */
const ruangBertiga = () => jalankan(buatRuang('KODE22'), 0, masuk('tok-a', 'Budi'), masuk('tok-b', 'Agus'), masuk('tok-c', 'Joko')).state;

const lobi = (state: StateRuang) => proyeksiLobi(state);
const hostNama = (state: StateRuang) => {
  const l = lobi(state);
  return l.hostKursi === null ? null : l.kursi[l.hostKursi]!.nama;
};

/**
 * Memulai game lalu memajukan waktu sampai giliran `seat` terbuka: tenggat presentasi dijalankan,
 * manusia lain bermain `chooseMove` tepat di akhir jendela. Mencoba beberapa seed.
 */
function sampaiGiliran(awal: StateRuang, seat: Seat): { hasil: Hasil; benih: () => number } {
  for (let s = 1; s < 80; s++) {
    const benih = benihTetap(s);
    let hasil = terapkan(awal, { jenis: 'mulai', token: awal.host! }, 0, benih);
    for (let i = 0; i < 200; i++) {
      const st = hasil.state;
      const game = st.game!;
      if (game.result) break;
      if (st.tenggat) {
        hasil = jalankanTenggat(st, st.tenggat.pada, benih);
        continue;
      }
      if (game.session.turn === seat) return { hasil, benih };
      const turn = game.session.turn;
      const { cardId, end } = chooseMove(seatView(game, turn));
      hasil = terapkan(st, { jenis: 'pasang', token: st.kursi[turn]!, cardId, end }, st.jendelaSelesai, benih);
    }
  }
  throw new Error(`tidak menemukan giliran kursi ${seat}`);
}

describe('ruang: terputus di lobi', () => {
  it('pemain terputus tetap memegang kursi dan nama panggilannya, dengan penanda terputus', () => {
    const { state } = jalankan(ruangBertiga(), 0, terputus('tok-b'));
    expect(lobi(state).kursi[1]).toMatchObject({ nama: 'Agus', jenis: 'manusia', terputus: true });
    expect(lobi(state).kursi[0]).toMatchObject({ terputus: false });
    const bentrok = terapkan(state, masuk('tok-x', 'agus'), 0, benihTetap());
    expect(pesanUntuk(bentrok, 'tok-x')).toEqual([{ jenis: 'ditolak', alasan: 'nama-dipakai' }]);
  });

  it('token yang dikenal kembali ke kursinya tanpa nama dan penanda terputus hilang', () => {
    const putus = jalankan(ruangBertiga(), 0, terputus('tok-b')).state;
    const kembali = terapkan(putus, masuk('tok-b'), 10, benihTetap());
    expect(pesanUntuk(kembali, 'tok-b')).toEqual([{ jenis: 'snapshot', kursi: 1, pandangan: null, sisaPresentasi: 0 }]);
    expect(lobi(kembali.state).kursi[1]).toMatchObject({ nama: 'Agus', terputus: false });
  });

  it('host bisa mengosongkan kursi pemain terputus', () => {
    const { state } = jalankan(ruangBertiga(), 0, terputus('tok-b'), { jenis: 'kosongkan', token: 'tok-a', kursi: 1 });
    expect(lobi(state).kursi[1]!.jenis).toBe('kosong');
  });

  it('keluar ruang mengosongkan kursi dan melepas nama; token itu harus mengisi nama lagi', () => {
    const { state } = jalankan(ruangBertiga(), 0, keluar('tok-b'));
    expect(lobi(state).kursi[1]!.jenis).toBe('kosong');
    const tanpaNama = terapkan(state, masuk('tok-b'), 0, benihTetap());
    expect(pesanUntuk(tanpaNama, 'tok-b')).toEqual([{ jenis: 'ditolak', alasan: 'nama-tidak-sah' }]);
    const orangLain = terapkan(state, masuk('tok-x', 'Agus'), 0, benihTetap());
    expect(pesanUntuk(orangLain, 'tok-x')).toEqual([{ jenis: 'snapshot', kursi: 1, pandangan: null, sisaPresentasi: 0 }]);
  });

  it('host yang keluar ruang langsung digantikan pemain tersambung berikutnya searah jarum jam', () => {
    const { state } = jalankan(ruangBertiga(), 0, terputus('tok-b'), keluar('tok-a'));
    expect(hostNama(state)).toBe('Joko');
  });

  it('pemain terputus tetap ikut di kursinya saat host memulai game', () => {
    const { state } = jalankan(ruangBertiga(), 0, terputus('tok-c'), { jenis: 'mulai', token: 'tok-a' });
    expect(state.botSejakAwal).toEqual([3]);
    expect(lobi(state).kursi.map((k) => k.jenis)).toEqual(['manusia', 'manusia', 'manusia', 'bot']);
    expect(lobi(state).kursi[2]).toMatchObject({ nama: 'Joko', terputus: true });
  });
});

describe('ruang: pindah host di luar game', () => {
  it('host yang terputus 2 menit digantikan pemain tersambung berikutnya searah jarum jam', () => {
    const putus = jalankan(ruangBertiga(), 1000, terputus('tok-a'));
    expect(putus.tenggatBerikutnya).toBe(1000 + BATAS_WAKTU.pindahHost);
    const belum = jalankanTenggat(putus.state, 1000 + BATAS_WAKTU.pindahHost - 1, benihTetap());
    expect(hostNama(belum.state)).toBe('Budi');
    const pindah = jalankanTenggat(putus.state, 1000 + BATAS_WAKTU.pindahHost, benihTetap());
    expect(hostNama(pindah.state)).toBe('Agus');
    // Host lama kembali sebagai pemain biasa.
    const kembali = terapkan(pindah.state, masuk('tok-a'), 1000 + BATAS_WAKTU.pindahHost + 5, benihTetap());
    expect(hostNama(kembali.state)).toBe('Agus');
  });

  it('host yang kembali sebelum 2 menit tetap host dan tenggatnya batal', () => {
    const putus = jalankan(ruangBertiga(), 0, terputus('tok-a')).state;
    const kembali = terapkan(putus, masuk('tok-a'), 60_000, benihTetap());
    expect(kembali.tenggatBerikutnya).toBeNull();
    expect(hostNama(jalankanTenggat(kembali.state, 10 * 60_000, benihTetap()).state)).toBe('Budi');
  });

  it('melewati pemain terputus; tanpa pemain tersambung ruang tanpa host sampai ada yang tersambung lagi', () => {
    const lewati = jalankan(ruangBertiga(), 0, terputus('tok-b'), terputus('tok-a'));
    expect(hostNama(jalankanTenggat(lewati.state, BATAS_WAKTU.pindahHost, benihTetap()).state)).toBe('Joko');

    const semua = jalankan(ruangBertiga(), 0, terputus('tok-b'), terputus('tok-c'), terputus('tok-a'));
    const kosong = jalankanTenggat(semua.state, BATAS_WAKTU.pindahHost, benihTetap()).state;
    expect(lobi(kosong).hostKursi).toBeNull();
    const pertama = terapkan(kosong, masuk('tok-c'), BATAS_WAKTU.pindahHost + 10, benihTetap());
    expect(hostNama(pertama.state)).toBe('Joko');
    const kedua = terapkan(pertama.state, masuk('tok-a'), BATAS_WAKTU.pindahHost + 20, benihTetap());
    expect(hostNama(kedua.state)).toBe('Joko');
  });

  it('host yang terputus saat game berjalan tetap host; hitungan 2 menit baru mulai di luar game', () => {
    const berdua = jalankan(buatRuang('KODE22'), 0, masuk('tok-a', 'Budi'), masuk('tok-b', 'Agus'), { jenis: 'aturKonfigurasi', token: 'tok-a', config: { targetPoints: 5, doubleBalak: false } }).state;
    const { hasil, benih } = sampaiGiliran(berdua, 1);
    let h = terapkan(hasil.state, terputus('tok-a'), hasil.state.jendelaSelesai, benih);
    let t = hasil.state.jendelaSelesai;
    // Budi hanya menyambung untuk memasang kartu di gilirannya, lalu terputus lagi.
    for (let i = 0; i < 400 && h.state.fase === 'bermain'; i++) {
      const st = h.state;
      expect(hostNama(st)).toBe('Budi');
      expect(st.pindahHostPada).toBeNull();
      if (st.tenggat) {
        t = st.tenggat.pada;
        h = jalankanTenggat(st, t, benih);
        continue;
      }
      const seat = st.game!.session.turn;
      const token = st.kursi[seat]!;
      const { cardId, end } = chooseMove(seatView(st.game!, seat));
      t = st.jendelaSelesai;
      h = jalankan(st, t, masuk(token), { jenis: 'pasang', token, cardId, end }, ...(token === 'tok-a' ? [terputus('tok-a')] : []));
    }
    expect(h.state.fase).toBe('hasil');
    expect(hostNama(h.state)).toBe('Budi');
    expect(h.state.pindahHostPada).toBe(t + BATAS_WAKTU.pindahHost);
    expect(hostNama(jalankanTenggat(h.state, t + BATAS_WAKTU.pindahHost, benih).state)).toBe('Agus');
  });
});

describe('ruang: ambil alih bot', () => {
  it('giliran manusia yang diam 5 menit sejak jendela selesai diambil alih bot', () => {
    const { hasil, benih } = sampaiGiliran(ruangBertiga(), 1);
    const mulaiGiliran = hasil.state.jendelaSelesai;
    expect(hasil.tenggatBerikutnya).toBe(mulaiGiliran + BATAS_WAKTU.ambilAlih);
    const belum = jalankanTenggat(hasil.state, mulaiGiliran + BATAS_WAKTU.ambilAlih - 1, benih);
    expect(belum.state).toBe(hasil.state);

    const alih = jalankanTenggat(hasil.state, mulaiGiliran + BATAS_WAKTU.ambilAlih, benih);
    expect(lobi(alih.state).kursi[1]).toMatchObject({ nama: 'Agus', jenis: 'manusia', diambilAlih: true });
    expect(alih.tenggatBerikutnya).toBe(mulaiGiliran + BATAS_WAKTU.ambilAlih + DURASI.botBerpikir);

    // Bot bermain atas nama Agus: langkahnya tercatat untuk kursi 1.
    const langkah = jalankanTenggat(alih.state, alih.tenggatBerikutnya!, benih);
    const transisi = pesanUntuk(langkah, 'tok-a').find((p) => p.jenis === 'transisi');
    expect(transisi?.jenis === 'transisi' && transisi.events[0]).toMatchObject({ seat: 1 });
  });

  it('pemain yang diambil alih tidak bisa memasang kartu', () => {
    const { hasil, benih } = sampaiGiliran(ruangBertiga(), 1);
    const alih = jalankanTenggat(hasil.state, hasil.tenggatBerikutnya!, benih).state;
    const { cardId, end } = chooseMove(seatView(alih.game!, 1));
    const coba = terapkan(alih, { jenis: 'pasang', token: 'tok-b', cardId, end }, alih.tenggat!.pada - 1, benih);
    expect(coba.pesan).toEqual([{ untuk: 'tok-b', pesan: { jenis: 'ditolak', alasan: 'diambil-alih' } }]);
    expect(coba.state).toBe(alih);
  });

  it('pemain terputus yang kembali saat bot berpikir langsung memegang kursinya; langkah bot batal dan tenggat 5 menit mulai lagi', () => {
    const { hasil, benih } = sampaiGiliran(ruangBertiga(), 1);
    const putus = terapkan(hasil.state, terputus('tok-b'), hasil.state.jendelaSelesai, benih).state;
    const t = putus.jendelaSelesai + BATAS_WAKTU.ambilAlih;
    const alih = jalankanTenggat(putus, t, benih).state;
    const kembali = terapkan(alih, masuk('tok-b'), t + 100, benih);
    expect(lobi(kembali.state).kursi[1]).toMatchObject({ terputus: false, diambilAlih: false });
    expect(kembali.state.tenggat).toBeNull();
    expect(kembali.tenggatBerikutnya).toBe(t + 100 + BATAS_WAKTU.ambilAlih);
    const snap = pesanUntuk(kembali, 'tok-b')[0];
    expect(snap).toMatchObject({ jenis: 'snapshot', kursi: 1 });
    if (snap?.jenis !== 'snapshot') throw new Error();
    expect(snap.pandangan!.hand).toEqual(alih.game!.session.hands[1]);
    // Waktu langkah bot yang batal lewat: tidak terjadi apa-apa.
    expect(jalankanTenggat(kembali.state, t + DURASI.botBerpikir, benih).state).toBe(kembali.state);
    const { cardId, end } = chooseMove(seatView(kembali.state.game!, 1));
    const main = terapkan(kembali.state, { jenis: 'pasang', token: 'tok-b', cardId, end }, t + 200, benih);
    expect(main.pesan.some((p) => p.pesan.jenis === 'transisi')).toBe(true);
  });

  it('pemain tersambung yang diambil alih mengambil kendali lagi', () => {
    const { hasil, benih } = sampaiGiliran(ruangBertiga(), 1);
    const alih = jalankanTenggat(hasil.state, hasil.tenggatBerikutnya!, benih).state;
    const kendali = terapkan(alih, { jenis: 'ambilKendali', token: 'tok-b' }, alih.jendelaSelesai + 10, benih);
    expect(lobi(kendali.state).kursi[1]).toMatchObject({ diambilAlih: false });
    expect(kendali.state.tenggat).toBeNull();
  });

  it('kembali saat bukan gilirannya hanya melepas bot; tenggat berjalan tidak berubah', () => {
    const { hasil, benih } = sampaiGiliran(ruangBertiga(), 1);
    const alih = jalankanTenggat(hasil.state, hasil.tenggatBerikutnya!, benih);
    const langkahBot = jalankanTenggat(alih.state, alih.tenggatBerikutnya!, benih).state;
    expect(langkahBot.game!.session.turn).not.toBe(1);
    const kembali = terapkan(langkahBot, { jenis: 'ambilKendali', token: 'tok-b' }, langkahBot.jendelaSelesai - 1, benih);
    expect(kembali.state.diambilAlih).toEqual([]);
    expect(kembali.state.tenggat).toEqual(langkahBot.tenggat);
    expect(kembali.state.ambilAlih).toEqual(langkahBot.ambilAlih);
  });

  it('keluar saat game berjalan sama dengan terputus: kursi tetap dan game menunggu gilirannya', () => {
    const { hasil, benih } = sampaiGiliran(ruangBertiga(), 1);
    const pergi = terapkan(hasil.state, keluar('tok-b'), hasil.state.jendelaSelesai, benih);
    expect(lobi(pergi.state).kursi[1]).toMatchObject({ nama: 'Agus', jenis: 'manusia', terputus: true });
    expect(pergi.state.tenggat).toBeNull();
    expect(pergi.tenggatBerikutnya).toBe(hasil.state.jendelaSelesai + BATAS_WAKTU.ambilAlih);
  });

  it('host yang diambil alih bot di tengah game digantikan pemain tersambung berikutnya', () => {
    const { hasil, benih } = sampaiGiliran(ruangBertiga(), 0);
    const putusAgus = terapkan(hasil.state, terputus('tok-b'), 0, benih).state;
    const alih = jalankanTenggat(putusAgus, putusAgus.ambilAlih!.pada, benih).state;
    expect(hostNama(alih)).toBe('Joko');
    // Host lama yang mengambil kendali kembali menjadi pemain biasa.
    const kembali = terapkan(alih, { jenis: 'ambilKendali', token: 'tok-a' }, alih.jendelaSelesai, benih).state;
    expect(hostNama(kembali)).toBe('Joko');
  });

  it('tanpa pemain tersambung lain, ruang tanpa host sampai pemain pertama tersambung lagi', () => {
    const { hasil, benih } = sampaiGiliran(ruangBertiga(), 0);
    const putus = jalankan(hasil.state, 0, terputus('tok-b'), terputus('tok-c')).state;
    const alih = jalankanTenggat(putus, putus.ambilAlih!.pada, benih).state;
    expect(lobi(alih).hostKursi).toBeNull();
    const joko = terapkan(alih, masuk('tok-c'), alih.jendelaSelesai, benih).state;
    expect(hostNama(joko)).toBe('Joko');
  });
});

describe('ruang: hapus ruang', () => {
  it('ruang dihapus 10 menit setelah tidak ada orang tersambung; batal jika ada yang kembali', () => {
    const kosong = jalankan(ruangBertiga(), 0, terputus('tok-a'), terputus('tok-b'), terputus('tok-c'));
    expect(jalankanTenggat(kosong.state, BATAS_WAKTU.hapusRuang - 1, benihTetap()).hapus).toBe(false);
    expect(jalankanTenggat(kosong.state, BATAS_WAKTU.hapusRuang, benihTetap()).hapus).toBe(true);
    const kembali = terapkan(kosong.state, masuk('tok-b'), 60_000, benihTetap());
    expect(jalankanTenggat(kembali.state, BATAS_WAKTU.hapusRuang * 2, benihTetap()).hapus).toBe(false);
  });
});
