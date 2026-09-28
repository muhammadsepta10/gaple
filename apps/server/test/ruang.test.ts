import type { SeatView } from '@gaple/aturan';
import { ColyseusTestServer } from '@colyseus/testing';
import { KODE_TUTUP_DIGANTIKAN, VERSI_PROTOKOL } from '@gaple/ruang';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buatServer } from '../src/server';
import { mainOtomatis as mainOtomatisSkala, opsi, rekam, tunggu, type Pemain } from './bantu';

/** Waktu ruang berjalan 1000× lebih cepat agar satu game selesai dalam hitungan detik. */
const SKALA = 1000;

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  // `boot()` mengabaikan port untuk instance Server; listen sendiri agar file tes bisa berjalan paralel.
  // Waktu dipercepat, jadi klien otomatis mengirim pesan jauh lebih rapat: batas laju dilonggarkan.
  const server = buatServer({ skala: SKALA, batas: { buatRuangPerJam: 1000, pesanPerDetik: Infinity } });
  await server.listen(2600);
  colyseus = new ColyseusTestServer(server);
});
afterAll(async () => { await colyseus.shutdown(); });
beforeEach(async () => { await colyseus.cleanup(); });

const mainOtomatis = (p: Pemain) => mainOtomatisSkala(p, SKALA);

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

  it('token yang sama di koneksi kedua memutus koneksi pertama; kursi tetap miliknya', async () => {
    const a = rekam(await colyseus.sdk.create('ruang', opsi('tok-a', 'Budi')));
    const b = rekam(await colyseus.sdk.joinById(a.room.roomId, opsi('tok-b', 'Agus')));
    let tutup: number | null = null;
    a.room.onLeave((code) => { tutup = code; });
    const a2 = rekam(await colyseus.sdk.joinById(a.room.roomId, opsi('tok-a', '')));
    await tunggu(() => tutup !== null && a2.pesan.length > 0);
    expect(tutup).toBe(KODE_TUTUP_DIGANTIKAN);
    expect(a2.pesan[0]).toEqual({ jenis: 'snapshot', kursi: 0, pandangan: null, sisaPresentasi: 0 });
    // Koneksi lama yang tertutup tidak membuat pemilik token Terputus.
    await new Promise((r) => setTimeout(r, 50));
    expect(b.room.state.kursi[0]).toMatchObject({ nama: 'Budi', terputus: false });
    expect(b.room.state.hostKursi).toBe(0);
  });

  it('pemain yang terputus di tengah ronde kembali ke kursi dan kartunya dengan token yang sama', async () => {
    const a = rekam(await colyseus.sdk.create('ruang', opsi('tok-a', 'Budi')));
    const b = rekam(await colyseus.sdk.joinById(a.room.roomId, opsi('tok-b', 'Agus')));
    a.room.send('aturKonfigurasi', { targetPoin: 10_000, balakGanda: false });
    a.room.send('mulai');
    await tunggu(() => b.pesan.some((p) => p.jenis === 'transisi'));
    const kode = b.room.roomId;
    await b.room.leave(false);
    await tunggu(() => a.room.state.kursi[1]?.terputus === true);
    expect(a.room.state.kursi[1]).toMatchObject({ nama: 'Agus', jenis: 'manusia' });

    const b2 = rekam(await colyseus.sdk.joinById(kode, opsi('tok-b', '')));
    await tunggu(() => b2.pesan.length > 0 && a.room.state.kursi[1]?.terputus === false);
    const [snapshot] = b2.pesan;
    expect(snapshot).toMatchObject({ jenis: 'snapshot', kursi: 1, pandangan: { seat: 1, config: { targetPoints: 10_000 } } });
    if (snapshot?.jenis !== 'snapshot') throw new Error();
    expect((snapshot.pandangan as SeatView).hand.length).toBeGreaterThan(0);
  });

  it('orang yang masuk saat game berjalan menjadi penonton: Schema memuat namanya, pesannya tanpa tangan siapa pun', async () => {
    const a = rekam(await colyseus.sdk.create('ruang', opsi('tok-a', 'Budi')));
    a.room.send('aturKonfigurasi', { targetPoin: 10_000, balakGanda: false });
    a.room.send('mulai');
    await tunggu(() => a.pesan.some((p) => p.jenis === 'transisi'));
    const p = rekam(await colyseus.sdk.joinById(a.room.roomId, opsi('tok-p', 'Sari')));
    await tunggu(() => p.pesan.length > 0 && a.room.state.penonton.length === 1);
    expect(a.room.state.penonton.toArray()).toEqual(['Sari']);
    const [snapshot] = p.pesan;
    expect(snapshot).toMatchObject({ jenis: 'snapshot', kursi: null, pandangan: { sessionNumber: 1, handCounts: expect.any(Array) } });
    // Susunan kartu publik boleh terlihat; tangan siapa pun tidak.
    expect(JSON.stringify(snapshot)).not.toMatch(/"hand"/);
    // Ronde berikutnya: pembagian ke penonton hanya berisi jumlah kartu.
    mainOtomatis(a);
    await tunggu(() => p.pesan.some((x) => x.jenis === 'transisi' && x.events.some((e) => e.type === 'dealt')), 60_000);
    const bagi = p.pesan.flatMap((x) => (x.jenis === 'transisi' ? x.events : [])).filter((e) => e.type === 'dealt');
    for (const e of bagi) expect(e).toMatchObject({ hand: null });
  }, 90_000);

  it('ruang tetap ada saat semua pemain terputus sementara; keluar ruang di lobi melepas kursi', async () => {
    const a = rekam(await colyseus.sdk.create('ruang', opsi('tok-a', 'Budi')));
    const kode = a.room.roomId;
    await a.room.leave(false);
    const a2 = rekam(await colyseus.sdk.joinById(kode, opsi('tok-a', '')));
    await tunggu(() => a2.pesan.length > 0);
    expect(a2.pesan[0]).toMatchObject({ jenis: 'snapshot', kursi: 0 });

    const b = rekam(await colyseus.sdk.joinById(kode, opsi('tok-b', 'Agus')));
    b.room.send('keluar');
    await tunggu(() => a2.room.state.kursi[1]?.jenis === 'kosong');
    await expect(colyseus.sdk.joinById(kode, opsi('tok-b', ''))).rejects.toThrow(/nama-tidak-sah/);
  });
});
