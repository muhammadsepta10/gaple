import { Client, type Room } from '@colyseus/sdk';
import type { Move } from '@gaple/aturan';
import { VERSI_PROTOKOL, type AlasanTolak, type Fase, type KursiLobi, type Pesan } from '@gaple/ruang';

/** Proyeksi lobi publik dari Schema. */
export type LobiKlien = {
  readonly fase: Fase;
  readonly kursi: readonly KursiLobi[];
  /** -1 jika ruang tanpa host. */
  readonly hostKursi: number;
  readonly targetPoin: number;
  readonly balakGanda: boolean;
};

const KUNCI_TOKEN = 'gaple.token';
const KUNCI_NAMA = 'gaple.nama';

function baca(kunci: string): string | null {
  try { return localStorage.getItem(kunci); } catch { return null; }
}

function tulis(kunci: string, nilai: string) {
  try { localStorage.setItem(kunci, nilai); } catch { /* tanpa storage: hanya hidup selama tab terbuka */ }
}

let tokenTab: string | null = null;

/** Token pemain dibuat sekali per browser; identitas di ruang, bukan sessionId koneksi. */
export function tokenPemain(): string {
  tokenTab ??= baca(KUNCI_TOKEN);
  if (!tokenTab) {
    tokenTab = crypto.randomUUID();
    tulis(KUNCI_TOKEN, tokenTab);
  }
  return tokenTab;
}

export const namaTerakhir = () => baca(KUNCI_NAMA) ?? '';

function alamatServer(): string {
  const env = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (env) return env;
  return import.meta.env.DEV ? `${location.protocol}//${location.hostname}:2567` : location.origin;
}

const PESAN_TOLAK: Partial<Record<AlasanTolak, string>> = {
  'perlu-pembaruan': 'Versi aplikasi perlu diperbarui. Muat ulang halaman.',
  'nama-tidak-sah': 'Nama panggilan harus 1–12 karakter.',
  'nama-dipakai': 'Nama panggilan sudah dipakai di ruang ini.',
  'ruang-penuh': 'Ruang sudah penuh.',
  'game-berjalan': 'Game sedang berjalan.',
};

/** Pesan yang bisa ditampilkan untuk kegagalan masuk ruang. */
export function pesanGagal(err: unknown): string {
  const alasan = err instanceof Error ? err.message : '';
  return PESAN_TOLAK[alasan as AlasanTolak] ?? 'Tidak bisa tersambung ke server. Periksa koneksi internet.';
}

/**
 * Satu koneksi ke ruang. Pendengar dipasang segera setelah bergabung supaya snapshot
 * pertama tidak hilang sebelum komponen React terpasang.
 */
export class SambunganRuang {
  private antrean: Pesan[] = [];
  private pendengar: ((pesan: Pesan) => void) | null = null;
  private pendengarLobi = new Set<() => void>();
  private lobi: LobiKlien | null = null;

  constructor(private readonly room: Room) {
    room.onMessage('pesan', (pesan: Pesan) => {
      if (this.pendengar) this.pendengar(pesan);
      else this.antrean.push(pesan);
    });
    room.onStateChange((state: { toJSON(): LobiKlien }) => {
      this.lobi = state.toJSON();
      for (const fn of this.pendengarLobi) fn();
    });
  }

  dengarPesan(fn: (pesan: Pesan) => void): () => void {
    this.pendengar = fn;
    for (const pesan of this.antrean.splice(0)) fn(pesan);
    return () => { if (this.pendengar === fn) this.pendengar = null; };
  }

  dengarLobi = (fn: () => void): (() => void) => {
    this.pendengarLobi.add(fn);
    return () => this.pendengarLobi.delete(fn);
  };

  lobiSekarang = (): LobiKlien | null => this.lobi;

  mulai() { this.room.send('mulai'); }

  pasang(move: Move) { this.room.send('pasang', { cardId: move.cardId, end: move.end }); }

  keluar() { void this.room.leave(); }
}

export async function sambungRuangBaru(nama: string): Promise<SambunganRuang> {
  const room = await new Client(alamatServer()).create('ruang', { token: tokenPemain(), nama, versi: VERSI_PROTOKOL });
  tulis(KUNCI_NAMA, nama.trim());
  return new SambunganRuang(room);
}
