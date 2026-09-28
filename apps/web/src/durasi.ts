/** Semua durasi (ms) di satu tempat agar mudah disetel. */
const KARTU_TERBANG = 476;
const JEDA_BAGI = 28;
export const DURASI = {
  kartuTerbang: KARTU_TERBANG,
  jedaBagi: JEDA_BAGI,
  /** 28 ketukan bagi + waktu terbang, total 1,26 detik. */
  bagiTotal: 28 * JEDA_BAGI + KARTU_TERBANG,
  pass: 1260,
  balak: 1820,
  menangSesi: 2520,
  gaplek: 2380,
  juara: 2770,
  getarBalak: 308,
  getarGaplek: 630,
  kacaUlang: 95,
  juaraPowerKedua: 340,
  juaraChip: 730,
  klikBagi: 25,
  nadaFanfareJarak: 160,
  nadaFanfare: 220,
  nadaFanfareAkhir: 480,
  botBerpikir: 770,
  /** Periode denyut penanda giliran dan target ujung (ms per radian). */
  denyutGiliran: 180,
  denyutUjung: 150,
  /** Ringkasan sesi tampil, lalu sesi berikutnya dimulai otomatis. */
  ringkasanSesi: 5000,
  /** Pemberitahuan pembagian ulang (≥5 balak). */
  notifikasiBagiUlang: 2200,
} as const;
