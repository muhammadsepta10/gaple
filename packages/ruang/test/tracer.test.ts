import { chooseMove, type SeatView } from '@gaple/aturan';
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
  type Pesan,
  type StateRuang,
} from '../src';

const benihTetap = (awal = 1) => {
  let n = awal;
  return () => n++;
};

const masuk = (token: string, nama: string) => ({ jenis: 'masuk', token, nama, versi: VERSI_PROTOKOL }) as const;

function pesanUntuk(hasil: Hasil, token: string): Pesan[] {
  return hasil.pesan.filter((p) => p.untuk === token).map((p) => p.pesan);
}

function pandanganTerakhir(hasil: Hasil, token: string): SeatView | null {
  const semua = pesanUntuk(hasil, token).filter((p) => p.jenis === 'transisi' || p.jenis === 'snapshot');
  const akhir = semua.at(-1);
  return akhir && 'pandangan' in akhir ? akhir.pandangan as SeatView | null : null;
}

function ruangSiapMain(sekarang = 0) {
  const benih = benihTetap();
  const a = terapkan(buatRuang('KODE22'), masuk('tok-a', 'Budi'), sekarang, benih);
  const b = terapkan(a.state, { jenis: 'mulai', token: 'tok-a' }, sekarang, benih);
  return { benih, hasil: b };
}

describe('ruang: tracer game online lawan bot', () => {
  it('pembuat ruang duduk di kursi 0 dan menjadi host', () => {
    const hasil = terapkan(buatRuang('KODE22'), masuk('tok-a', 'Budi'), 0, benihTetap());
    const lobi = proyeksiLobi(hasil.state);
    expect(lobi.fase).toBe('lobi');
    expect(lobi.hostKursi).toBe(0);
    expect(lobi.kursi.map((k) => k.jenis)).toEqual(['manusia', 'kosong', 'kosong', 'kosong']);
    expect(lobi.kursi[0]!.nama).toBe('Budi');
    expect(pesanUntuk(hasil, 'tok-a')).toEqual([{ jenis: 'snapshot', kursi: 0, pandangan: null, sisaPresentasi: 0 }]);
  });

  it('versi protokol berbeda ditolak', () => {
    const hasil = terapkan(buatRuang('KODE22'), { ...masuk('tok-a', 'Budi'), versi: VERSI_PROTOKOL + 1 }, 0, benihTetap());
    expect(pesanUntuk(hasil, 'tok-a')).toEqual([{ jenis: 'ditolak', alasan: 'perlu-pembaruan' }]);
    expect(hasil.state).toEqual(buatRuang('KODE22'));
  });

  it('nama panggilan kosong ditolak', () => {
    const hasil = terapkan(buatRuang('KODE22'), masuk('tok-a', '   '), 0, benihTetap());
    expect(pesanUntuk(hasil, 'tok-a')).toEqual([{ jenis: 'ditolak', alasan: 'nama-tidak-sah' }]);
  });

  it('mulai mengisi tiga kursi kosong dengan bot dan membuka jendela pembagian', () => {
    const { hasil } = ruangSiapMain(1000);
    const lobi = proyeksiLobi(hasil.state);
    expect(lobi.fase).toBe('bermain');
    expect(lobi.kursi.map((k) => k.jenis)).toEqual(['manusia', 'bot', 'bot', 'bot']);
    const [transisi] = pesanUntuk(hasil, 'tok-a');
    expect(transisi).toMatchObject({ jenis: 'transisi', sisaPresentasi: expect.any(Number) });
    if (transisi?.jenis !== 'transisi') throw new Error();
    const dealt = transisi.events.filter((e) => e.type === 'dealt');
    expect(transisi.sisaPresentasi).toBe(dealt.length * DURASI.bagiTotal);
    expect(transisi.pandangan).toMatchObject({ seat: 0 });
  });

  it('hanya host yang bisa memulai game', () => {
    const benih = benihTetap();
    const a = terapkan(buatRuang('KODE22'), masuk('tok-a', 'Budi'), 0, benih);
    const b = terapkan(a.state, masuk('tok-b', 'Agus'), 0, benih);
    const c = terapkan(b.state, { jenis: 'mulai', token: 'tok-b' }, 0, benih);
    expect(c.pesan).toEqual([{ untuk: 'tok-b', pesan: { jenis: 'ditolak', alasan: 'bukan-host' } }]);
    expect(c.state).toBe(b.state);
  });

  it('langkah bot dijadwalkan di akhir jendela ditambah jeda berpikir', () => {
    const { hasil } = ruangSiapMain(0);
    const game = hasil.state.game!;
    const jendela = hasil.state.jendelaSelesai;
    if (game.session.turn === 0) {
      // Giliran manusia: hanya tenggat ambil alih bot yang berjalan.
      expect(hasil.state.tenggat).toBeNull();
      expect(hasil.tenggatBerikutnya).toBe(jendela + BATAS_WAKTU.ambilAlih);
    } else {
      expect(hasil.tenggatBerikutnya).toBe(jendela + DURASI.botBerpikir);
      const terlalu_awal = jalankanTenggat(hasil.state, jendela + DURASI.botBerpikir - 1, benihTetap(9));
      expect(terlalu_awal.state).toBe(hasil.state);
      expect(terlalu_awal.pesan).toEqual([]);
    }
  });

  it('langkah manusia sebelum jendela selesai ditolak "masih presentasi"', () => {
    const { benih, hasil } = sampaiGiliranManusia();
    const pandangan = pandanganTerakhir(hasil, 'tok-a')!;
    const langkah = chooseMove(pandangan);
    const awal = terapkan(hasil.state, { jenis: 'pasang', token: 'tok-a', cardId: langkah.cardId, end: langkah.end }, hasil.state.jendelaSelesai - 1, benih);
    expect(awal.pesan).toEqual([{ untuk: 'tok-a', pesan: { jenis: 'ditolak', alasan: 'masih-presentasi' } }]);
    expect(awal.state).toBe(hasil.state);
    const tepat = terapkan(hasil.state, { jenis: 'pasang', token: 'tok-a', cardId: langkah.cardId, end: langkah.end }, hasil.state.jendelaSelesai, benih);
    expect(tepat.pesan.some((p) => p.pesan.jenis === 'transisi')).toBe(true);
  });

  it('langkah tidak sah ditolak dan hanya pengirim diberi tahu', () => {
    const benih = benihTetap();
    let hasil = terapkan(buatRuang('KODE22'), masuk('tok-a', 'Budi'), 0, benih);
    hasil = terapkan(hasil.state, masuk('tok-b', 'Agus'), 0, benih);
    hasil = terapkan(hasil.state, { jenis: 'mulai', token: 'tok-a' }, 0, benih);
    const game = hasil.state.game!;
    const t = hasil.state.jendelaSelesai + 60_000;
    const giliran = game.session.turn;
    const bukanGiliranToken = giliran === 0 ? 'tok-b' : 'tok-a';
    const kursiBukanGiliran = giliran === 0 ? 1 : 0;
    const kartuSendiri = game.session.hands[kursiBukanGiliran]![0]!;
    const bukanGiliran = terapkan(hasil.state, { jenis: 'pasang', token: bukanGiliranToken, cardId: kartuSendiri.id, end: 'left' }, t, benih);
    expect(bukanGiliran.pesan).toEqual([{ untuk: bukanGiliranToken, pesan: { jenis: 'ditolak', alasan: 'not-your-turn' } }]);
    expect(bukanGiliran.state).toBe(hasil.state);
    const orangAsing = terapkan(hasil.state, { jenis: 'pasang', token: 'tok-x', cardId: '0-0', end: 'left' }, t, benih);
    expect(orangAsing.pesan).toEqual([{ untuk: 'tok-x', pesan: { jenis: 'ditolak', alasan: 'bukan-pemain' } }]);
  });

  it('game dengan satu manusia dan tiga bot berjalan sampai hasil akhir', () => {
    const akhir = mainkanSampaiSelesai(7);
    expect(proyeksiLobi(akhir.state).fase).toBe('hasil');
    expect(proyeksiLobi(akhir.state).kursi.map((k) => k.jenis)).toEqual(['manusia', 'bot', 'bot', 'bot']);
    expect(akhir.state.game!.result).not.toBeNull();
    expect(akhir.tenggatBerikutnya).toBeNull();
    const events = akhir.semuaPesan.filter((p) => p.jenis === 'transisi').flatMap((p) => p.jenis === 'transisi' ? p.events : []);
    expect(events.at(-1)!.type).toBe('gameEnded');
  });

  it('ronde berikutnya dimulai otomatis di akhir ringkasan ronde', () => {
    const akhir = mainkanSampaiSelesai(3, { targetPoints: 1000 }, 400);
    const ronde = akhir.semuaPesan
      .filter((p) => p.jenis === 'transisi')
      .map((p) => p.jenis === 'transisi' ? p.pandangan.sessionNumber : 0);
    expect(Math.max(...ronde)).toBeGreaterThan(1);
  });

  it('snapshot saat masuk ulang berisi pandangan kursi dan sisa jendela presentasi', () => {
    const { benih, hasil } = ruangSiapMain(0);
    const ulang = terapkan(hasil.state, masuk('tok-a', ''), 100, benih);
    const [snapshot] = pesanUntuk(ulang, 'tok-a');
    expect(snapshot).toMatchObject({ jenis: 'snapshot', kursi: 0, sisaPresentasi: hasil.state.jendelaSelesai - 100 });
    if (snapshot?.jenis !== 'snapshot') throw new Error();
    expect(snapshot.pandangan).toMatchObject({ hand: hasil.state.game!.session.hands[0] });
  });

  it('proyeksi lobi tidak pernah memuat kartu', () => {
    const { hasil } = ruangSiapMain(0);
    const teks = JSON.stringify(proyeksiLobi(hasil.state));
    expect(teks).not.toMatch(/"id":"\d-\d"/);
    expect(teks).not.toContain('hands');
    expect(Object.keys(proyeksiLobi(hasil.state)).sort()).toEqual(['config', 'fase', 'hostKursi', 'kursi', 'penonton']);
  });
});

function sampaiGiliranManusia() {
  for (let awal = 1; awal < 50; awal++) {
    const benih = benihTetap(awal);
    let hasil = terapkan(terapkan(buatRuang('KODE22'), masuk('tok-a', 'Budi'), 0, benih).state, { jenis: 'mulai', token: 'tok-a' }, 0, benih);
    while (hasil.state.tenggat) hasil = jalankanTenggat(hasil.state, hasil.state.tenggat.pada, benih);
    if (hasil.state.game && !hasil.state.game.session.result && hasil.state.game.session.turn === 0) return { benih, hasil };
  }
  throw new Error('tidak menemukan giliran manusia');
}

type Akhir = Hasil & { semuaPesan: Pesan[] };

/** Manusia di kursi 0 bermain `chooseMove` tepat saat jendela selesai; waktu dimajukan ke tenggat berikutnya. */
export function mainkanSampaiSelesai(awal: number, config?: { targetPoints: number }, batasLangkah = 2000): Akhir {
  const benih = benihTetap(awal);
  let state: StateRuang = terapkan(buatRuang('KODE22'), masuk('tok-a', 'Budi'), 0, benih).state;
  if (config) state = { ...state, config: { ...state.config, ...config } };
  let hasil = terapkan(state, { jenis: 'mulai', token: 'tok-a' }, 0, benih);
  const semuaPesan: Pesan[] = pesanUntuk(hasil, 'tok-a');
  for (let i = 0; i < batasLangkah; i++) {
    const game = hasil.state.game!;
    if (game.result) break;
    if (hasil.state.tenggat) {
      hasil = jalankanTenggat(hasil.state, hasil.state.tenggat.pada, benih);
    } else {
      const pandangan = pandanganTerakhir(hasil, 'tok-a')!;
      const langkah = chooseMove(pandangan);
      hasil = terapkan(hasil.state, { jenis: 'pasang', token: 'tok-a', cardId: langkah.cardId, end: langkah.end }, hasil.state.jendelaSelesai, benih);
    }
    semuaPesan.push(...pesanUntuk(hasil, 'tok-a'));
  }
  return { ...hasil, semuaPesan };
}
