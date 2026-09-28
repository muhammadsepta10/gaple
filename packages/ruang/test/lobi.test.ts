import { chooseMove, seatView } from '@gaple/aturan';
import { describe, expect, it } from 'vitest';
import {
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

const masuk = (token: string, nama: string): Perintah => ({ jenis: 'masuk', token, nama, versi: VERSI_PROTOKOL });

function pesanUntuk(hasil: Hasil, token: string): Pesan[] {
  return hasil.pesan.filter((p) => p.untuk === token).map((p) => p.pesan);
}

/** Menerapkan perintah berurutan pada waktu 0; hasil terakhir dikembalikan. */
function jalankan(state: StateRuang, ...perintah: Perintah[]): Hasil {
  const benih = benihTetap();
  let hasil: Hasil = { state, pesan: [], tenggatBerikutnya: null, hapus: false };
  for (const p of perintah) hasil = terapkan(hasil.state, p, 0, benih);
  return hasil;
}

/** Ruang dengan Budi (host, kursi 0) dan Agus (kursi 1). */
const ruangBerdua = () => jalankan(buatRuang('KODE22'), masuk('tok-a', 'Budi'), masuk('tok-b', 'Agus')).state;

const jenisKursi = (state: StateRuang) => proyeksiLobi(state).kursi.map((k) => k.jenis);
const namaKursi = (state: StateRuang) => proyeksiLobi(state).kursi.map((k) => k.nama);

function ditolak(hasil: Hasil, sebelum: StateRuang, token: string, alasan: string) {
  expect(hasil.pesan).toEqual([{ untuk: token, pesan: { jenis: 'ditolak', alasan } }]);
  expect(hasil.state).toBe(sebelum);
}

/** Memainkan game sampai hasil akhir: manusia memakai `chooseMove` tepat saat jendela selesai. */
function mainkanSampaiHasil(state: StateRuang, benih = benihTetap(5)): StateRuang {
  let hasil = terapkan(state, { jenis: 'mulai', token: state.host! }, 0, benih);
  for (let i = 0; i < 5000 && hasil.state.fase === 'bermain'; i++) {
    const s = hasil.state;
    if (s.tenggat) {
      hasil = jalankanTenggat(s, s.tenggat.pada, benih);
      continue;
    }
    const game = s.game!;
    const token = s.kursi[game.session.turn]!;
    const { cardId, end } = chooseMove(seatView(game, game.session.turn));
    hasil = terapkan(s, { jenis: 'pasang', token, cardId, end }, s.jendelaSelesai, benih);
  }
  expect(hasil.state.fase).toBe('hasil');
  return hasil.state;
}

describe('ruang: nama panggilan', () => {
  it('nama dipangkas sebelum disimpan', () => {
    const { state } = jalankan(buatRuang('KODE22'), masuk('tok-a', '  Budi  '));
    expect(namaKursi(state)[0]).toBe('Budi');
  });

  it('nama yang sama tanpa membedakan huruf besar-kecil ditolak "nama dipakai"', () => {
    const sebelum = ruangBerdua();
    ditolak(terapkan(sebelum, masuk('tok-c', ' bUDI '), 0, benihTetap()), sebelum, 'tok-c', 'nama-dipakai');
  });

  it('nama 12 grafem diterima, 13 grafem ditolak; emoji dihitung satu', () => {
    const duaBelas = '👨‍👩‍👧‍👦'.repeat(12);
    expect(jenisKursi(jalankan(buatRuang('KODE22'), masuk('tok-a', duaBelas)).state)[0]).toBe('manusia');
    const sebelum = buatRuang('KODE22');
    ditolak(terapkan(sebelum, masuk('tok-a', 'abcdefghijklm'), 0, benihTetap()), sebelum, 'tok-a', 'nama-tidak-sah');
  });

  it('token yang dikenal kembali ke kursinya tanpa nama panggilan', () => {
    const state = ruangBerdua();
    const hasil = terapkan(state, masuk('tok-b', ''), 0, benihTetap());
    expect(hasil.state).toBe(state);
    expect(pesanUntuk(hasil, 'tok-b')).toEqual([{ jenis: 'snapshot', kursi: 1, pandangan: null, sisaPresentasi: 0 }]);
  });
});

describe('ruang: kursi di lobi', () => {
  it('pemain pindah ke kursi kosong dan menerima snapshot kursi barunya', () => {
    const hasil = terapkan(ruangBerdua(), { jenis: 'pilihKursi', token: 'tok-b', kursi: 3 }, 0, benihTetap());
    expect(jenisKursi(hasil.state)).toEqual(['manusia', 'kosong', 'kosong', 'manusia']);
    expect(namaKursi(hasil.state)[3]).toBe('Agus');
    expect(pesanUntuk(hasil, 'tok-b')).toEqual([{ jenis: 'snapshot', kursi: 3, pandangan: null, sisaPresentasi: 0 }]);
  });

  it('kursi yang sudah diisi manusia tidak bisa dipilih', () => {
    const sebelum = ruangBerdua();
    ditolak(terapkan(sebelum, { jenis: 'pilihKursi', token: 'tok-b', kursi: 0 }, 0, benihTetap()), sebelum, 'tok-b', 'kursi-terisi');
  });

  it('orang yang tidak dikenal ruang tidak bisa memilih kursi', () => {
    const sebelum = ruangBerdua();
    ditolak(terapkan(sebelum, { jenis: 'pilihKursi', token: 'tok-x', kursi: 2 }, 0, benihTetap()), sebelum, 'tok-x', 'bukan-pemain');
  });

  it('pendatang baru duduk di kursi kosong pertama; saat empat kursi terisi manusia ia menjadi penonton', () => {
    const tiga = jalankan(ruangBerdua(), { jenis: 'pilihKursi', token: 'tok-b', kursi: 3 }, masuk('tok-c', 'Joko')).state;
    expect(namaKursi(tiga)).toEqual(['Budi', 'Joko', '', 'Agus']);
    const penuh = jalankan(tiga, masuk('tok-d', 'Sari')).state;
    const datang = terapkan(penuh, masuk('tok-e', 'Eko'), 0, benihTetap());
    expect(pesanUntuk(datang, 'tok-e')).toEqual([{ jenis: 'snapshot', kursi: null, pandangan: null, sisaPresentasi: 0 }]);
    expect(proyeksiLobi(datang.state).penonton).toEqual(['Eko']);
  });

  it('saat game berjalan kursi tidak bisa dipilih', () => {
    const bermain = jalankan(ruangBerdua(), { jenis: 'mulai', token: 'tok-a' }).state;
    expect(bermain.fase).toBe('bermain');
    ditolak(terapkan(bermain, { jenis: 'pilihKursi', token: 'tok-b', kursi: 2 }, 0, benihTetap()), bermain, 'tok-b', 'game-berjalan');
  });
});

describe('ruang: kontrol host', () => {
  it('host mengatur target poin dan balak ganda; semua melihatnya di proyeksi lobi', () => {
    const hasil = terapkan(ruangBerdua(), { jenis: 'aturKonfigurasi', token: 'tok-a', config: { targetPoints: 150, doubleBalak: true } }, 0, benihTetap());
    expect(proyeksiLobi(hasil.state).config).toEqual({ targetPoints: 150, doubleBalak: true });
    expect(hasil.pesan).toEqual([]);
  });

  it('target poin harus bilangan bulat positif yang wajar', () => {
    const sebelum = ruangBerdua();
    for (const targetPoints of [0, -5, 1.5, Number.NaN, 100_000]) {
      ditolak(
        terapkan(sebelum, { jenis: 'aturKonfigurasi', token: 'tok-a', config: { targetPoints, doubleBalak: false } }, 0, benihTetap()),
        sebelum, 'tok-a', 'konfigurasi-tidak-sah',
      );
    }
  });

  it('perintah host dari non-host ditolak "bukan host"', () => {
    const sebelum = ruangBerdua();
    const perintah: Perintah[] = [
      { jenis: 'aturKonfigurasi', token: 'tok-b', config: { targetPoints: 50, doubleBalak: false } },
      { jenis: 'pindahkan', token: 'tok-b', dari: 0, ke: 2 },
      { jenis: 'kosongkan', token: 'tok-b', kursi: 0 },
      { jenis: 'mulai', token: 'tok-b' },
    ];
    for (const p of perintah) ditolak(terapkan(sebelum, p, 0, benihTetap()), sebelum, 'tok-b', 'bukan-host');
  });

  it('host memindahkan pemain ke kursi kosong; pemain itu menerima snapshot kursi barunya', () => {
    const hasil = terapkan(ruangBerdua(), { jenis: 'pindahkan', token: 'tok-a', dari: 1, ke: 2 }, 0, benihTetap());
    expect(namaKursi(hasil.state)).toEqual(['Budi', '', 'Agus', '']);
    expect(pesanUntuk(hasil, 'tok-b')).toEqual([{ jenis: 'snapshot', kursi: 2, pandangan: null, sisaPresentasi: 0 }]);
  });

  it('memindahkan ke kursi berisi manusia menukar keduanya; host tetap host di kursi barunya', () => {
    const hasil = terapkan(ruangBerdua(), { jenis: 'pindahkan', token: 'tok-a', dari: 1, ke: 0 }, 0, benihTetap());
    expect(namaKursi(hasil.state)).toEqual(['Agus', 'Budi', '', '']);
    expect(proyeksiLobi(hasil.state).hostKursi).toBe(1);
    expect(pesanUntuk(hasil, 'tok-a')).toEqual([{ jenis: 'snapshot', kursi: 1, pandangan: null, sisaPresentasi: 0 }]);
    expect(pesanUntuk(hasil, 'tok-b')).toEqual([{ jenis: 'snapshot', kursi: 0, pandangan: null, sisaPresentasi: 0 }]);
  });

  it('memindahkan dari kursi kosong ditolak', () => {
    const sebelum = ruangBerdua();
    ditolak(terapkan(sebelum, { jenis: 'pindahkan', token: 'tok-a', dari: 3, ke: 2 }, 0, benihTetap()), sebelum, 'tok-a', 'kursi-kosong');
  });

  it('host mengosongkan kursi pemain lain; pemain itu tetap di ruang tanpa kursi dan bisa duduk lagi', () => {
    const hasil = terapkan(ruangBerdua(), { jenis: 'kosongkan', token: 'tok-a', kursi: 1 }, 0, benihTetap());
    expect(jenisKursi(hasil.state)).toEqual(['manusia', 'kosong', 'kosong', 'kosong']);
    expect(pesanUntuk(hasil, 'tok-b')).toEqual([{ jenis: 'snapshot', kursi: null, pandangan: null, sisaPresentasi: 0 }]);
    // Nama panggilan tetap dipegang.
    ditolak(terapkan(hasil.state, masuk('tok-c', 'agus'), 0, benihTetap()), hasil.state, 'tok-c', 'nama-dipakai');
    const duduk = terapkan(hasil.state, { jenis: 'pilihKursi', token: 'tok-b', kursi: 2 }, 0, benihTetap());
    expect(namaKursi(duduk.state)).toEqual(['Budi', '', 'Agus', '']);
  });

  it('host tidak bisa mengosongkan kursinya sendiri atau kursi yang sudah kosong', () => {
    const sebelum = ruangBerdua();
    ditolak(terapkan(sebelum, { jenis: 'kosongkan', token: 'tok-a', kursi: 0 }, 0, benihTetap()), sebelum, 'tok-a', 'kursi-host');
    ditolak(terapkan(sebelum, { jenis: 'kosongkan', token: 'tok-a', kursi: 3 }, 0, benihTetap()), sebelum, 'tok-a', 'kursi-kosong');
  });

  it('konfigurasi, pindah, dan kosongkan terkunci selama game berjalan', () => {
    const bermain = jalankan(ruangBerdua(), { jenis: 'mulai', token: 'tok-a' }).state;
    const perintah: Perintah[] = [
      { jenis: 'aturKonfigurasi', token: 'tok-a', config: { targetPoints: 50, doubleBalak: false } },
      { jenis: 'pindahkan', token: 'tok-a', dari: 1, ke: 2 },
      { jenis: 'kosongkan', token: 'tok-a', kursi: 1 },
      { jenis: 'mulai', token: 'tok-a' },
    ];
    for (const p of perintah) ditolak(terapkan(bermain, p, 0, benihTetap()), bermain, 'tok-a', 'game-berjalan');
  });

  it('mulai mengisi kursi kosong dengan bot yang dicatat "bot sejak awal"; kursi yang dipilih dipakai', () => {
    const state = jalankan(ruangBerdua(), { jenis: 'pilihKursi', token: 'tok-b', kursi: 2 }, { jenis: 'mulai', token: 'tok-a' }).state;
    expect(state.botSejakAwal).toEqual([1, 3]);
    expect(jenisKursi(state)).toEqual(['manusia', 'bot', 'manusia', 'bot']);
  });

  it('game memakai konfigurasi host', () => {
    const state = jalankan(
      ruangBerdua(),
      { jenis: 'aturKonfigurasi', token: 'tok-a', config: { targetPoints: 30, doubleBalak: true } },
      { jenis: 'mulai', token: 'tok-a' },
    ).state;
    expect(state.game!.config).toEqual({ targetPoints: 30, doubleBalak: true });
  });
});

describe('ruang: game baru setelah hasil akhir', () => {
  it('semua tetap di kursi yang sama; host mengubah target lalu memulai game baru dengan total nol', () => {
    const awal = jalankan(ruangBerdua(), { jenis: 'pilihKursi', token: 'tok-b', kursi: 2 }, { jenis: 'aturKonfigurasi', token: 'tok-a', config: { targetPoints: 20, doubleBalak: false } }).state;
    const hasil = mainkanSampaiHasil(awal);
    expect(namaKursi(hasil)).toEqual(['Budi', 'Bot 2', 'Agus', 'Bot 4']);
    const diatur = terapkan(hasil, { jenis: 'aturKonfigurasi', token: 'tok-a', config: { targetPoints: 40, doubleBalak: true } }, 0, benihTetap());
    expect(proyeksiLobi(diatur.state).config).toEqual({ targetPoints: 40, doubleBalak: true });
    const baru = terapkan(diatur.state, { jenis: 'mulai', token: 'tok-a' }, 0, benihTetap(99));
    expect(baru.state.fase).toBe('bermain');
    expect(baru.state.game!.config.targetPoints).toBe(40);
    expect(baru.state.game!.totals).toEqual([0, 0, 0, 0]);
    expect(namaKursi(baru.state)).toEqual(['Budi', 'Bot 2', 'Agus', 'Bot 4']);
    expect(pesanUntuk(baru, 'tok-b')[0]).toMatchObject({ jenis: 'transisi', pandangan: { seat: 2 } });
  });

  it('di hasil akhir kursi bot dianggap kosong: pemain bisa pindah dan pendatang baru bisa duduk', () => {
    const hasil = mainkanSampaiHasil(ruangBerdua());
    const pindah = terapkan(hasil, { jenis: 'pilihKursi', token: 'tok-b', kursi: 3 }, 0, benihTetap());
    expect(pesanUntuk(pindah, 'tok-b')).toEqual([{ jenis: 'snapshot', kursi: 3, pandangan: null, sisaPresentasi: 0 }]);
    const datang = terapkan(pindah.state, masuk('tok-c', 'Joko'), 0, benihTetap());
    expect(pesanUntuk(datang, 'tok-c')).toEqual([{ jenis: 'snapshot', kursi: 1, pandangan: null, sisaPresentasi: 0 }]);
    const baru = terapkan(datang.state, { jenis: 'mulai', token: 'tok-a' }, 0, benihTetap());
    expect(baru.state.botSejakAwal).toEqual([2]);
    expect(jenisKursi(baru.state)).toEqual(['manusia', 'manusia', 'bot', 'manusia']);
  });
});
