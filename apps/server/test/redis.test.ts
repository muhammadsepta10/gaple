import { execFileSync } from 'node:child_process';
import type { SeatView } from '@gaple/aturan';
import { Client } from '@colyseus/sdk';
import { VERSI_PROTOKOL, buatRuang, terapkan, type Pandangan } from '@gaple/ruang';
import { Redis } from 'ioredis';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MASA_BEKAS, penyimpananRedis } from '../src/penyimpanan';
import { buatServer, type KonfigServer } from '../src/server';
import { mainOtomatis, opsi, rekam, tunggu, type Pemain } from './bantu';

/**
 * Tes integrasi dengan Redis sungguhan: `REDIS_URL` jika diisi, selain itu container Docker
 * sementara dengan AOF seperti produksi.
 */
const PORT = 2610;
const SKALA = 100;

let redisUrl: string;
let hentikanRedis = () => {};
let redis: Redis;

beforeAll(() => {
  if (process.env.REDIS_URL) {
    redisUrl = process.env.REDIS_URL;
  } else {
    const id = execFileSync('docker', [
      'run', '-d', '--rm', '-p', '127.0.0.1::6379', 'redis:7-alpine', 'redis-server', '--appendonly', 'yes', '--appendfsync', 'everysec',
    ], { encoding: 'utf8' }).trim();
    hentikanRedis = () => execFileSync('docker', ['rm', '-f', id], { stdio: 'ignore' });
    const port = execFileSync('docker', ['port', id, '6379/tcp'], { encoding: 'utf8' }).trim().split('\n')[0]!.split(':').at(-1);
    redisUrl = `redis://127.0.0.1:${port}`;
  }
  redis = new Redis(redisUrl);
}, 120_000);

afterAll(async () => {
  await redis.quit();
  hentikanRedis();
});

/** Awalan key unik per tes, supaya ruang dari tes lain tidak ikut dipulihkan. */
const awalanBaru = () => `gaple-tes:${crypto.randomUUID()}:`;

/** Waktu ruang yang sama untuk server lama dan baru; `lompat` mensimulasikan server mati lama. */
const awal = Date.now();
let lompat = 0;
const jam = () => awal + (Date.now() - awal) * SKALA + lompat;

const nyala: ReturnType<typeof buatServer>[] = [];

async function nyalakan(awalan: string, konfig: KonfigServer = {}) {
  const server = buatServer({
    skala: SKALA, jam, penyimpanan: penyimpananRedis(redisUrl, awalan), batas: { buatRuangPerJam: 1000, pesanPerDetik: Infinity }, ...konfig,
  });
  await server.listen(PORT);
  nyala.push(server);
  return server;
}

async function matikan(server: ReturnType<typeof buatServer>) {
  nyala.splice(nyala.indexOf(server), 1);
  await server.gracefullyShutdown(false);
}

afterEach(async () => {
  for (const server of [...nyala]) await matikan(server);
});

const sdk = new Client(`ws://127.0.0.1:${PORT}`);

/** Klien tes tidak memakai sambung ulang bawaan SDK (server tidak memakai allowReconnection). */
const tanpaSambungUlang = (p: Pemain) => {
  p.room.reconnection.enabled = false;
  return p;
};

function pandanganTerakhir(p: Pemain): Pandangan | null {
  for (let i = p.pesan.length - 1; i >= 0; i--) {
    const pesan = p.pesan[i]!;
    if (pesan.jenis !== 'ditolak') return pesan.pandangan;
  }
  return null;
}

describe('server: keandalan dengan Redis', () => {
  it('restart di tengah ronde: klien kembali ke kursi dan kartu yang sama, waktu henti tidak dihitung, game berlanjut', async () => {
    const awalan = awalanBaru();
    const s1 = await nyalakan(awalan);
    const a = tanpaSambungUlang(rekam(await sdk.create('ruang', opsi('tok-a', 'Budi'))));
    const b = tanpaSambungUlang(rekam(await sdk.joinById(a.room.roomId, opsi('tok-b', 'Agus'))));
    const kode = a.room.roomId;
    a.room.send('aturKonfigurasi', { targetPoin: 10_000, balakGanda: false });
    a.room.send('mulai');
    // Tunggu sampai giliran manusia terbuka: sejak itu tenggat ambil alih bot 5 menit berjalan.
    await tunggu(() => {
      const v = pandanganTerakhir(a) as SeatView | null;
      return !!v && (v.turn === 0 || v.turn === 1) && !v.sessionResult;
    });
    await new Promise((r) => setTimeout(r, 50));
    const sebelum = { a: pandanganTerakhir(a), b: pandanganTerakhir(b) };
    expect(await redis.exists(`${awalan}ruang:${kode}`)).toBe(1);

    await matikan(s1);
    // Server mati 30 menit: tanpa geseran, ambil alih bot dan hapus ruang sudah lewat.
    lompat += 30 * 60_000;
    await nyalakan(awalan);
    expect(await (await fetch(`http://127.0.0.1:${PORT}/kesehatan`)).json()).toEqual({ ruangAktif: 1 });

    const a2 = rekam(await sdk.joinById(kode, opsi('tok-a', '')));
    const b2 = rekam(await sdk.joinById(kode, opsi('tok-b', '')));
    mainOtomatis(a2, SKALA);
    mainOtomatis(b2, SKALA);
    await tunggu(() => a2.pesan.length > 0 && b2.pesan.length > 0 && a2.lobi.length > 0);
    expect(a2.pesan[0]).toMatchObject({ jenis: 'snapshot', kursi: 0, pandangan: sebelum.a });
    expect(b2.pesan[0]).toMatchObject({ jenis: 'snapshot', kursi: 1, pandangan: sebelum.b });
    expect(a2.room.state.kursi.map((k: { jenis: string; diambilAlih: boolean }) => [k.jenis, k.diambilAlih])).toEqual([
      ['manusia', false], ['manusia', false], ['bot', false], ['bot', false],
    ]);

    // Game berlanjut: manusia memasang kartu setelah restart.
    await tunggu(() => a2.pesan.some((p) => p.jenis === 'transisi' && p.events.some((e) => e.type === 'cardPlaced' && e.seat <= 1)));

    await expect(sdk.joinById(kode, { ...opsi('tok-c', 'Sari'), versi: VERSI_PROTOKOL - 1 })).rejects.toThrow(/perlu-pembaruan/);
  }, 60_000);

  it('ruang tanpa pemain tersambung dihapus; kodenya ditandai bekas, ditolak jelas, dan tidak dipakai ulang', async () => {
    const awalan = awalanBaru();
    // Kode acak: AAAAAA, lalu AAAAAA lagi (bentrok dengan kode bekas), lalu BBBBBB.
    const urutan = [...Array<number>(12).fill(0), ...Array<number>(6).fill(1.5 / 31)];
    let i = 0;
    const konfig: KonfigServer = { skala: 1000, jam: undefined, acakKode: () => urutan[i++ % urutan.length]! };
    const s1 = await nyalakan(awalan, konfig);
    const a = rekam(await sdk.create('ruang', opsi('tok-a', 'Budi')));
    expect(a.room.roomId).toBe('AAAAAA');
    await a.room.leave();

    // 10 menit waktu ruang = 600 ms pada skala 1000.
    await tunggu(async () => (await redis.exists(`${awalan}bekas:AAAAAA`)) === 1);
    expect(await redis.exists(`${awalan}ruang:AAAAAA`)).toBe(0);
    expect(await redis.pttl(`${awalan}bekas:AAAAAA`)).toBeGreaterThan(MASA_BEKAS - 60_000);
    await expect(sdk.joinById('AAAAAA', opsi('tok-b', 'Agus'))).rejects.toThrow(/ruang-dihapus/);

    const b = rekam(await sdk.create('ruang', opsi('tok-b', 'Agus')));
    expect(b.room.roomId).toBe('BBBBBB');
    await tunggu(() => b.pesan.length > 0);

    // Penanda bekas bertahan melewati restart; ruang yang masih ada dipulihkan.
    await matikan(s1);
    await nyalakan(awalan, konfig);
    await expect(sdk.joinById('AAAAAA', opsi('tok-b', 'Agus'))).rejects.toThrow(/ruang-dihapus/);
    const b2 = rekam(await sdk.joinById('BBBBBB', opsi('tok-b', '')));
    await tunggu(() => b2.pesan.length > 0);
    expect(b2.pesan[0]).toMatchObject({ jenis: 'snapshot', kursi: 0 });
  }, 60_000);

  it('setelah crash, waktu henti dihitung dari tanda hidup terakhir server, bukan dari perubahan terakhir ruang', async () => {
    const awalan = awalanBaru();
    const t0 = jam();
    // Lobi tanpa pemain tersambung sejak t0: tenggat hapus ruang 10 menit, snapshot terakhir pada t0.
    const benih = () => 1;
    const masuk = terapkan(buatRuang('HNTK22'), { jenis: 'masuk', token: 'tok-a', nama: 'Budi', versi: VERSI_PROTOKOL }, t0, benih).state;
    const state = terapkan(masuk, { jenis: 'terputus', token: 'tok-a' }, t0, benih).state;
    expect(state.hapusPada).toBe(t0 + 10 * 60_000);
    const lama = penyimpananRedis(redisUrl, awalan);
    lama.simpan({ state, disimpanPada: t0 });
    // Server masih hidup 9 menit tanpa perubahan ruang, lalu crash dan mati 1 jam.
    lama.detak(t0 + 9 * 60_000);
    await lama.tutup();
    lompat += 60 * 60_000;

    await nyalakan(awalan);
    // Sisa 1 menit waktu ruang = 600 ms pada skala 100 (bukan 10 menit = 6 detik).
    await tunggu(async () => (await redis.exists(`${awalan}bekas:HNTK22`)) === 1, 3000);
  }, 30_000);
});
