import { penyimpananRedis } from './penyimpanan';
import { buatServer } from './server';

const port = Number(process.env.PORT ?? 2567);
const redisUrl = process.env.REDIS_URL;

// Tanpa REDIS_URL (pengembangan) ruang hanya hidup di memori dan hilang saat restart.
const redis = redisUrl ? penyimpananRedis(redisUrl) : undefined;
if (redis) {
  // AOF wajib (ADR 0003): tanpa itu restart Redis bisa menghapus semua ruang.
  const aof = await redis.periksaAof();
  if (aof.hasil === 'salah') throw new Error(`gaple: Redis ${aof.rincian}; wajib appendonly yes + appendfsync everysec`);
  if (aof.hasil === 'tidak-terbaca') console.warn('gaple: konfigurasi AOF Redis tidak bisa dibaca; pastikan appendonly yes + appendfsync everysec');
} else {
  console.warn('gaple: REDIS_URL tidak diisi; ruang disimpan di memori dan hilang saat restart');
}

// WEB_DIR (produksi): folder build aplikasi web, disajikan dari origin yang sama.
await buatServer({ penyimpanan: redis, web: process.env.WEB_DIR }).listen(port);
console.log(`gaple server: port ${port}`);
