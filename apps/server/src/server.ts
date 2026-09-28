import { Room, ServerError, defineRoom, defineServer, type Client } from '@colyseus/core';
import { schema, t } from '@colyseus/schema';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { SEATS, type Seat } from '@gaple/aturan';
import {
  KODE_TUTUP_DIGANTIKAN, buatKodeUndangan, buatRuang, jalankanTenggat, proyeksiLobi, terapkan,
  type Benih, type Hasil, type Pesan, type Perintah, type StateRuang,
} from '@gaple/ruang';

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
}, 'Lobi');
type Lobi = InstanceType<typeof LobiSchema>;

export type KonfigServer = {
  /**
   * Kelipatan kecepatan waktu ruang terhadap waktu nyata. Bawaan 1; tes integrasi memakai
   * nilai besar agar satu game selesai dalam hitungan detik.
   */
  readonly skala?: number;
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

/** Kode undangan ruang aktif di proses ini; pengecekan bentrok terhadap Redis menyusul (tiket 05). */
const kodeAktif = new Set<string>();

function kelasRuang({ skala = 1 }: KonfigServer) {
  const awal = Date.now();
  const sekarang = () => awal + (Date.now() - awal) * skala;

  return class RuangRoom extends Room<{ state: Lobi }> {
    private ruang!: StateRuang;
    /** sessionId Colyseus → token pemain. sessionId hanya alamat koneksi. */
    private tokenKoneksi = new Map<string, string>();
    private timer: ReturnType<typeof setTimeout> | undefined;

    onCreate() {
      this.roomId = buatKodeUndangan(acakKripto, (kode) => kodeAktif.has(kode));
      kodeAktif.add(this.roomId);
      this.ruang = buatRuang(this.roomId);
      this.state = new LobiSchema();
      for (let i = 0; i < 4; i++) this.state.kursi.push(new KursiSchema());
      this.sinkronLobi();
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

    /** Menyimpan state baru, menyinkronkan lobi, mengirim pesan per penerima, lalu menjadwalkan tenggat. */
    private terima(hasil: Hasil) {
      if (hasil.hapus) {
        clearTimeout(this.timer);
        void this.disconnect();
        return;
      }
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
    }
  };
}

export function buatServer(konfig: KonfigServer = {}) {
  return defineServer({
    greet: false,
    transport: new WebSocketTransport(),
    rooms: { ruang: defineRoom(kelasRuang(konfig)) },
  });
}
