import { Client, type Room } from '@colyseus/sdk';
import type { GameConfig, Move, Seat } from '@gaple/aturan';
import {
  KODE_TUTUP_DIGANTIKAN, PANJANG_NAMA_MAKS, TARGET_POIN_MAKS, VERSI_PROTOKOL, type AlasanTolak, type Fase, type KursiLobi, type Pesan,
} from '@gaple/ruang';

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

export const PESAN_NAMA_TIDAK_SAH = `Nama panggilan harus 1–${PANJANG_NAMA_MAKS} karakter.`;

const PESAN_TOLAK: Partial<Record<AlasanTolak, string>> = {
  'perlu-pembaruan': 'Versi aplikasi perlu diperbarui. Muat ulang halaman.',
  'nama-tidak-sah': PESAN_NAMA_TIDAK_SAH,
  'nama-dipakai': 'Nama panggilan sudah dipakai di ruang ini. Pilih nama lain.',
  'ruang-penuh': 'Ruang sudah penuh.',
  'game-berjalan': 'Game sedang berjalan. Coba lagi setelah game selesai.',
  'bukan-host': 'Hanya host yang bisa melakukan itu.',
  'kursi-terisi': 'Kursi itu sudah diisi pemain lain.',
  'kursi-kosong': 'Kursi itu sudah kosong.',
  'kursi-host': 'Host tidak bisa mengosongkan kursinya sendiri.',
  'konfigurasi-tidak-sah': `Target poin harus bilangan bulat 1–${TARGET_POIN_MAKS}.`,
  'diambil-alih': 'Bot sedang memainkan kursimu. Ambil kendali dulu.',
};

export const PESAN_KODE_TIDAK_ADA = 'Kode ruang tidak ditemukan. Minta tautan atau kode baru ke host.';

/** Alasan penolakan masuk ruang dari server, atau `null` jika gagal karena hal lain. */
export function alasanGagal(err: unknown): AlasanTolak | null {
  const alasan = err instanceof Error ? err.message : '';
  return alasan in PESAN_TOLAK ? alasan as AlasanTolak : null;
}

/** Pesan yang bisa ditampilkan untuk kegagalan masuk ruang atau perintah yang ditolak. */
export function pesanGagal(err: unknown): string {
  const alasan = alasanGagal(err);
  if (alasan) return PESAN_TOLAK[alasan]!;
  // Colyseus: MATCHMAKE_INVALID_ROOM_ID (kode tidak ada atau ruang sudah dihapus).
  if (err instanceof Error && ((err as { code?: number }).code === 522 || /room ".*" (not found|has been disposed)/.test(err.message))) {
    return PESAN_KODE_TIDAK_ADA;
  }
  return 'Tidak bisa tersambung ke server. Periksa koneksi internet.';
}

export const pesanTolak = (alasan: AlasanTolak) => PESAN_TOLAK[alasan] ?? null;

/** Tautan ruang yang bisa dibagikan. */
export const tautanRuang = (kode: string) => `${location.origin}${import.meta.env.BASE_URL}r/${kode}`;

/**
 * Keadaan koneksi ke ruang:
 * - `tersambung`: normal;
 * - `menyambung`: koneksi putus tanpa disengaja, sedang mencoba lagi dengan token yang sama;
 * - `digantikan`: token yang sama membuka ruang ini di tab lain;
 * - `hilang`: ruang sudah tidak ada atau tidak lagi mengenali token ini.
 */
export type StatusSambungan = 'tersambung' | 'menyambung' | 'digantikan' | 'hilang';

/** Jeda sebelum percobaan sambung ulang ke-n (ms). */
const jedaSambungUlang = (n: number) => Math.min(500 * 2 ** n, 10_000);

/**
 * Koneksi ke satu ruang yang bertahan melewati putus sambung. Identitas tetap token pemain,
 * jadi menyambung ulang cukup bergabung lagi dengan token yang sama; ruang langsung mengirim
 * snapshot. Pendengar dipasang segera setelah bergabung supaya snapshot pertama tidak hilang
 * sebelum komponen React terpasang.
 */
export class SambunganRuang {
  private antrean: Pesan[] = [];
  private pendengar: ((pesan: Pesan) => void) | null = null;
  private pendengarLobi = new Set<() => void>();
  private pendengarTolak = new Set<(alasan: AlasanTolak) => void>();
  private pendengarStatus = new Set<() => void>();
  private lobi: LobiKlien | null = null;
  private status: StatusSambungan = 'tersambung';
  private selesai = false;
  private timerUlang: ReturnType<typeof setTimeout> | undefined;
  readonly kode: string;

  constructor(private room: Room) {
    /** Kode undangan = roomId. */
    this.kode = room.roomId;
    this.ikat(room);
  }

  private ikat(room: Room) {
    this.room = room;
    // Sambung ulang milik SDK memakai allowReconnection, yang tidak dipakai server; ruang ini menyambung sendiri.
    room.reconnection.enabled = false;
    room.onMessage('pesan', (pesan: Pesan) => {
      if (pesan.jenis === 'ditolak') for (const fn of this.pendengarTolak) fn(pesan.alasan);
      if (this.pendengar) this.pendengar(pesan);
      else this.antrean.push(pesan);
    });
    room.onStateChange((state: { toJSON(): LobiKlien }) => {
      this.lobi = state.toJSON();
      for (const fn of this.pendengarLobi) fn();
    });
    room.onLeave((code: number) => {
      if (this.selesai || room !== this.room) return;
      if (code === KODE_TUTUP_DIGANTIKAN) this.ubahStatus('digantikan');
      else this.sambungUlang();
    });
  }

  private ubahStatus(status: StatusSambungan) {
    this.status = status;
    for (const fn of this.pendengarStatus) fn();
  }

  /** Bergabung lagi dengan token yang sama, dengan jeda yang makin panjang sampai berhasil. */
  sambungUlang = (percobaan = 0) => {
    if (this.selesai) return;
    clearTimeout(this.timerUlang);
    this.ubahStatus('menyambung');
    this.timerUlang = setTimeout(async () => {
      try {
        const room = await gabung(this.kode, '');
        if (this.selesai) {
          void room.leave();
          return;
        }
        this.ikat(room);
        this.ubahStatus('tersambung');
      } catch (err) {
        if (this.selesai) return;
        // Ruang sudah dihapus atau tidak lagi mengenali token (misalnya dikeluarkan): berhenti mencoba.
        if (alasanGagal(err) || pesanGagal(err) === PESAN_KODE_TIDAK_ADA) this.ubahStatus('hilang');
        else this.sambungUlang(percobaan + 1);
      }
    }, percobaan === 0 ? 0 : jedaSambungUlang(percobaan));
  };

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

  dengarStatus = (fn: () => void): (() => void) => {
    this.pendengarStatus.add(fn);
    return () => this.pendengarStatus.delete(fn);
  };

  statusSekarang = (): StatusSambungan => this.status;

  /** Penolakan perintah dari server (hanya untuk pengirimnya). */
  dengarTolak(fn: (alasan: AlasanTolak) => void): () => void {
    this.pendengarTolak.add(fn);
    return () => this.pendengarTolak.delete(fn);
  }

  pilihKursi(kursi: Seat) { this.room.send('pilihKursi', { kursi }); }

  pindahkan(dari: Seat, ke: Seat) { this.room.send('pindahkan', { dari, ke }); }

  kosongkan(kursi: Seat) { this.room.send('kosongkan', { kursi }); }

  aturKonfigurasi(config: GameConfig) {
    this.room.send('aturKonfigurasi', { targetPoin: config.targetPoints, balakGanda: config.doubleBalak });
  }

  mulai() { this.room.send('mulai'); }

  pasang(move: Move) { this.room.send('pasang', { cardId: move.cardId, end: move.end }); }

  ambilKendali() { this.room.send('ambilKendali'); }

  /** Keluar ruang: di luar game melepas kursi dan nama; saat game berjalan sama dengan Terputus. */
  keluar() {
    if (this.status === 'tersambung') this.room.send('keluar');
    else if (this.status === 'menyambung') {
      // Koneksi sedang putus: sambung sebentar hanya untuk melepas kursi.
      void gabung(this.kode, '').then((room) => { room.send('keluar'); void room.leave(); }, () => {});
    }
    this.tutup();
  }

  /** Menutup koneksi tanpa melepas kursi; pemain tetap bisa kembali lewat tautan. */
  tutup() {
    if (this.selesai) return;
    this.selesai = true;
    clearTimeout(this.timerUlang);
    void this.room.leave();
  }
}

const gabung = (kode: string, nama: string) =>
  new Client(alamatServer()).joinById(kode, { token: tokenPemain(), nama, versi: VERSI_PROTOKOL });

export async function sambungRuangBaru(nama: string): Promise<SambunganRuang> {
  const room = await new Client(alamatServer()).create('ruang', { token: tokenPemain(), nama, versi: VERSI_PROTOKOL });
  tulis(KUNCI_NAMA, nama.trim());
  return new SambunganRuang(room);
}

/**
 * Bergabung ke ruang lewat kode undangan yang sudah dinormalisasi. Token yang dikenal ruang
 * langsung kembali ke tempatnya, jadi `nama` boleh kosong untuk percobaan pertama.
 */
export async function sambungRuang(kode: string, nama: string): Promise<SambunganRuang> {
  const room = await gabung(kode, nama);
  if (nama.trim()) tulis(KUNCI_NAMA, nama.trim());
  return new SambunganRuang(room);
}
