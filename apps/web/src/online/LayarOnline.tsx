import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Suara } from '../audio/suara';
import type { GambarMeja } from '../gambarMeja';
import { button } from '../gaya';
import { LayarMeja } from '../LayarMeja';
import type { SeatInfo } from '../meja/Meja';
import { namaTerakhir, pesanGagal, sambungRuangBaru, type LobiKlien, type SambunganRuang } from './sambungan';
import { useOnlineGame } from './useOnlineGame';

const halaman: React.CSSProperties = {
  minHeight: '100%', display: 'grid', placeItems: 'center', padding: 16, boxSizing: 'border-box',
  color: '#fff', fontFamily: 'system-ui',
};

const kartuPanel: React.CSSProperties = {
  width: 'min(100%, 380px)', display: 'grid', gap: 14, padding: '20px 18px', boxSizing: 'border-box',
  borderRadius: 16, background: 'rgba(0,0,0,.35)',
};

const tombolKedua: React.CSSProperties = { ...button, background: 'rgba(255,255,255,.14)', color: '#fff' };

type Props = { audio: Suara; muted: boolean; onMute: () => void; gambar: GambarMeja; onKeluar: () => void };

export function LayarOnline(props: Props) {
  const [sambungan, setSambungan] = useState<SambunganRuang | null>(null);
  if (!sambungan) return <FormBuatRuang onMasuk={setSambungan} onKembali={props.onKeluar} />;
  return <RuangOnline {...props} sambungan={sambungan} />;
}

function FormBuatRuang({ onMasuk, onKembali }: { onMasuk: (s: SambunganRuang) => void; onKembali: () => void }) {
  const [nama, setNama] = useState(namaTerakhir);
  const [galat, setGalat] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(false);
  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemuat(true);
    setGalat(null);
    try {
      onMasuk(await sambungRuangBaru(nama));
    } catch (err) {
      setGalat(pesanGagal(err));
      setMemuat(false);
    }
  };
  return (
    <div style={halaman}>
      <form style={kartuPanel} onSubmit={kirim}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Main online</h1>
        <label style={{ display: 'grid', gap: 6, fontSize: 15 }}>
          Nama panggilan
          <input
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            autoFocus
            required
            maxLength={40}
            style={{ font: '16px system-ui', padding: '10px 12px', borderRadius: 10, border: '1px solid #fff5' }}
          />
        </label>
        {galat && <p role="alert" style={{ margin: 0, color: '#ffb3a9' }}>{galat}</p>}
        <button type="submit" style={button} disabled={memuat}>{memuat ? 'Membuat ruang…' : 'Buat ruang'}</button>
        <button type="button" style={tombolKedua} onClick={onKembali}>Kembali</button>
      </form>
    </div>
  );
}

function RuangOnline({ sambungan, audio, muted, onMute, gambar, onKeluar }: Props & { sambungan: SambunganRuang }) {
  const lobi = useSyncExternalStore(sambungan.dengarLobi, sambungan.lobiSekarang);
  const [kanvasSiap, setKanvasSiap] = useState(false);
  const game = useOnlineGame(sambungan, audio, kanvasSiap);
  useEffect(() => () => { sambungan.keluar(); audio.cancelPending(); }, [sambungan, audio]);

  if (!lobi || lobi.fase === 'lobi') return <Lobi lobi={lobi} kursiSaya={game.seat} onMulai={() => sambungan.mulai()} onKeluar={onKeluar} />;

  const seats: SeatInfo[] = lobi.kursi.map((k) => ({ name: k.nama, bot: k.jenis === 'bot' }));
  return (
    <LayarMeja
      game={game}
      seats={seats}
      humanSeat={game.seat}
      muted={muted}
      onMute={onMute}
      gambar={gambar}
      onReady={() => setKanvasSiap(true)}
      exitConfirm="Keluar dari ruang? Game tetap berjalan tanpa kamu."
      onExit={onKeluar}
      onBackToMenu={onKeluar}
    />
  );
}

function Lobi({ lobi, kursiSaya, onMulai, onKeluar }: { lobi: LobiKlien | null; kursiSaya: number; onMulai: () => void; onKeluar: () => void }) {
  const host = lobi?.hostKursi === kursiSaya;
  return (
    <div style={halaman}>
      <div style={kartuPanel} data-testid="lobi">
        <h1 style={{ fontSize: 26, margin: 0 }}>Ruang privat</h1>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
          {(lobi?.kursi ?? []).map((k, i) => (
            <li key={i} data-testid="kursi-lobi" style={{
              display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10,
              background: k.jenis === 'kosong' ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.14)',
            }}>
              <span>
                {k.jenis === 'kosong' ? <em style={{ opacity: 0.6 }}>Kosong (bot saat mulai)</em> : k.nama}
                {i === kursiSaya && ' (kamu)'}
              </span>
              {lobi?.hostKursi === i && <span style={{ color: '#ffe08a', fontSize: 13, fontWeight: 700 }}>Host</span>}
            </li>
          ))}
        </ol>
        {lobi && (
          <p style={{ margin: 0, fontSize: 14, opacity: 0.8 }}>
            Target {lobi.targetPoin} poin · Balak ganda {lobi.balakGanda ? 'aktif' : 'mati'}
          </p>
        )}
        {host
          ? <button style={button} onClick={onMulai}>Mulai</button>
          : <p style={{ margin: 0, opacity: 0.8 }}>Menunggu host memulai game…</p>}
        <button style={tombolKedua} onClick={onKeluar}>Keluar ruang</button>
      </div>
    </div>
  );
}
