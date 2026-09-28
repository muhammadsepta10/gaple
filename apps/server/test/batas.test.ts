import { Client } from '@colyseus/sdk';
import { ColyseusTestServer } from '@colyseus/testing';
import { VERSI_PROTOKOL } from '@gaple/ruang';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buatServer } from '../src/server';

const PORT = 2601;

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  const server = buatServer({ batas: { buatRuangPerJam: 3, kodeTakDikenalPerMenit: 4, pesanPerDetik: 5 } });
  await server.listen(PORT);
  colyseus = new ColyseusTestServer(server);
});
afterAll(async () => { await colyseus.shutdown(); });
beforeEach(async () => { await colyseus.cleanup(); });

/** Klien yang tampak datang dari `ip` (di produksi Caddy mengisi X-Forwarded-For). */
const klienDari = (ip: string) => new Client(`http://localhost:${PORT}`, { headers: { 'x-forwarded-for': ip } });

const opsi = (token: string, nama: string) => ({ token, nama, versi: VERSI_PROTOKOL });

async function kesehatan(): Promise<{ ruangAktif: number }> {
  const res = await fetch(`http://localhost:${PORT}/kesehatan`);
  expect(res.status).toBe(200);
  return await res.json() as { ruangAktif: number };
}

describe('server: batas penyalahgunaan', () => {
  it('buat ruang dibatasi per IP; IP lain tidak terpengaruh', async () => {
    const klien = klienDari('10.0.0.1');
    for (let i = 0; i < 3; i++) await klien.create('ruang', opsi(`tok-${i}`, `P${i}`));
    await expect(klien.create('ruang', opsi('tok-x', 'X'))).rejects.toThrow(/batas-terlampaui/);
    // Header yang dikirim klien sendiri tidak memberi kuota baru; hanya hop terakhir X-Forwarded-For (dari Caddy) yang dipercaya.
    const palsu = new Client(`http://localhost:${PORT}`, { headers: { 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9, 10.0.0.1' } });
    await expect(palsu.create('ruang', opsi('tok-x', 'X'))).rejects.toThrow(/batas-terlampaui/);
    await expect(klienDari('10.0.0.2').create('ruang', opsi('tok-y', 'Y'))).resolves.toBeDefined();
  });

  it('tebakan kode yang tidak dikenal dibatasi per IP; setelah itu kode yang benar pun ditolak', async () => {
    const host = await klienDari('10.0.1.1').create('ruang', opsi('tok-a', 'Budi'));
    const penebak = klienDari('10.0.1.2');
    for (let i = 0; i < 4; i++) await expect(penebak.joinById(`ZZZZZ${i + 2}`, opsi('tok-t', 'Tebak'))).rejects.toThrow(/not found/);
    await expect(penebak.joinById('ZZZZZZ', opsi('tok-t', 'Tebak'))).rejects.toThrow(/batas-terlampaui/);
    await expect(penebak.joinById(host.roomId, opsi('tok-t', 'Tebak'))).rejects.toThrow(/batas-terlampaui/);
    // Bergabung ke kode yang benar tidak dihitung sebagai tebakan.
    const teman = klienDari('10.0.1.3');
    for (let i = 0; i < 6; i++) {
      const room = await teman.joinById(host.roomId, opsi('tok-b', 'Agus'));
      await room.leave();
    }
  });

  it('koneksi yang mengirim pesan terlalu cepat diputus', async () => {
    const room = await klienDari('10.0.2.1').create('ruang', opsi('tok-a', 'Budi'));
    let tutup: number | null = null;
    room.onLeave((code) => { tutup = code; });
    for (let i = 0; i < 20; i++) room.send('pilihKursi', { kursi: (i % 3) + 1 });
    const mulai = Date.now();
    while (tutup === null && Date.now() - mulai < 5000) await new Promise((r) => setTimeout(r, 10));
    expect(tutup).not.toBeNull();
  });

  it('endpoint kesehatan melaporkan jumlah ruang aktif', async () => {
    expect(await kesehatan()).toEqual({ ruangAktif: 0 });
    const klien = klienDari('10.0.3.1');
    await klien.create('ruang', opsi('tok-a', 'Budi'));
    await klien.create('ruang', opsi('tok-b', 'Agus'));
    expect(await kesehatan()).toEqual({ ruangAktif: 2 });
  });
});
