import { Room, ServerError, createEndpoint, createRouter, defineRoom, defineServer, matchMaker, type Client } from '@colyseus/core';
import { schema, t } from '@colyseus/schema';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import path from 'node:path';
import { SEATS, type Seat } from '@gaple/aturan';
import {
  KODE_TUTUP_DIGANTIKAN, buatKodeUndangan, buatRuang, jalankanTenggat, proyeksiLobi, pulihkan, terapkan,
  type Benih, type Hasil, type Pesan, type Perintah, type StateRuang,
} from '@gaple/ruang';
import { BATAS_AWAL, pasangBatasMatchmaking, type BatasServer } from './batas';
import { penyimpananMemori, type Penyimpanan } from './penyimpanan';

/** Proyeksi lobi publik. Kartu dan `GameState` tidak pernah masuk Schema. */
const KursiSchema = schema({
  nama: t.string().default(''),
  jenis: t.string().default('kosong'),
  terputus: t.boolean().default(false),
  diambilAlih: t.boolean().default(false),
}, 'Kursi');
const LobiSchema = schema({
  fase: t.string().default('lobi'),
  kursi: t.array(KursiSchema),
  hostKursi: t.int8().default(-1),
  targetPoin: t.number().default(0),
  balakGanda: t.boolean().default(false),
  /** Nama panggilan penonton yang tersambung. */
  penonton: t.array('string'),
}, 'Lobi');
type Lobi = InstanceType<typeof LobiSchema>;

export type KonfigServer = {
  /**
   * Kelipatan kecepatan waktu ruang terhadap waktu nyata. Bawaan 1; tes integrasi memakai
   * nilai besar agar satu game selesai dalam hitungan detik.
   */
  readonly skala?: number;
  /** Batas penyalahgunaan; yang tidak diisi memakai angka awal. */
  readonly batas?: Partial<BatasServer>;
  /** Tempat snapshot ruang; bawaan di memori (tidak selamat dari restart proses). */
  readonly penyimpanan?: Penyimpanan;
  /**
   * Jam ruang (ms). Bawaan: waktu nyata dipercepat `skala`. Tes restart memberi jam yang sama ke
   * server lama dan baru supaya waktu simpan snapshot sebanding.
   */
  readonly jam?: () => number;
  /** Sumber acak [0, 1) untuk kode undangan; bawaan kriptografis. */
  readonly acakKode?: () => number;
  /**
   * Folder hasil build aplikasi web. Jika diisi, web disajikan dari origin yang sama dengan
   * server (tanpa CORS), termasuk tautan ruang `/r/<kode>`.
   */
  readonly web?: string;
};

/** Seed setiap pembagian kartu dari sumber acak kriptografis. */
const benihKripto: Benih = () => crypto.getRandomValues(new Uint32Array(1))[0]!;

const acakKripto = () => benihKripto() / 2 ** 32;

const kursiSah = (x: unknown): x is Seat => SEATS.includes(x as Seat);

/**
 * Menerjemahkan pesan klien menjadi perintah untuk token pengirim; `null` jika bentuknya tidak dikenali.
 * Identitas selalu dari token koneksi, tidak pernah dari isi pesan.
 */
const PESAN_KLIEN: Record<string, (isi: Record<string, unknown>, token: string) => Perintah | null> = {
  mulai: (_, token) => ({ jenis: 'mulai', token }),
  ambilKendali: (_, token) => ({ jenis: 'ambilKendali', token }),
  keluar: (_, token) => ({ jenis: 'keluar', token }),
  pasang: ({ cardId, end }, token) =>
    typeof cardId === 'string' && (end === 'left' || end === 'right') ? { jenis: 'pasang', token, cardId, end } : null,
  pilihKursi: ({ kursi }, token) => (kursiSah(kursi) ? { jenis: 'pilihKursi', token, kursi } : null),
  pindahkan: ({ dari, ke }, token) => (kursiSah(dari) && kursiSah(ke) ? { jenis: 'pindahkan', token, dari, ke } : null),
  kosongkan: ({ kursi }, token) => (kursiSah(kursi) ? { jenis: 'kosongkan', token, kursi } : null),
  aturKonfigurasi: ({ targetPoin, balakGanda }, token) =>
    typeof targetPoin === 'number' && typeof balakGanda === 'boolean'
      ? { jenis: 'aturKonfigurasi', token, config: { targetPoints: targetPoin, doubleBalak: balakGanda } }
      : null,
};

/** Kode undangan ruang aktif di proses ini. */
const kodeAktif = new Set<string>();

/** Opsi pembuatan room dari sisi server untuk ruang yang dipulihkan saat boot. */
type OpsiPulih = { readonly pulihkan?: unknown };

type Lingkungan = {
  readonly skala: number;
  readonly sekarang: () => number;
  readonly batas: BatasServer;
  readonly penyimpanan: Penyimpanan;
  readonly acakKode: () => number;
  /**
   * Hasil `pulihkan` yang menunggu room-nya dibuat ulang, dikunci kode. Hanya diisi saat boot,
   * jadi klien yang mengirim opsi `pulihkan` tetap mendapat ruang baru biasa.
   */
  readonly siapPulih: Map<string, Hasil>;
};

function kelasRuang({ skala, sekarang, batas, penyimpanan, acakKode, siapPulih }: Lingkungan) {
  /**
   * Kode acak yang tidak bentrok dengan ruang aktif maupun kode bekas di penyimpanan. Kode langsung
   * dicatat aktif, supaya dua pembuatan ruang yang bersamaan tidak mendapat kode yang sama.
   */
  async function kodeBaru(): Promise<string> {
    for (;;) {
      const kode = buatKodeUndangan(acakKode, (k) => kodeAktif.has(k));
      if (!(await penyimpanan.dipakai(kode)) && !kodeAktif.has(kode)) {
        kodeAktif.add(kode);
        return kode;
      }
    }
  }

  return class RuangRoom extends Room<{ state: Lobi }> {
    private ruang!: StateRuang;
    /** sessionId Colyseus → token pemain. sessionId hanya alamat koneksi. */
    private tokenKoneksi = new Map<string, string>();
    private timer: ReturnType<typeof setTimeout> | undefined;
    /** Ruang sudah dihapus: tidak ada lagi yang disimpan, termasuk dari koneksi yang ditutup. */
    private dihapus = false;

    async onCreate(opsi: OpsiPulih) {
      this.maxMessagesPerSecond = batas.pesanPerDetik;
      const pulih = typeof opsi?.pulihkan === 'string' ? siapPulih.get(opsi.pulihkan) : undefined;
      if (pulih) kodeAktif.add(pulih.state.kode);
      this.roomId = pulih ? pulih.state.kode : await kodeBaru();
      this.state = new LobiSchema();
      for (let i = 0; i < 4; i++) this.state.kursi.push(new KursiSchema());
      if (pulih) {
        siapPulih.delete(this.roomId);
        // Orang di ruang semuanya Terputus sampai menyambung ulang; ruang hidup sampai tenggat hapus.
        this.autoDispose = false;
        this.terima(pulih);
      } else {
        this.ruang = buatRuang(this.roomId);
        this.sinkronLobi();
      }
      for (const [jenis, terjemah] of Object.entries(PESAN_KLIEN)) {
        this.onMessage(jenis, (client, isi: unknown) => {
          const token = this.tokenKoneksi.get(client.sessionId);
          if (!token) return;
          const perintah = terjemah(typeof isi === 'object' && isi !== null ? isi as Record<string, unknown> : {}, token);
          if (!perintah) {
            const tolak: Pesan = { jenis: 'ditolak', alasan: 'perintah-tidak-sah' };
            return client.send('pesan', tolak);
          }
          this.terima(terapkan(this.ruang, perintah, sekarang(), benihKripto));
        });
      }
    }

    onJoin(client: Client, opsi: { token?: unknown; nama?: unknown; versi?: unknown }) {
      const token = typeof opsi?.token === 'string' ? opsi.token : '';
      if (!token) throw new ServerError(400, 'perintah-tidak-sah');
      const nama = typeof opsi.nama === 'string' ? opsi.nama : '';
      const hasil = terapkan(this.ruang, { jenis: 'masuk', token, nama, versi: Number(opsi.versi) }, sekarang(), benihKripto);
      const tolak = hasil.pesan.find((p) => p.pesan.jenis === 'ditolak');
      if (tolak?.pesan.jenis === 'ditolak') throw new ServerError(400, tolak.pesan.alasan);
      // Ruang hidup selama ada orang di dalamnya, termasuk yang Terputus; penghapusan lewat tenggat.
      this.autoDispose = false;
      // Token yang sama dari koneksi lain (tab kedua) mengambil alih: koneksi lama ditutup.
      for (const lama of this.clients) {
        if (lama !== client && this.tokenKoneksi.get(lama.sessionId) === token) {
          this.tokenKoneksi.delete(lama.sessionId);
          lama.leave(KODE_TUTUP_DIGANTIKAN);
        }
      }
      this.tokenKoneksi.set(client.sessionId, token);
      this.terima(hasil);
    }

    onLeave(client: Client) {
      const token = this.tokenKoneksi.get(client.sessionId);
      this.tokenKoneksi.delete(client.sessionId);
      // Koneksi yang sudah digantikan tab lain tidak lagi mewakili token-nya.
      if (token) this.terima(terapkan(this.ruang, { jenis: 'terputus', token }, sekarang(), benihKripto));
    }

    onDispose() {
      clearTimeout(this.timer);
      kodeAktif.delete(this.roomId);
    }

    /**
     * Menyimpan state baru (ke memori room dan penyimpanan), menyinkronkan lobi, mengirim pesan
     * per penerima, lalu menjadwalkan tenggat.
     */
    private terima(hasil: Hasil) {
      if (this.dihapus) return;
      if (hasil.hapus) {
        this.dihapus = true;
        clearTimeout(this.timer);
        // Kode ditandai bekas sebelum room hilang, supaya tidak ada celah kode dipakai ulang. Jika
        // gagal, key ruang tetap ada (kode tetap tidak dipakai ulang) dan ruang dipulihkan lalu
        // dihapus lagi pada boot berikutnya.
        void penyimpanan.hapus(this.roomId).catch((err) => console.error('gaple: gagal menghapus ruang', err)).finally(() => this.disconnect());
        return;
      }
      if (hasil.state !== this.ruang) penyimpanan.simpan({ state: hasil.state, disimpanPada: sekarang() });
      this.ruang = hasil.state;
      this.sinkronLobi();
      for (const { untuk, pesan } of hasil.pesan) {
        for (const client of this.clients) if (this.tokenKoneksi.get(client.sessionId) === untuk) client.send('pesan', pesan);
      }
      clearTimeout(this.timer);
      if (hasil.tenggatBerikutnya !== null) {
        const tunda = Math.max(0, (hasil.tenggatBerikutnya - sekarang()) / skala);
        this.timer = setTimeout(() => this.terima(jalankanTenggat(this.ruang, sekarang(), benihKripto)), tunda);
      }
    }

    private sinkronLobi() {
      const lobi = proyeksiLobi(this.ruang);
      this.state.fase = lobi.fase;
      lobi.kursi.forEach((k, i) => Object.assign(this.state.kursi[i]!, k));
      this.state.hostKursi = lobi.hostKursi ?? -1;
      this.state.targetPoin = lobi.config.targetPoints;
      this.state.balakGanda = lobi.config.doubleBalak;
      if (this.state.penonton.join('\n') !== lobi.penonton.join('\n')) {
        this.state.penonton.clear();
        this.state.penonton.push(...lobi.penonton);
      }
    }
  };
}

/**
 * Menyajikan build web: halaman dan service worker selalu diperiksa ulang (versi baru langsung
 * terlihat, lihat pembaruan paksa di klien), aset ber-hash di-cache setahun.
 */
function sajikanWeb(app: express.Application, folder: string) {
  const halaman = path.join(folder, 'index.html');
  const tanpaCache = (res: express.Response) => res.setHeader('Cache-Control', 'no-cache');
  app.get(['/', '/r/:kode'], (_req, res) => {
    tanpaCache(res);
    res.sendFile(halaman);
  });
  app.use(express.static(folder, {
    index: false,
    setHeaders: (res, berkas) => {
      if (berkas.startsWith(path.join(folder, 'assets') + path.sep)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      else tanpaCache(res);
    },
  }));
}

/** Selang tanda hidup server (waktu ruang); galat waktu henti setelah crash paling banyak sebesar ini. */
const SELANG_DETAK = 5_000;

/** Jumlah ruang aktif, untuk operator memilih waktu perawatan. */
const kesehatan = createEndpoint('/kesehatan', { method: 'GET' }, async () => ({ ruangAktif: kodeAktif.size }));

/**
 * Server Colyseus ruang privat. Sebelum menerima koneksi, semua ruang di penyimpanan dipulihkan
 * dengan kode yang sama; waktu henti tidak dihitung dalam tenggat mana pun.
 */
export function buatServer(konfig: KonfigServer = {}) {
  const skala = konfig.skala ?? 1;
  const awal = Date.now();
  const sekarang = konfig.jam ?? (() => awal + (Date.now() - awal) * skala);
  const batas = { ...BATAS_AWAL, ...konfig.batas };
  const penyimpanan = konfig.penyimpanan ?? penyimpananMemori();
  const siapPulih = new Map<string, Hasil>();
  let timerDetak: ReturnType<typeof setInterval> | undefined;
  pasangBatasMatchmaking(batas, (kode) => penyimpanan.bekas(kode));
  const server = defineServer({
    greet: false,
    transport: new WebSocketTransport(),
    rooms: { ruang: defineRoom(kelasRuang({ skala, sekarang, batas, penyimpanan, acakKode: konfig.acakKode ?? acakKripto, siapPulih })) },
    routes: createRouter({ kesehatan }),
    ...(konfig.web ? { express: (app: express.Application) => sajikanWeb(app, path.resolve(konfig.web!)) } : {}),
    beforeListen: async () => {
      await matchMaker.onReady;
      // Waktu henti dimulai dari tanda hidup terakhir server sebelumnya, bukan dari perubahan
      // terakhir ruang: setelah crash, ruang yang diam sebelum mati tidak mendapat bonus waktu.
      const detakTerakhir = (await penyimpanan.detakTerakhir()) ?? -Infinity;
      for (const { state, disimpanPada } of await penyimpanan.semua()) {
        try {
          siapPulih.set(state.kode, pulihkan(state, Math.max(disimpanPada, detakTerakhir), sekarang()));
          await matchMaker.createRoom('ruang', { pulihkan: state.kode });
        } catch (err) {
          // Satu snapshot yang rusak tidak boleh menahan ruang lain dan server.
          siapPulih.delete(state.kode);
          console.error(`gaple: gagal memulihkan ruang ${state?.kode}`, err);
        }
      }
      penyimpanan.detak(sekarang());
      timerDetak = setInterval(() => penyimpanan.detak(sekarang()), SELANG_DETAK / skala);
    },
  });
  // Tanda hidup dan tulisan terakhir (orang yang terputus saat room ditutup) selesai sebelum proses berhenti.
  server.onShutdown(() => {
    clearInterval(timerDetak);
    penyimpanan.detak(sekarang());
    return penyimpanan.tutup();
  });
  return server;
}
