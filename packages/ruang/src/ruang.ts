import {
  SEATS, applyMove, chooseMove, nextSession, seatView, seededRandom, startGame,
  type Card, type End, type GameConfig, type GameEvent, type GameState, type RejectReason, type Seat, type SeatView, type Transition,
} from '@gaple/aturan';
import { DURASI } from './durasi';
import { durasiJendela } from './tempo';

/** Naikkan hanya ketika bentuk perintah, pesan, atau event berubah. */
export const VERSI_PROTOKOL = 3;

/** Kode tutup koneksi lama saat token yang sama tersambung dari koneksi lain (tab kedua). */
export const KODE_TUTUP_DIGANTIKAN = 4201;

export const PANJANG_NAMA_MAKS = 12;
export const TARGET_POIN_MAKS = 10_000;

export type Fase = 'lobi' | 'bermain' | 'hasil';

/** Batas waktu tenggat ruang (ms). */
export const BATAS_WAKTU = {
  /** Sejak giliran manusia dimulai (akhir jendela presentasi) sampai bot mengambil alih kursinya. */
  ambilAlih: 5 * 60_000,
  /** Host yang Terputus selama ini di luar game digantikan. */
  pindahHost: 2 * 60_000,
  /** Ruang tanpa satu pun orang tersambung dihapus setelah ini. */
  hapusRuang: 10 * 60_000,
} as const;

export type Orang = { readonly nama: string; readonly kursi: Seat | null; readonly tersambung: boolean };

/** Tenggat alur presentasi: langkah bot atau ronde berikutnya. */
export type Tenggat = { readonly jenis: 'langkahBot' | 'rondeBerikutnya'; readonly pada: number };

/** State ruang: data biasa yang bisa diserialisasi apa adanya. */
export type StateRuang = {
  /** Kode undangan = roomId; ikut tersimpan di snapshot. */
  readonly kode: string;
  readonly fase: Fase;
  readonly config: GameConfig;
  /** Orang di ruang, dikunci token pemain. */
  readonly orang: Readonly<Record<string, Orang>>;
  /** Token pemilik tiap kursi; `null` = kosong. */
  readonly kursi: readonly (string | null)[];
  readonly botSejakAwal: readonly Seat[];
  readonly host: string | null;
  readonly game: GameState | null;
  /** Akhir jendela presentasi transisi terakhir (ms). */
  readonly jendelaSelesai: number;
  readonly tenggat: Tenggat | null;
  /** Kursi manusia yang sedang dimainkan bot; hanya bisa kembali ke pemilik tokennya. */
  readonly diambilAlih: readonly Seat[];
  /** Tenggat ambil alih bot untuk giliran manusia yang sedang berjalan. */
  readonly ambilAlih: { readonly kursi: Seat; readonly pada: number } | null;
  /** Tenggat pindah host karena host Terputus di luar game. */
  readonly pindahHostPada: number | null;
  /** Tenggat hapus ruang karena tidak ada orang tersambung. */
  readonly hapusPada: number | null;
};

export type Perintah =
  | { readonly jenis: 'masuk'; readonly token: string; readonly nama: string; readonly versi: number }
  | { readonly jenis: 'pilihKursi'; readonly token: string; readonly kursi: Seat }
  | { readonly jenis: 'pindahkan'; readonly token: string; readonly dari: Seat; readonly ke: Seat }
  | { readonly jenis: 'kosongkan'; readonly token: string; readonly kursi: Seat }
  | { readonly jenis: 'aturKonfigurasi'; readonly token: string; readonly config: GameConfig }
  | { readonly jenis: 'mulai'; readonly token: string }
  | { readonly jenis: 'pasang'; readonly token: string; readonly cardId: string; readonly end: End }
  /** Pemain tersambung yang kursinya diambil alih bot memegang kendali lagi. */
  | { readonly jenis: 'ambilKendali'; readonly token: string }
  /** Di luar game melepas kursi dan nama panggilan; saat game berjalan sama dengan Terputus. */
  | { readonly jenis: 'keluar'; readonly token: string }
  /** Dari adaptor: koneksi terakhir token ini tertutup. */
  | { readonly jenis: 'terputus'; readonly token: string };

export type AlasanTolak =
  | 'perlu-pembaruan'
  | 'nama-tidak-sah'
  | 'nama-dipakai'
  | 'ruang-penuh'
  | 'game-berjalan'
  | 'bukan-host'
  | 'bukan-pemain'
  | 'kursi-terisi'
  | 'kursi-kosong'
  /** Host tidak bisa mengosongkan kursinya sendiri. */
  | 'kursi-host'
  | 'konfigurasi-tidak-sah'
  | 'masih-presentasi'
  /** Kursi sedang dimainkan bot; ambil kendali dulu. */
  | 'diambil-alih'
  /** Bentuk pesan dari klien tidak dikenali (diperiksa adaptor). */
  | 'perintah-tidak-sah'
  | RejectReason;

/** `GameEvent` yang disensor untuk satu penerima: pembagian hanya memuat tangan si penerima. */
export type EventKlien =
  | {
      readonly type: 'dealt';
      readonly session: number;
      readonly redeal: boolean;
      /** Tangan penerima pada pembagian ini; `null` jika penerima tidak duduk. */
      readonly hand: readonly Card[] | null;
      readonly handCounts: readonly number[];
    }
  | Exclude<GameEvent, { type: 'dealt' }>;

export type Pesan =
  | { readonly jenis: 'snapshot'; readonly kursi: Seat | null; readonly pandangan: SeatView | null; readonly sisaPresentasi: number }
  | { readonly jenis: 'transisi'; readonly events: readonly EventKlien[]; readonly pandangan: SeatView; readonly sisaPresentasi: number }
  | { readonly jenis: 'ditolak'; readonly alasan: AlasanTolak };

export type PesanKeluar = { readonly untuk: string; readonly pesan: Pesan };

export type Hasil = {
  readonly state: StateRuang;
  readonly pesan: readonly PesanKeluar[];
  /** Waktu tenggat terdekat; `null` jika tidak ada yang perlu dijalankan tanpa perintah. */
  readonly tenggatBerikutnya: number | null;
  /** Tenggat hapus ruang sudah lewat: adaptor menutup ruang. */
  readonly hapus: boolean;
};

/** Menghasilkan seed bilangan bulat baru untuk setiap pembagian kartu. */
export type Benih = () => number;

export type KursiLobi = {
  readonly nama: string;
  readonly jenis: 'kosong' | 'manusia' | 'bot';
  /** Pemain manusia di kursi ini sedang Terputus. */
  readonly terputus: boolean;
  /** Kursi manusia ini sedang dimainkan bot pengganti. */
  readonly diambilAlih: boolean;
};

/** Proyeksi lobi publik untuk Schema: tanpa kartu dan tanpa token. */
export type LobiPublik = {
  readonly fase: Fase;
  readonly kursi: readonly KursiLobi[];
  readonly hostKursi: Seat | null;
  readonly config: GameConfig;
};

export function buatRuang(kode: string): StateRuang {
  return {
    kode,
    fase: 'lobi',
    config: { targetPoints: 100, doubleBalak: false },
    orang: {},
    kursi: [null, null, null, null],
    botSejakAwal: [],
    host: null,
    game: null,
    jendelaSelesai: 0,
    tenggat: null,
    diambilAlih: [],
    ambilAlih: null,
    pindahHostPada: null,
    hapusPada: null,
  };
}

type JenisTenggat = 'presentasi' | 'ambilAlih' | 'pindahHost' | 'hapusRuang';

function tenggatTerdekat(state: StateRuang): { jenis: JenisTenggat; pada: number } | null {
  const semua: [JenisTenggat, number | undefined][] = [
    ['presentasi', state.tenggat?.pada],
    ['ambilAlih', state.ambilAlih?.pada],
    ['pindahHost', state.pindahHostPada ?? undefined],
    ['hapusRuang', state.hapusPada ?? undefined],
  ];
  let terdekat: { jenis: JenisTenggat; pada: number } | null = null;
  for (const [jenis, pada] of semua) if (pada !== undefined && (!terdekat || pada < terdekat.pada)) terdekat = { jenis, pada };
  return terdekat;
}

const selesai = (state: StateRuang, pesan: readonly PesanKeluar[] = []): Hasil => ({
  state,
  pesan,
  tenggatBerikutnya: tenggatTerdekat(state)?.pada ?? null,
  hapus: false,
});

const tolak = (state: StateRuang, token: string, alasan: AlasanTolak): Hasil =>
  selesai(state, [{ untuk: token, pesan: { jenis: 'ditolak', alasan } }]);

const sisa = (state: StateRuang, sekarang: number) => Math.max(0, state.jendelaSelesai - sekarang);

const panjangGrafem = (teks: string) => [...new Intl.Segmenter().segment(teks)].length;

/** Nama panggilan yang dipangkas, atau `null` jika di luar 1–12 grafem (emoji dihitung satu). */
export function rapikanNama(nama: string): string | null {
  const rapi = nama.trim();
  const panjang = panjangGrafem(rapi);
  return panjang >= 1 && panjang <= PANJANG_NAMA_MAKS ? rapi : null;
}

export function terapkan(state: StateRuang, perintah: Perintah, sekarang: number, benih: Benih): Hasil {
  const hasil = jalankanPerintah(state, perintah, sekarang, benih);
  return hasil.state === state ? hasil : selesai(rapikan(hasil.state, sekarang), hasil.pesan);
}

function jalankanPerintah(state: StateRuang, perintah: Perintah, sekarang: number, benih: Benih): Hasil {
  switch (perintah.jenis) {
    case 'masuk': return masuk(state, perintah, sekarang);
    case 'pilihKursi': return pilihKursi(state, perintah, sekarang);
    case 'pindahkan': return pindahkan(state, perintah, sekarang);
    case 'kosongkan': return kosongkan(state, perintah, sekarang);
    case 'aturKonfigurasi': return aturKonfigurasi(state, perintah);
    case 'mulai': return mulai(state, perintah.token, sekarang, benih);
    case 'pasang': return pasang(state, perintah, sekarang);
    case 'ambilKendali': return ambilKendali(state, perintah.token, sekarang);
    case 'keluar': return keluar(state, perintah.token);
    case 'terputus': return selesai(putuskan(state, perintah.token));
  }
}

/** Memproses semua tenggat yang sudah lewat, masing-masing pada waktunya sendiri. */
export function jalankanTenggat(state: StateRuang, sekarang: number, benih: Benih): Hasil {
  const pesan: PesanKeluar[] = [];
  let current = state;
  for (let t = tenggatTerdekat(current); t && t.pada <= sekarang; t = tenggatTerdekat(current)) {
    const { pada } = t;
    switch (t.jenis) {
      case 'presentasi': {
        const game = current.game!;
        const langkah = current.tenggat!.jenis === 'rondeBerikutnya' ? nextSession(game, seededRandom(benih())) : langkahBot(game);
        current = transisi(current, langkah.state, langkah.events, pada);
        pesan.push(...pesanTransisi(current, langkah.events, sekarang));
        break;
      }
      case 'ambilAlih': {
        const { kursi } = current.ambilAlih!;
        current = {
          ...current,
          diambilAlih: [...current.diambilAlih, kursi],
          ambilAlih: null,
          tenggat: { jenis: 'langkahBot', pada: Math.max(pada, current.jendelaSelesai) + DURASI.botBerpikir },
        };
        break;
      }
      case 'pindahHost': {
        const lama = current.host ? current.orang[current.host]?.kursi ?? null : null;
        current = { ...current, host: penggantiHost(current, lama ?? 3), pindahHostPada: null };
        break;
      }
      case 'hapusRuang':
        return { state: current, pesan, tenggatBerikutnya: null, hapus: true };
    }
    current = rapikan(current, pada);
  }
  return selesai(current, pesan);
}

export function proyeksiLobi(state: StateRuang): LobiPublik {
  // Di lobi kursi bot dianggap kosong; selama game dan di hasil akhir bot tetap di kursinya.
  const adaGame = state.fase !== 'lobi';
  return {
    fase: state.fase,
    kursi: SEATS.map((seat): KursiLobi => {
      const token = state.kursi[seat];
      if (token) {
        const orang = state.orang[token]!;
        return { nama: orang.nama, jenis: 'manusia', terputus: !orang.tersambung, diambilAlih: state.diambilAlih.includes(seat) };
      }
      if (adaGame && state.botSejakAwal.includes(seat)) return { nama: `Bot ${seat + 1}`, jenis: 'bot', terputus: false, diambilAlih: false };
      return { nama: '', jenis: 'kosong', terputus: false, diambilAlih: false };
    }),
    hostKursi: state.host ? state.orang[state.host]!.kursi : null,
    config: state.config,
  };
}

function masuk(state: StateRuang, perintah: Extract<Perintah, { jenis: 'masuk' }>, sekarang: number): Hasil {
  const { token } = perintah;
  if (perintah.versi !== VERSI_PROTOKOL) return tolak(state, token, 'perlu-pembaruan');
  const dikenal = state.orang[token];
  if (dikenal) {
    // Token yang dikenal selalu kembali ke tempatnya, termasuk kursi yang sedang diambil alih bot.
    const tersambung = dikenal.tersambung ? state : { ...state, orang: { ...state.orang, [token]: { ...dikenal, tersambung: true } } };
    const next = lepasBot(tersambung, token, sekarang);
    return selesai(next, [{ untuk: token, pesan: snapshot(next, token, sekarang) }]);
  }
  if (state.fase === 'bermain') return tolak(state, token, 'game-berjalan');
  const nama = rapikanNama(perintah.nama);
  if (nama === null) return tolak(state, token, 'nama-tidak-sah');
  const dipakai = Object.values(state.orang).some((o) => o.nama.toLocaleLowerCase() === nama.toLocaleLowerCase());
  if (dipakai) return tolak(state, token, 'nama-dipakai');
  const kursi = SEATS.find((s) => !state.kursi[s]);
  if (kursi === undefined) return tolak(state, token, 'ruang-penuh');
  const next: StateRuang = {
    ...state,
    orang: { ...state.orang, [token]: { nama, kursi, tersambung: true } },
    kursi: state.kursi.map((t, i) => (i === kursi ? token : t)),
  };
  return selesai(next, [{ untuk: token, pesan: snapshot(next, token, sekarang) }]);
}

function pilihKursi(state: StateRuang, { token, kursi }: Extract<Perintah, { jenis: 'pilihKursi' }>, sekarang: number): Hasil {
  if (!state.orang[token]) return tolak(state, token, 'bukan-pemain');
  if (state.fase === 'bermain') return tolak(state, token, 'game-berjalan');
  if (state.kursi[kursi]) return tolak(state, token, 'kursi-terisi');
  return dudukkan(state, { [kursi]: token, ...lepasKursi(state, token) }, sekarang);
}

function pindahkan(state: StateRuang, { token, dari, ke }: Extract<Perintah, { jenis: 'pindahkan' }>, sekarang: number): Hasil {
  const tolakHost = periksaHost(state, token);
  if (tolakHost) return tolakHost;
  const dipindah = state.kursi[dari];
  if (!dipindah) return tolak(state, token, 'kursi-kosong');
  // Kursi tujuan yang berisi manusia ditukar.
  return dudukkan(state, { [ke]: dipindah, [dari]: state.kursi[ke] ?? null }, sekarang);
}

function kosongkan(state: StateRuang, { token, kursi }: Extract<Perintah, { jenis: 'kosongkan' }>, sekarang: number): Hasil {
  const tolakHost = periksaHost(state, token);
  if (tolakHost) return tolakHost;
  const pemilik = state.kursi[kursi];
  if (!pemilik) return tolak(state, token, 'kursi-kosong');
  if (pemilik === token) return tolak(state, token, 'kursi-host');
  // Pemilik tetap di ruang tanpa kursi dan tetap memegang nama panggilannya.
  return dudukkan(state, { [kursi]: null }, sekarang);
}

function aturKonfigurasi(state: StateRuang, { token, config }: Extract<Perintah, { jenis: 'aturKonfigurasi' }>): Hasil {
  const tolakHost = periksaHost(state, token);
  if (tolakHost) return tolakHost;
  const { targetPoints, doubleBalak } = config;
  if (!Number.isInteger(targetPoints) || targetPoints < 1 || targetPoints > TARGET_POIN_MAKS || typeof doubleBalak !== 'boolean') {
    return tolak(state, token, 'konfigurasi-tidak-sah');
  }
  return selesai({ ...state, config: { targetPoints, doubleBalak } });
}

/** Perintah host hanya berlaku dari host dan di luar game. */
function periksaHost(state: StateRuang, token: string): Hasil | null {
  if (state.host !== token) return tolak(state, token, 'bukan-host');
  if (state.fase === 'bermain') return tolak(state, token, 'game-berjalan');
  return null;
}

/** Kursi yang kini ditempati `token`, dikosongkan (untuk digabung ke perubahan kursi). */
function lepasKursi(state: StateRuang, token: string): Partial<Record<Seat, null>> {
  const kursi = state.orang[token]!.kursi;
  return kursi === null ? {} : { [kursi]: null };
}

/** Menerapkan perubahan pemilik kursi; setiap orang yang kursinya berubah menerima snapshot. */
function dudukkan(state: StateRuang, ubah: Partial<Record<Seat, string | null>>, sekarang: number): Hasil {
  const kursi = state.kursi.map((t, i) => (i in ubah ? ubah[i as Seat] ?? null : t));
  const orang = Object.fromEntries(Object.entries(state.orang).map(([t, o]): [string, Orang] => {
    const seat = kursi.indexOf(t);
    return [t, { ...o, kursi: seat < 0 ? null : (seat as Seat) }];
  }));
  const next: StateRuang = { ...state, kursi, orang };
  const berubah = Object.keys(orang).filter((t) => orang[t]!.kursi !== state.orang[t]!.kursi);
  return selesai(next, berubah.map((untuk) => ({ untuk, pesan: snapshot(next, untuk, sekarang) })));
}

function mulai(state: StateRuang, token: string, sekarang: number, benih: Benih): Hasil {
  const tolakHost = periksaHost(state, token);
  if (tolakHost) return tolakHost;
  const awal = startGame(state.config, seededRandom(benih()));
  const siap: StateRuang = { ...state, fase: 'bermain', botSejakAwal: SEATS.filter((s) => !state.kursi[s]), diambilAlih: [] };
  const next = transisi(siap, awal.state, awal.events, sekarang);
  return selesai(next, pesanTransisi(next, awal.events, sekarang));
}

function pasang(state: StateRuang, perintah: Extract<Perintah, { jenis: 'pasang' }>, sekarang: number): Hasil {
  const { token } = perintah;
  const seat = state.orang[token]?.kursi;
  if (seat === undefined || seat === null || state.fase !== 'bermain' || !state.game) return tolak(state, token, 'bukan-pemain');
  if (state.diambilAlih.includes(seat)) return tolak(state, token, 'diambil-alih');
  if (sekarang < state.jendelaSelesai) return tolak(state, token, 'masih-presentasi');
  const hasil = applyMove(state.game, { seat, cardId: perintah.cardId, end: perintah.end });
  if (!hasil.ok) return tolak(state, token, hasil.reason);
  const next = transisi(state, hasil.state, hasil.events, sekarang);
  return selesai(next, pesanTransisi(next, hasil.events, sekarang));
}

function ambilKendali(state: StateRuang, token: string, sekarang: number): Hasil {
  if (!state.orang[token]) return tolak(state, token, 'bukan-pemain');
  return selesai(lepasBot(state, token, sekarang));
}

/**
 * Pemilik token memegang kursinya lagi dari bot pengganti. Langkah bot yang terjadwal batal;
 * jika sedang gilirannya, tenggat ambil alih dimulai lagi dari awal.
 */
function lepasBot(state: StateRuang, token: string, sekarang: number): StateRuang {
  const seat = state.orang[token]!.kursi;
  if (seat === null || state.fase !== 'bermain' || !state.diambilAlih.includes(seat)) return state;
  const next: StateRuang = { ...state, diambilAlih: state.diambilAlih.filter((s) => s !== seat) };
  const session = state.game!.session;
  if (session.turn !== seat || session.result) return next;
  return { ...next, tenggat: null, ambilAlih: { kursi: seat, pada: Math.max(sekarang, state.jendelaSelesai) + BATAS_WAKTU.ambilAlih } };
}

function putuskan(state: StateRuang, token: string): StateRuang {
  const orang = state.orang[token];
  if (!orang?.tersambung) return state;
  return { ...state, orang: { ...state.orang, [token]: { ...orang, tersambung: false } } };
}

function keluar(state: StateRuang, token: string): Hasil {
  const orang = state.orang[token];
  if (!orang) return tolak(state, token, 'bukan-pemain');
  // Saat game berjalan tidak ada yang bisa meninggalkan kursi: keluar sama dengan Terputus.
  if (state.fase === 'bermain') return selesai(putuskan(state, token));
  const { [token]: _, ...sisaOrang } = state.orang;
  const next: StateRuang = { ...state, orang: sisaOrang, kursi: state.kursi.map((t) => (t === token ? null : t)) };
  if (state.host !== token) return selesai(next);
  return selesai({ ...next, host: penggantiHost(next, orang.kursi ?? 3), pindahHostPada: null });
}

/** Pemain yang bisa memegang host: manusia tersambung yang duduk dan kursinya tidak dimainkan bot. */
function bisaHost(state: StateRuang, token: string): boolean {
  const orang = state.orang[token];
  if (!orang?.tersambung || orang.kursi === null) return false;
  return !(state.fase === 'bermain' && state.diambilAlih.includes(orang.kursi));
}

/** Pemain yang bisa memegang host berikutnya searah jarum jam dari `dari`, atau `null`. */
function penggantiHost(state: StateRuang, dari: Seat): string | null {
  for (let i = 1; i <= SEATS.length; i++) {
    const token = state.kursi[(dari + i) % SEATS.length];
    if (token && bisaHost(state, token)) return token;
  }
  return null;
}

/**
 * Menjaga aturan host dan tenggat yang bergantung pada siapa yang tersambung, setelah setiap
 * perubahan state:
 * - host yang diambil alih bot saat game berjalan langsung digantikan;
 * - ruang tanpa host memberi host ke pemain pertama yang bisa memegangnya;
 * - host Terputus di luar game digantikan setelah 2 menit;
 * - ruang tanpa orang tersambung dihapus setelah 10 menit.
 */
function rapikan(state: StateRuang, sekarang: number): StateRuang {
  const berjalan = state.fase === 'bermain';
  let host = state.host;
  // Saat game berjalan host yang Terputus tetap host; hanya host yang diambil alih bot yang digantikan.
  const kursiHost = host ? state.orang[host]!.kursi : null;
  if (berjalan && kursiHost !== null && state.diambilAlih.includes(kursiHost)) host = penggantiHost(state, kursiHost);
  host ??= penggantiHost(state, 3);
  const hostPutus = !berjalan && host !== null && !state.orang[host]!.tersambung;
  const pindahHostPada = hostPutus ? state.pindahHostPada ?? sekarang + BATAS_WAKTU.pindahHost : null;
  const adaTersambung = Object.values(state.orang).some((o) => o.tersambung);
  const hapusPada = adaTersambung ? null : state.hapusPada ?? sekarang + BATAS_WAKTU.hapusRuang;
  if (host === state.host && pindahHostPada === state.pindahHostPada && hapusPada === state.hapusPada) return state;
  return { ...state, host, pindahHostPada, hapusPada };
}

function langkahBot(game: GameState): Transition {
  const hasil = applyMove(game, chooseMove(seatView(game, game.session.turn)));
  if (!hasil.ok) throw new Error(`langkah bot ditolak: ${hasil.reason}`);
  return hasil;
}

/**
 * Menerapkan hasil mesin: membuka jendela presentasi dan menjadwalkan tenggat berikutnya. Giliran
 * manusia dimulai di akhir jendela, dan sejak itu tenggat ambil alih bot berjalan.
 */
function transisi(state: StateRuang, game: GameState, events: readonly GameEvent[], pada: number): StateRuang {
  const jendelaSelesai = pada + durasiJendela(events);
  const turn = game.session.turn;
  const bot = !state.kursi[turn] || state.diambilAlih.includes(turn);
  const manusia = !game.result && !game.session.result && !bot;
  const tenggat: Tenggat | null = game.result || manusia
    ? null
    : game.session.result
      ? { jenis: 'rondeBerikutnya', pada: jendelaSelesai }
      : { jenis: 'langkahBot', pada: jendelaSelesai + DURASI.botBerpikir };
  return {
    ...state,
    fase: game.result ? 'hasil' : 'bermain',
    game,
    jendelaSelesai,
    tenggat,
    ambilAlih: manusia ? { kursi: turn, pada: jendelaSelesai + BATAS_WAKTU.ambilAlih } : null,
    // Di luar game tidak ada kursi yang dimainkan bot pengganti.
    diambilAlih: game.result ? [] : state.diambilAlih,
  };
}

function pesanTransisi(state: StateRuang, events: readonly GameEvent[], sekarang: number): PesanKeluar[] {
  const game = state.game!;
  return Object.entries(state.orang).flatMap(([untuk, orang]): PesanKeluar[] => {
    if (orang.kursi === null) return [];
    const seat = orang.kursi;
    const tersensor = events.map((e): EventKlien =>
      e.type === 'dealt'
        ? { type: 'dealt', session: e.session, redeal: e.redeal, hand: e.hands[seat]!, handCounts: e.hands.map((h) => h.length) }
        : e,
    );
    return [{ untuk, pesan: { jenis: 'transisi', events: tersensor, pandangan: seatView(game, seat), sisaPresentasi: sisa(state, sekarang) } }];
  });
}

function snapshot(state: StateRuang, token: string, sekarang: number): Pesan {
  const kursi = state.orang[token]!.kursi;
  // Di luar game (lobi atau setelah hasil akhir) tidak ada meja yang perlu ditampilkan ulang.
  const pandangan = state.fase === 'bermain' && state.game && kursi !== null ? seatView(state.game, kursi) : null;
  return { jenis: 'snapshot', kursi, pandangan, sisaPresentasi: pandangan ? sisa(state, sekarang) : 0 };
}
