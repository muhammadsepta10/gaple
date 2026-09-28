import {
  SEATS, applyMove, chooseMove, nextSession, seatView, seededRandom, startGame,
  type Card, type End, type GameConfig, type GameEvent, type GameState, type RejectReason, type Seat, type SeatView, type Transition,
} from '@gaple/aturan';
import { DURASI } from './durasi';
import { durasiJendela } from './tempo';

/** Naikkan hanya ketika bentuk perintah, pesan, atau event berubah. */
export const VERSI_PROTOKOL = 2;

export const PANJANG_NAMA_MAKS = 12;
export const TARGET_POIN_MAKS = 10_000;

export type Fase = 'lobi' | 'bermain' | 'hasil';

export type Orang = { readonly nama: string; readonly kursi: Seat | null };

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
};

export type Perintah =
  | { readonly jenis: 'masuk'; readonly token: string; readonly nama: string; readonly versi: number }
  | { readonly jenis: 'pilihKursi'; readonly token: string; readonly kursi: Seat }
  | { readonly jenis: 'pindahkan'; readonly token: string; readonly dari: Seat; readonly ke: Seat }
  | { readonly jenis: 'kosongkan'; readonly token: string; readonly kursi: Seat }
  | { readonly jenis: 'aturKonfigurasi'; readonly token: string; readonly config: GameConfig }
  | { readonly jenis: 'mulai'; readonly token: string }
  | { readonly jenis: 'pasang'; readonly token: string; readonly cardId: string; readonly end: End };

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
};

/** Menghasilkan seed bilangan bulat baru untuk setiap pembagian kartu. */
export type Benih = () => number;

export type KursiLobi = { readonly nama: string; readonly jenis: 'kosong' | 'manusia' | 'bot' };

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
  };
}

const selesai = (state: StateRuang, pesan: readonly PesanKeluar[] = []): Hasil => ({
  state,
  pesan,
  tenggatBerikutnya: state.tenggat?.pada ?? null,
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
  switch (perintah.jenis) {
    case 'masuk': return masuk(state, perintah, sekarang);
    case 'pilihKursi': return pilihKursi(state, perintah, sekarang);
    case 'pindahkan': return pindahkan(state, perintah, sekarang);
    case 'kosongkan': return kosongkan(state, perintah, sekarang);
    case 'aturKonfigurasi': return aturKonfigurasi(state, perintah);
    case 'mulai': return mulai(state, perintah.token, sekarang, benih);
    case 'pasang': return pasang(state, perintah, sekarang);
  }
}

/** Memproses semua tenggat yang sudah lewat, masing-masing pada waktunya sendiri. */
export function jalankanTenggat(state: StateRuang, sekarang: number, benih: Benih): Hasil {
  const pesan: PesanKeluar[] = [];
  let current = state;
  while (current.tenggat && current.tenggat.pada <= sekarang) {
    const { jenis, pada } = current.tenggat;
    const game = current.game!;
    const langkah = jenis === 'rondeBerikutnya' ? nextSession(game, seededRandom(benih())) : langkahBot(game);
    current = transisi(current, langkah.state, langkah.events, pada);
    pesan.push(...pesanTransisi(current, langkah.events, sekarang));
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
      if (token) return { nama: state.orang[token]!.nama, jenis: 'manusia' };
      if (adaGame && state.botSejakAwal.includes(seat)) return { nama: `Bot ${seat + 1}`, jenis: 'bot' };
      return { nama: '', jenis: 'kosong' };
    }),
    hostKursi: state.host ? state.orang[state.host]!.kursi : null,
    config: state.config,
  };
}

function masuk(state: StateRuang, perintah: Extract<Perintah, { jenis: 'masuk' }>, sekarang: number): Hasil {
  const { token } = perintah;
  if (perintah.versi !== VERSI_PROTOKOL) return tolak(state, token, 'perlu-pembaruan');
  if (state.orang[token]) return selesai(state, [{ untuk: token, pesan: snapshot(state, token, sekarang) }]);
  if (state.fase === 'bermain') return tolak(state, token, 'game-berjalan');
  const nama = rapikanNama(perintah.nama);
  if (nama === null) return tolak(state, token, 'nama-tidak-sah');
  const dipakai = Object.values(state.orang).some((o) => o.nama.toLocaleLowerCase() === nama.toLocaleLowerCase());
  if (dipakai) return tolak(state, token, 'nama-dipakai');
  const kursi = SEATS.find((s) => !state.kursi[s]);
  if (kursi === undefined) return tolak(state, token, 'ruang-penuh');
  const next: StateRuang = {
    ...state,
    orang: { ...state.orang, [token]: { nama, kursi } },
    kursi: state.kursi.map((t, i) => (i === kursi ? token : t)),
    host: state.host ?? token,
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
  const siap: StateRuang = { ...state, fase: 'bermain', botSejakAwal: SEATS.filter((s) => !state.kursi[s]) };
  const next = transisi(siap, awal.state, awal.events, sekarang);
  return selesai(next, pesanTransisi(next, awal.events, sekarang));
}

function pasang(state: StateRuang, perintah: Extract<Perintah, { jenis: 'pasang' }>, sekarang: number): Hasil {
  const { token } = perintah;
  const seat = state.orang[token]?.kursi;
  if (seat === undefined || seat === null || state.fase !== 'bermain' || !state.game) return tolak(state, token, 'bukan-pemain');
  if (sekarang < state.jendelaSelesai) return tolak(state, token, 'masih-presentasi');
  const hasil = applyMove(state.game, { seat, cardId: perintah.cardId, end: perintah.end });
  if (!hasil.ok) return tolak(state, token, hasil.reason);
  const next = transisi(state, hasil.state, hasil.events, sekarang);
  return selesai(next, pesanTransisi(next, hasil.events, sekarang));
}

function langkahBot(game: GameState): Transition {
  const hasil = applyMove(game, chooseMove(seatView(game, game.session.turn)));
  if (!hasil.ok) throw new Error(`langkah bot ditolak: ${hasil.reason}`);
  return hasil;
}

/** Menerapkan hasil mesin: membuka jendela presentasi dan menjadwalkan tenggat berikutnya. */
function transisi(state: StateRuang, game: GameState, events: readonly GameEvent[], pada: number): StateRuang {
  const jendelaSelesai = pada + durasiJendela(events);
  const bot = !state.kursi[game.session.turn];
  const tenggat: Tenggat | null = game.result
    ? null
    : game.session.result
      ? { jenis: 'rondeBerikutnya', pada: jendelaSelesai }
      : bot
        ? { jenis: 'langkahBot', pada: jendelaSelesai + DURASI.botBerpikir }
        : null;
  return { ...state, fase: game.result ? 'hasil' : 'bermain', game, jendelaSelesai, tenggat };
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
