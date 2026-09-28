import type { StateRuang } from '@gaple/ruang';
import { Redis } from 'ioredis';

/** Snapshot satu ruang: state apa adanya dan waktu ruang saat disimpan. */
export type SnapshotRuang = { readonly state: StateRuang; readonly disimpanPada: number };

/** Penyimpanan ruang yang bertahan melewati restart server. */
export interface Penyimpanan {
  /** Menulis ulang snapshot ruang. Tulisan untuk satu ruang tiba sesuai urutan panggilan. */
  simpan(snapshot: SnapshotRuang): void;
  /** Menghapus ruang dan menandai kodenya "bekas" supaya tidak dipakai ruang lain. */
  hapus(kode: string): Promise<void>;
  /** Semua snapshot ruang yang tersimpan, untuk dipulihkan saat boot. */
  semua(): Promise<SnapshotRuang[]>;
  /** Kode sedang dipakai ruang tersimpan, atau bekas ruang yang sudah dihapus. */
  dipakai(kode: string): Promise<boolean>;
  /** Kode milik ruang yang sudah dihapus. */
  bekas(kode: string): Promise<boolean>;
  /** Mencatat bahwa server masih hidup pada waktu ruang `pada`. */
  detak(pada: number): void;
  /**
   * Detak terakhir server sebelumnya, `null` jika belum pernah. Setelah crash, inilah awal waktu
   * henti: snapshot hanya ditulis saat state berubah, jadi waktu simpannya bisa jauh lebih awal.
   */
  detakTerakhir(): Promise<number | null>;
  /** Menunggu semua tulisan selesai lalu menutup koneksi. */
  tutup(): Promise<void>;
}

/**
 * Jaring pengaman saja: penghapusan sebenarnya digerakkan tenggat hapus ruang, karena TTL Redis
 * tetap berjalan saat server mati.
 */
export const TTL_RUANG = 24 * 60 * 60_000;
/** Lama kode ruang yang dihapus ditandai "bekas". */
export const MASA_BEKAS = 30 * 24 * 60 * 60_000;

/**
 * Satu key JSON per ruang (`<awalan>ruang:<kode>`) dan penanda `<awalan>bekas:<kode>`. Redis
 * wajib `appendonly yes` + `appendfsync everysec` (lihat `periksaAof`).
 */
export function penyimpananRedis(url: string, awalan = 'gaple:') {
  const redis = new Redis(url);
  const kunciRuang = (kode: string) => `${awalan}ruang:${kode}`;
  const kunciBekas = (kode: string) => `${awalan}bekas:${kode}`;
  const kunciDetak = `${awalan}detak`;
  const tertunda = new Set<Promise<unknown>>();
  const lacak = <T>(janji: Promise<T>) => {
    tertunda.add(janji);
    void janji.catch((err) => console.error('gaple: gagal menulis ke Redis', err)).finally(() => tertunda.delete(janji));
    return janji;
  };

  const penyimpanan: Penyimpanan = {
    simpan(snapshot) {
      void lacak(redis.set(kunciRuang(snapshot.state.kode), JSON.stringify(snapshot), 'PX', TTL_RUANG));
    },
    async hapus(kode) {
      await lacak(redis.multi().del(kunciRuang(kode)).set(kunciBekas(kode), '1', 'PX', MASA_BEKAS).exec());
    },
    async semua() {
      const kunci: string[] = [];
      let kursor = '0';
      do {
        const [lanjut, hasil] = await redis.scan(kursor, 'MATCH', `${awalan}ruang:*`, 'COUNT', 200);
        kursor = lanjut;
        kunci.push(...hasil);
      } while (kursor !== '0');
      if (!kunci.length) return [];
      const isi = await redis.mget(kunci);
      return isi.flatMap((teks, i) => {
        if (!teks) return [];
        try {
          return [JSON.parse(teks) as SnapshotRuang];
        } catch {
          console.error(`gaple: snapshot rusak di ${kunci[i]}, dilewati`);
          return [];
        }
      });
    },
    async dipakai(kode) {
      return (await redis.exists(kunciRuang(kode), kunciBekas(kode))) > 0;
    },
    async bekas(kode) {
      return (await redis.exists(kunciBekas(kode))) > 0;
    },
    detak(pada) {
      void lacak(redis.set(kunciDetak, String(pada)));
    },
    async detakTerakhir() {
      const teks = await redis.get(kunciDetak);
      return teks === null ? null : Number(teks);
    },
    async tutup() {
      await Promise.allSettled([...tertunda]);
      await redis.quit();
    },
  };
  return {
    ...penyimpanan,
    /**
     * Memeriksa AOF Redis: `sesuai`, `salah` (bukan `appendonly yes` + `appendfsync everysec`),
     * atau `tidak-terbaca` (misalnya CONFIG dinonaktifkan penyedia Redis).
     */
    async periksaAof() {
      try {
        const [, aof] = (await redis.config('GET', 'appendonly')) as string[];
        const [, fsync] = (await redis.config('GET', 'appendfsync')) as string[];
        if (aof === 'yes' && fsync === 'everysec') return { hasil: 'sesuai' } as const;
        return { hasil: 'salah', rincian: `appendonly=${aof} appendfsync=${fsync}` } as const;
      } catch {
        return { hasil: 'tidak-terbaca' } as const;
      }
    },
  };
}

/** Penyimpanan di memori proses: untuk pengembangan dan tes tanpa Redis. Tidak selamat dari restart proses. */
export function penyimpananMemori(): Penyimpanan {
  const ruang = new Map<string, string>();
  const bekas = new Set<string>();
  let detak: number | null = null;
  return {
    simpan(snapshot) { ruang.set(snapshot.state.kode, JSON.stringify(snapshot)); },
    async hapus(kode) {
      ruang.delete(kode);
      bekas.add(kode);
    },
    async semua() { return [...ruang.values()].map((teks) => JSON.parse(teks) as SnapshotRuang); },
    async dipakai(kode) { return ruang.has(kode) || bekas.has(kode); },
    async bekas(kode) { return bekas.has(kode); },
    detak(pada) { detak = pada; },
    async detakTerakhir() { return detak; },
    async tutup() {},
  };
}
