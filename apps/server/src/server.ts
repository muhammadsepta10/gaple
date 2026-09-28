import { Room, ServerError, defineRoom, defineServer, type Client } from '@colyseus/core';
import { schema, t } from '@colyseus/schema';
import { WebSocketTransport } from '@colyseus/ws-transport';
import {
  buatRuang, jalankanTenggat, proyeksiLobi, terapkan,
  type Benih, type Hasil, type Pesan, type Perintah, type StateRuang,
} from '@gaple/ruang';

/** Proyeksi lobi publik. Kartu dan `GameState` tidak pernah masuk Schema. */
const KursiSchema = schema({ nama: t.string().default(''), jenis: t.string().default('kosong') }, 'Kursi');
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

function kelasRuang({ skala = 1 }: KonfigServer) {
  const awal = Date.now();
  const sekarang = () => awal + (Date.now() - awal) * skala;

  return class RuangRoom extends Room<{ state: Lobi }> {
    private ruang: StateRuang = buatRuang();
    /** sessionId Colyseus → token pemain. sessionId hanya alamat koneksi. */
    private tokenKoneksi = new Map<string, string>();
    private timer: ReturnType<typeof setTimeout> | undefined;

    onCreate() {
      this.state = new LobiSchema();
      for (let i = 0; i < 4; i++) this.state.kursi.push(new KursiSchema());
      this.sinkronLobi();
      this.onMessage('mulai', (client) => this.perintah(client, (token) => ({ jenis: 'mulai', token })));
      this.onMessage('pasang', (client, pesan: unknown) => {
        const { cardId, end } = (pesan ?? {}) as { cardId?: unknown; end?: unknown };
        if (typeof cardId !== 'string' || (end !== 'left' && end !== 'right')) {
          const tolak: Pesan = { jenis: 'ditolak', alasan: 'perintah-tidak-sah' };
          return client.send('pesan', tolak);
        }
        this.perintah(client, (token) => ({ jenis: 'pasang', token, cardId, end }));
      });
    }

    onJoin(client: Client, opsi: { token?: unknown; nama?: unknown; versi?: unknown }) {
      const token = typeof opsi?.token === 'string' ? opsi.token : '';
      if (!token) throw new ServerError(400, 'perintah-tidak-sah');
      const nama = typeof opsi.nama === 'string' ? opsi.nama : '';
      const hasil = terapkan(this.ruang, { jenis: 'masuk', token, nama, versi: Number(opsi.versi) }, sekarang(), benihKripto);
      const tolak = hasil.pesan.find((p) => p.pesan.jenis === 'ditolak');
      if (tolak?.pesan.jenis === 'ditolak') throw new ServerError(400, tolak.pesan.alasan);
      this.tokenKoneksi.set(client.sessionId, token);
      this.terima(hasil);
    }

    onLeave(client: Client) {
      this.tokenKoneksi.delete(client.sessionId);
    }

    onDispose() {
      clearTimeout(this.timer);
    }

    private perintah(client: Client, buat: (token: string) => Perintah) {
      const token = this.tokenKoneksi.get(client.sessionId);
      if (!token) return;
      this.terima(terapkan(this.ruang, buat(token), sekarang(), benihKripto));
    }

    /** Menyimpan state baru, menyinkronkan lobi, mengirim pesan per penerima, lalu menjadwalkan tenggat. */
    private terima(hasil: Hasil) {
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
