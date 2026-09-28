import { chooseMove, publicView, seatView, type Seat } from '@gaple/aturan';
import { describe, expect, it } from 'vitest';
import {
  BATAS_WAKTU,
  PENONTON_MAKS,
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

const pesanUntuk = (hasil: Hasil, token: string): Pesan[] => hasil.pesan.filter((p) => p.untuk === token).map((p) => p.pesan);

function jalankan(state: StateRuang, sekarang: number, ...perintah: Perintah[]): Hasil {
  const benih = benihTetap();
  let hasil: Hasil = { state, pesan: [], tenggatBerikutnya: null, hapus: false };
  for (const p of perintah) hasil = terapkan(hasil.state, p, sekarang, benih);
  return hasil;
}

function ditolak(hasil: Hasil, sebelum: StateRuang, token: string, alasan: string) {
  expect(hasil.pesan).toEqual([{ untuk: token, pesan: { jenis: 'ditolak', alasan } }]);
  expect(hasil.state).toBe(sebelum);
}

/** Budi (host, kursi 0) dan Agus (kursi 1); game berjalan dengan dua bot sejak awal. */
const gameBerdua = () => jalankan(buatRuang('KODE22'), 0, masuk('tok-a', 'Budi'), masuk('tok-b', 'Agus'), { jenis: 'mulai', token: 'tok-a' }).state;

const jenisKursi = (state: StateRuang) => proyeksiLobi(state).kursi.map((k) => k.jenis);

/** Memainkan game sampai hasil akhir: manusia memakai `chooseMove` tepat saat jendela selesai. */
function mainkanSampaiHasil(awal: StateRuang, benih = benihTetap(5)): StateRuang {
  let state = awal;
  for (let i = 0; i < 5000 && state.fase === 'bermain'; i++) {
    if (state.tenggat) {
      state = jalankanTenggat(state, state.tenggat.pada, benih).state;
      continue;
    }
    const game = state.game!;
    const seat = game.session.turn;
    const { cardId, end } = chooseMove(seatView(game, seat));
    state = terapkan(state, { jenis: 'pasang', token: state.kursi[seat]!, cardId, end }, state.jendelaSelesai, benih).state;
  }
  expect(state.fase).toBe('hasil');
  return state;
}

describe('ruang: penonton', () => {
  it('token baru saat game berjalan masuk sebagai penonton dengan snapshot pandangan publik', () => {
    const state = gameBerdua();
    const sekarang = 100;
    const hasil = terapkan(state, masuk('tok-p', 'Sari'), sekarang, benihTetap());
    expect(pesanUntuk(hasil, 'tok-p')).toEqual([{
      jenis: 'snapshot',
      kursi: null,
      pandangan: publicView(state.game!),
      sisaPresentasi: state.jendelaSelesai - sekarang,
    }]);
    expect(proyeksiLobi(hasil.state).penonton).toEqual(['Sari']);
    // Kursi tidak berubah: bot sejak awal tetap bot.
    expect(jenisKursi(hasil.state)).toEqual(['manusia', 'manusia', 'bot', 'bot']);
  });

  it('penonton menerima event publik: pembagian hanya berisi jumlah kartu', () => {
    const lobi = jalankan(buatRuang('KODE22'), 0, masuk('tok-a', 'Budi'), masuk('tok-b', 'Agus'), masuk('tok-c', 'Joko'), masuk('tok-d', 'Dewi')).state;
    // Kursi penuh: pendatang kelima di lobi menjadi penonton.
    const ada = terapkan(lobi, masuk('tok-p', 'Sari'), 0, benihTetap());
    expect(pesanUntuk(ada, 'tok-p')).toEqual([{ jenis: 'snapshot', kursi: null, pandangan: null, sisaPresentasi: 0 }]);
    const mulai = terapkan(ada.state, { jenis: 'mulai', token: 'tok-a' }, 0, benihTetap());
    const [transisi] = pesanUntuk(mulai, 'tok-p');
    if (transisi?.jenis !== 'transisi') throw new Error('penonton tidak menerima transisi');
    expect(transisi.pandangan).toEqual(publicView(mulai.state.game!));
    for (const e of transisi.events) {
      if (e.type === 'dealt') {
        expect(e.hand).toBeNull();
        expect(e.handCounts).toEqual([7, 7, 7, 7]);
      }
    }
  });

  it(`penonton ke-${PENONTON_MAKS + 1} ditolak "ruang penuh"; penonton terputus digantikan pendatang baru`, () => {
    let state = gameBerdua();
    for (let i = 0; i < PENONTON_MAKS; i++) state = terapkan(state, masuk(`tok-p${i}`, `P${i}`), 0, benihTetap()).state;
    expect(proyeksiLobi(state).penonton).toHaveLength(PENONTON_MAKS);
    ditolak(terapkan(state, masuk('tok-x', 'Eko'), 0, benihTetap()), state, 'tok-x', 'ruang-penuh');
    // Penonton yang kembali sebelum tempatnya diambil tetap dikenal.
    const putus = terapkan(state, { jenis: 'terputus', token: 'tok-p0' }, 0, benihTetap()).state;
    expect(proyeksiLobi(putus).penonton).toHaveLength(PENONTON_MAKS - 1);
    expect(pesanUntuk(terapkan(putus, masuk('tok-p0'), 0, benihTetap()), 'tok-p0')).toMatchObject([{ jenis: 'snapshot', kursi: null }]);
    // Pendatang baru menggantikan penonton yang terputus: ruang tidak pernah memegang lebih dari 8 penonton.
    const ganti = terapkan(putus, masuk('tok-x', 'Eko'), 0, benihTetap()).state;
    expect(proyeksiLobi(ganti).penonton).toHaveLength(PENONTON_MAKS);
    expect(Object.keys(ganti.orang)).toHaveLength(2 + PENONTON_MAKS);
    ditolak(terapkan(ganti, masuk('tok-p0'), 0, benihTetap()), ganti, 'tok-p0', 'nama-tidak-sah');
    expect(pesanUntuk(terapkan(ganti, { jenis: 'terputus', token: 'tok-p1' }, 0, benihTetap()), 'tok-p1')).toEqual([]);
  });

  it('penonton tidak menahan ruang: tanpa pemain duduk yang tersambung, ruang dihapus setelah 10 menit', () => {
    let state = terapkan(gameBerdua(), masuk('tok-p', 'Sari'), 0, benihTetap()).state;
    for (const token of ['tok-a', 'tok-b']) state = terapkan(state, { jenis: 'terputus', token }, 0, benihTetap()).state;
    expect(proyeksiLobi(state).penonton).toEqual(['Sari']);
    expect(jalankanTenggat(state, BATAS_WAKTU.hapusRuang - 1, benihTetap()).hapus).toBe(false);
    expect(jalankanTenggat(state, BATAS_WAKTU.hapusRuang, benihTetap()).hapus).toBe(true);
  });

  it('penonton tidak bisa memasang kartu, duduk, atau mengambil kendali saat game berjalan', () => {
    const state = terapkan(gameBerdua(), masuk('tok-p', 'Sari'), 0, benihTetap()).state;
    const game = state.game!;
    const kartu = game.session.hands[2]![0]!;
    const sekarang = state.jendelaSelesai;
    ditolak(terapkan(state, { jenis: 'pasang', token: 'tok-p', cardId: kartu.id, end: 'left' }, sekarang, benihTetap()), state, 'tok-p', 'bukan-pemain');
    for (const kursi of [2, 3] as Seat[]) {
      ditolak(terapkan(state, { jenis: 'pilihKursi', token: 'tok-p', kursi }, 0, benihTetap()), state, 'tok-p', 'game-berjalan');
    }
    expect(terapkan(state, { jenis: 'ambilKendali', token: 'tok-p' }, 0, benihTetap()).state).toBe(state);
  });

  it('penonton yang keluar saat game berjalan melepas nama panggilannya', () => {
    const state = terapkan(gameBerdua(), masuk('tok-p', 'Sari'), 0, benihTetap()).state;
    const keluar = terapkan(state, { jenis: 'keluar', token: 'tok-p' }, 0, benihTetap()).state;
    expect(proyeksiLobi(keluar).penonton).toEqual([]);
    expect(pesanUntuk(terapkan(keluar, masuk('tok-q', 'sari'), 0, benihTetap()), 'tok-q')).toMatchObject([{ jenis: 'snapshot', kursi: null }]);
  });

  it('setelah game selesai penonton bisa duduk di kursi bot, lalu ikut game berikutnya', () => {
    const awal = jalankan(buatRuang('KODE22'), 0,
      masuk('tok-a', 'Budi'), masuk('tok-b', 'Agus'),
      { jenis: 'aturKonfigurasi', token: 'tok-a', config: { targetPoints: 20, doubleBalak: false } },
      { jenis: 'mulai', token: 'tok-a' },
      masuk('tok-p', 'Sari'),
    ).state;
    const hasil = mainkanSampaiHasil(awal);
    expect(jenisKursi(hasil)).toEqual(['manusia', 'manusia', 'bot', 'bot']);
    const duduk = terapkan(hasil, { jenis: 'pilihKursi', token: 'tok-p', kursi: 3 }, 0, benihTetap());
    expect(pesanUntuk(duduk, 'tok-p')).toEqual([{ jenis: 'snapshot', kursi: 3, pandangan: null, sisaPresentasi: 0 }]);
    expect(proyeksiLobi(duduk.state).penonton).toEqual([]);
    const baru = terapkan(duduk.state, { jenis: 'mulai', token: 'tok-a' }, 0, benihTetap(7));
    expect(baru.state.botSejakAwal).toEqual([2]);
    expect(pesanUntuk(baru, 'tok-p')[0]).toMatchObject({ jenis: 'transisi', pandangan: { seat: 3 } });
  });
});

describe('ruang: kursi bot saat game berjalan', () => {
  it('kursi bot sejak awal tetap dimainkan bot: tidak bisa diambil pemain maupun penonton', () => {
    const state = terapkan(gameBerdua(), masuk('tok-p', 'Sari'), 0, benihTetap()).state;
    ditolak(terapkan(state, { jenis: 'pilihKursi', token: 'tok-b', kursi: 2 }, 0, benihTetap()), state, 'tok-b', 'game-berjalan');
    ditolak(terapkan(state, { jenis: 'pilihKursi', token: 'tok-p', kursi: 3 }, 0, benihTetap()), state, 'tok-p', 'game-berjalan');
    expect(state.botSejakAwal).toEqual([2, 3]);
  });

  it('kursi bot pengganti hanya kembali ke pemilik token aslinya', () => {
    // Giliran pertama selalu manusia atau bot; majukan waktu sampai sebuah kursi manusia diambil alih.
    let state = terapkan(gameBerdua(), masuk('tok-p', 'Sari'), 0, benihTetap()).state;
    const benih = benihTetap(3);
    for (let i = 0; i < 200 && state.diambilAlih.length === 0; i++) {
      const pada = Math.min(state.tenggat?.pada ?? Infinity, state.ambilAlih?.pada ?? Infinity);
      state = jalankanTenggat(state, pada, benih).state;
    }
    const [kursi] = state.diambilAlih;
    expect(kursi === 0 || kursi === 1).toBe(true);
    const pemilik = state.kursi[kursi!]!;
    // Penonton dan pemain lain tidak bisa mengambilnya.
    ditolak(terapkan(state, { jenis: 'pilihKursi', token: 'tok-p', kursi: kursi! }, 0, benihTetap()), state, 'tok-p', 'game-berjalan');
    expect(terapkan(state, { jenis: 'ambilKendali', token: 'tok-p' }, 0, benihTetap()).state.diambilAlih).toEqual([kursi]);
    const lain = pemilik === 'tok-a' ? 'tok-b' : 'tok-a';
    expect(terapkan(state, { jenis: 'ambilKendali', token: lain }, 0, benihTetap()).state.diambilAlih).toEqual([kursi]);
    // Pemilik aslinya memegang kendali lagi.
    expect(terapkan(state, { jenis: 'ambilKendali', token: pemilik }, 0, benihTetap()).state.diambilAlih).toEqual([]);
  });
});
