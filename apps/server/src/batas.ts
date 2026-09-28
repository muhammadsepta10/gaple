import { ErrorCode, ServerError, matchMaker, type AuthContext } from '@colyseus/core';
import type { AlasanTolak } from '@gaple/ruang';

/** Batas penyalahgunaan server. Angka awal; bisa diatur lewat konfigurasi server. */
export type BatasServer = {
  /** Pembuatan ruang per IP per jam. */
  readonly buatRuangPerJam: number;
  /** Bergabung ke kode yang tidak dikenal per IP per menit; setelah itu semua bergabung lewat kode dari IP itu ditolak. */
  readonly kodeTakDikenalPerMenit: number;
  /** Pesan per detik per koneksi; koneksi yang melanggar diputus. */
  readonly pesanPerDetik: number;
};

export const BATAS_AWAL: BatasServer = { buatRuangPerJam: 5, kodeTakDikenalPerMenit: 20, pesanPerDetik: 10 };

/** Jendela geser: paling banyak `maks` kejadian per kunci dalam `jendela` ms terakhir. */
export class PenghitungLaju {
  private kejadian = new Map<string, number[]>();

  constructor(private readonly maks: number, private readonly jendela: number) {}

  private terbaru(kunci: string, sekarang: number): number[] {
    const semua = (this.kejadian.get(kunci) ?? []).filter((t) => t > sekarang - this.jendela);
    if (semua.length) this.kejadian.set(kunci, semua);
    else this.kejadian.delete(kunci);
    return semua;
  }

  /** Kunci ini sudah mencapai batas dalam jendela sekarang. */
  penuh(kunci: string, sekarang: number): boolean {
    return this.terbaru(kunci, sekarang).length >= this.maks;
  }

  catat(kunci: string, sekarang: number) {
    // Buang kunci yang sudah kedaluwarsa sesekali, supaya IP yang tidak kembali tidak menumpuk.
    if (this.kejadian.size > 10_000) for (const k of [...this.kejadian.keys()]) this.terbaru(k, sekarang);
    this.kejadian.set(kunci, [...this.terbaru(kunci, sekarang), sekarang]);
  }
}

/**
 * IP klien dari hop terakhir X-Forwarded-For, yaitu yang ditulis Caddy (Caddy tidak mempercayai
 * X-Forwarded-For kiriman klien). X-Real-IP dan hop lain bisa diisi klien sendiri, jadi diabaikan.
 * Tanpa proxy (dev) semua permintaan berbagi satu kunci.
 */
function ipKlien(auth: AuthContext | undefined): string {
  return auth?.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'tanpa-ip';
}

const BATAS_TERLAMPAUI: AlasanTolak = 'batas-terlampaui';

const invokeAsli = matchMaker.controller.invokeMethod;

/**
 * Membatasi matchmaking per IP: pembuatan ruang, dan bergabung ke kode yang tidak dikenal (tebakan
 * kode). Colyseus tidak punya kait untuk kode yang tidak ditemukan, jadi pemanggil matchmaking
 * global dibungkus. Server berjalan satu per proses: pemanggilan berikutnya mengganti pembungkus
 * dan batas sebelumnya, tidak menumpuk.
 */
export function pasangBatasMatchmaking(batas: BatasServer) {
  const buat = new PenghitungLaju(batas.buatRuangPerJam, 60 * 60_000);
  const tebak = new PenghitungLaju(batas.kodeTakDikenalPerMenit, 60_000);
  const ditolak = () => new ServerError(ErrorCode.MATCHMAKE_UNHANDLED, BATAS_TERLAMPAUI);
  matchMaker.controller.invokeMethod = async function (method: string, roomName: string, opsi: unknown, auth?: AuthContext) {
    const ip = ipKlien(auth);
    const sekarang = Date.now();
    if (method === 'create' && buat.penuh(ip, sekarang)) throw ditolak();
    // Setelah terlalu banyak tebakan, kode yang benar pun ditolak supaya tebakan tidak bisa diteruskan.
    if (method === 'joinById' && tebak.penuh(ip, sekarang)) throw ditolak();
    try {
      const hasil = await invokeAsli.call(this, method, roomName, opsi, auth);
      if (method === 'create') buat.catat(ip, sekarang);
      return hasil;
    } catch (err) {
      if (method === 'joinById' && (err as { code?: number }).code === ErrorCode.MATCHMAKE_INVALID_ROOM_ID) tebak.catat(ip, sekarang);
      throw err;
    }
  };
}
