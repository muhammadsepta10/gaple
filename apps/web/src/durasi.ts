/** Semua durasi (ms) di satu tempat agar mudah disetel. */
export const DURASI = {
  botBerpikir: 770,
  /** Periode denyut penanda giliran dan target ujung (ms per radian). */
  denyutGiliran: 180,
  denyutUjung: 150,
  /** Ringkasan sesi tampil, lalu sesi berikutnya dimulai otomatis. */
  ringkasanSesi: 5000,
  /** Pemberitahuan pembagian ulang (≥5 balak). */
  notifikasiBagiUlang: 2200,
} as const;
