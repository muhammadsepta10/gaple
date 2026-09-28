import { chooseMove, type SeatView } from '@gaple/aturan';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { Room } from '@colyseus/sdk';
import { VERSI_PROTOKOL, type Pesan } from '@gaple/ruang';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buatServer } from '../src/server';

/** Waktu ruang berjalan 1000× lebih cepat agar satu game selesai dalam hitungan detik. */
const SKALA = 1000;

let colyseus: ColyseusTestServer;

beforeAll(async () => { colyseus = await boot(buatServer({ skala: SKALA }), 2600); });
afterAll(async () => { await colyseus.shutdown(); });
beforeEach(async () => { await colyseus.cleanup(); });

type Pemain = { room: Room; pesan: Pesan[]; lobi: string[] };

function rekam(room: Room): Pemain {
  const pemain: Pemain = { room, pesan: [], lobi: [] };
  room.onMessage('pesan', (p: Pesan) => pemain.pesan.push(p));
  room.onStateChange((state) => pemain.lobi.push(JSON.stringify(state.toJSON())));
  return pemain;
}

/** Bermain otomatis: pada gilirannya, tunggu sisa jendela presentasi lalu kirim langkah bot. */
function mainOtomatis(p: Pemain) {
  let tunda: ReturnType<typeof setTimeout> | undefined;
  let terakhir: SeatView | null = null;
  const coba = (ms: number) => {
    clearTimeout(tunda);
    const view = terakhir;
    if (!view || view.gameResult || view.sessionResult || view.turn !== view.seat) return;
    tunda = setTimeout(() => {
      const m = chooseMove(view);
      p.room.send('pasang', { cardId: m.cardId, end: m.end });
    }, ms);
  };
  p.room.onMessage('pesan', (pesan: Pesan) => {
    if (pesan.jenis === 'transisi' || pesan.jenis === 'snapshot') {
      terakhir = pesan.pandangan;
      coba(pesan.sisaPresentasi / SKALA + 1);
    } else if (pesan.alasan === 'masih-presentasi') coba(2);
  });
}

async function tunggu(syarat: () => boolean, batas = 20_000) {
  const mulai = Date.now();
  while (!syarat()) {
    if (Date.now() - mulai > batas) throw new Error('waktu habis');
    await new Promise((r) => setTimeout(r, 5));
  }
}

const opsi = (token: string, nama: string) => ({ token, nama, versi: VERSI_PROTOKOL });

describe('server: ruang privat', () => {
  it('buat ruang, mulai, main melawan bot sampai hasil akhir; Schema tidak pernah berisi kartu', async () => {
    const a = rekam(await colyseus.sdk.create('ruang', opsi('tok-a', 'Budi')));
    const b = rekam(await colyseus.sdk.joinById(a.room.roomId, opsi('tok-b', 'Agus')));
    mainOtomatis(a);
    mainOtomatis(b);
    await tunggu(() => a.lobi.length > 0 && b.pesan.length > 0);
    expect(a.pesan[0]).toEqual({ jenis: 'snapshot', kursi: 0, pandangan: null, sisaPresentasi: 0 });
    expect(b.pesan[0]).toMatchObject({ jenis: 'snapshot', kursi: 1 });

    a.room.send('mulai');
    await tunggu(() => a.room.state.fase === 'bermain');
    expect(a.room.state.kursi.map((k: { jenis: string }) => k.jenis)).toEqual(['manusia', 'manusia', 'bot', 'bot']);

    await tunggu(() => a.room.state.fase === 'hasil' && a.pesan.some((p) => p.jenis === 'transisi' && p.events.some((e) => e.type === 'gameEnded')), 60_000);
    expect(b.pesan.some((p) => p.jenis === 'transisi' && p.events.some((e) => e.type === 'gameEnded'))).toBe(true);
    expect(a.room.state.kursi.map((k: { jenis: string }) => k.jenis)).toEqual(['manusia', 'manusia', 'bot', 'bot']);

    for (const teks of [...a.lobi, ...b.lobi]) {
      expect(teks).not.toMatch(/\d-\d/);
      expect(teks).not.toMatch(/hand|tok-/);
    }
  }, 90_000);

  it('langkah tidak sah hanya ditolak ke pengirimnya', async () => {
    const a = rekam(await colyseus.sdk.create('ruang', opsi('tok-a', 'Budi')));
    const b = rekam(await colyseus.sdk.joinById(a.room.roomId, opsi('tok-b', 'Agus')));
    a.room.send('mulai');
    await tunggu(() => a.pesan.some((p) => p.jenis === 'transisi') && b.pesan.some((p) => p.jenis === 'transisi'));
    b.room.send('pasang', { cardId: 'bukan-kartu', end: 'left' });
    b.room.send('pasang', { cardId: 'bukan-kartu', end: 'atas' });
    await tunggu(() => b.pesan.filter((p) => p.jenis === 'ditolak').length === 2);
    expect(b.pesan.filter((p) => p.jenis === 'ditolak')).toEqual([
      { jenis: 'ditolak', alasan: expect.stringMatching(/^(masih-presentasi|not-your-turn|card-not-in-hand)$/) },
      { jenis: 'ditolak', alasan: 'perintah-tidak-sah' },
    ]);
    expect(a.pesan.some((p) => p.jenis === 'ditolak')).toBe(false);
  });

  it('versi protokol berbeda ditolak saat masuk', async () => {
    await expect(colyseus.sdk.create('ruang', { ...opsi('tok-a', 'Budi'), versi: VERSI_PROTOKOL + 1 })).rejects.toThrow(/perlu-pembaruan/);
  });

  it('kode undangan menjadi roomId; teman bergabung lewat kode, memilih kursi, host mengatur dan memulai', async () => {
    const a = rekam(await colyseus.sdk.create('ruang', opsi('tok-a', 'Budi')));
    expect(a.room.roomId).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    const b = rekam(await colyseus.sdk.joinById(a.room.roomId, opsi('tok-b', 'Agus')));
    b.room.send('pilihKursi', { kursi: 2 });
    await tunggu(() => a.room.state.kursi[2]?.nama === 'Agus');
    expect(b.pesan.at(-1)).toEqual({ jenis: 'snapshot', kursi: 2, pandangan: null, sisaPresentasi: 0 });

    b.room.send('aturKonfigurasi', { targetPoin: 50, balakGanda: true });
    await tunggu(() => b.pesan.some((p) => p.jenis === 'ditolak'));
    expect(b.pesan.filter((p) => p.jenis === 'ditolak')).toEqual([{ jenis: 'ditolak', alasan: 'bukan-host' }]);

    a.room.send('aturKonfigurasi', { targetPoin: 50, balakGanda: true });
    a.room.send('pindahkan', { dari: 2, ke: 3 });
    await tunggu(() => b.room.state.targetPoin === 50 && b.room.state.kursi[3]?.nama === 'Agus');
    expect(b.room.state.balakGanda).toBe(true);

    a.room.send('pindahkan', { dari: 'dua', ke: 3 });
    await tunggu(() => a.pesan.some((p) => p.jenis === 'ditolak'));
    expect(a.pesan.filter((p) => p.jenis === 'ditolak')).toEqual([{ jenis: 'ditolak', alasan: 'perintah-tidak-sah' }]);

    a.room.send('mulai');
    await tunggu(() => b.pesan.some((p) => p.jenis === 'transisi') && a.room.state.fase === 'bermain');
    expect(a.room.state.kursi.map((k: { jenis: string }) => k.jenis)).toEqual(['manusia', 'bot', 'bot', 'manusia']);
    expect(b.pesan.find((p) => p.jenis === 'transisi')).toMatchObject({ pandangan: { seat: 3, config: { targetPoints: 50, doubleBalak: true } } });
  });

  it('kode yang tidak ada ditolak', async () => {
    await expect(colyseus.sdk.joinById('ZZZZZZ', opsi('tok-a', 'Budi'))).rejects.toThrow(/not found/);
  });

  it('nama bentrok ditolak saat bergabung', async () => {
    const a = rekam(await colyseus.sdk.create('ruang', opsi('tok-a', 'Budi')));
    await expect(colyseus.sdk.joinById(a.room.roomId, opsi('tok-b', 'budi'))).rejects.toThrow(/nama-dipakai/);
  });
});
