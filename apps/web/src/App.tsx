import type { GameConfig } from '@gaple/aturan';
import { useEffect, useState } from 'react';
import { Suara } from './audio/suara';
import { GAMBAR_MEJA, gambarMejaAwal, pilihGambarMeja, type GambarMeja } from './gambarMeja';
import { button } from './gaya';
import { LayarMeja } from './LayarMeja';
import type { SeatInfo } from './meja/Meja';
import { LayarOnline } from './online/LayarOnline';
import { HUMAN_SEAT, useOfflineGame } from './offline/useOfflineGame';

const SEAT_INFO: SeatInfo[] = [
  { name: 'Kamu', bot: false },
  { name: 'Budi', bot: true },
  { name: 'Agus', bot: true },
  { name: 'Joko', bot: true },
];

function Menu({ initial, onStart, onOnline, muted, onMute, gambar, onGambar }: { initial: Partial<GameConfig>; onStart: (config: Partial<GameConfig>) => void; onOnline: () => void; muted: boolean; onMute: () => void; gambar: GambarMeja; onGambar: (id: GambarMeja) => void }) {
  const [targetPoints, setTargetPoints] = useState(initial.targetPoints ?? 100);
  const [doubleBalak, setDoubleBalak] = useState(initial.doubleBalak ?? false);
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'system-ui' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 48, margin: '0 0 24px' }}>Gaple</h1>
        <div style={{ display: 'grid', gap: 14, marginBottom: 28, textAlign: 'left', fontSize: 15 }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            Target poin
            <input
              type="number"
              min={1}
              value={targetPoints}
              onChange={(e) => setTargetPoints(Math.max(1, Math.floor(Number(e.target.value)) || 1))}
              style={{ width: 72 }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={doubleBalak} onChange={(e) => setDoubleBalak(e.target.checked)} />
            Balak ganda
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={muted} onChange={onMute} />
            Senyapkan efek suara
          </label>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ marginBottom: 8 }}>Gambar meja</legend>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {GAMBAR_MEJA.map((item) => (
                <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                  <input type="radio" name="gambar-meja" value={item.id} checked={gambar === item.id} onChange={() => onGambar(item.id)} />
                  <span aria-hidden="true" style={{ width: 19, height: 19, borderRadius: 4, background: item.color, border: '1px solid #fff8' }} />
                  {item.name}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={button} onClick={() => onStart({ targetPoints, doubleBalak })}>
            Main offline
          </button>
          <button style={{ ...button, background: '#fff', color: '#123e2b' }} onClick={onOnline}>
            Main online
          </button>
        </div>
      </div>
    </div>
  );
}

function Table({
  config,
  audio,
  muted,
  onMute,
  onExit,
  onPlayAgain,
  onBackToMenu,
  gambar,
}: {
  config: Partial<GameConfig>;
  audio: Suara;
  muted: boolean;
  onMute: () => void;
  onExit: () => void;
  onPlayAgain: () => void;
  onBackToMenu: () => void;
  gambar: GambarMeja;
}) {
  const [ready, setReady] = useState(false);
  const game = useOfflineGame(audio);
  const { start } = game;
  useEffect(() => () => audio.cancelPending(), [audio]);
  // State meja baru diisi setelah kanvas siap (ADR 0001).
  useEffect(() => {
    if (ready) start(config);
  }, [ready, config, start]);

  return (
    <LayarMeja
      game={game}
      seats={SEAT_INFO}
      humanSeat={HUMAN_SEAT}
      muted={muted}
      onMute={onMute}
      gambar={gambar}
      onReady={() => setReady(true)}
      exitConfirm="Keluar dari game yang sedang berjalan? Progres game ini akan hilang."
      onExit={onExit}
      onPlayAgain={onPlayAgain}
      onBackToMenu={onBackToMenu}
    />
  );
}

export function App() {
  const [audio] = useState(() => new Suara());
  const [muted, setMuted] = useState(audio.muted);
  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); audio.dispose(); };
  }, [audio]);
  const toggleMute = () => {
    audio.setMuted(!audio.muted);
    setMuted(audio.muted);
  };
  const [screen, setScreen] = useState<'menu' | 'meja' | 'online'>('menu');
  const [config, setConfig] = useState<Partial<GameConfig>>({});
  const [gambar, setGambar] = useState<GambarMeja>(gambarMejaAwal);
  useEffect(() => { if (gambar !== 'hijau') pilihGambarMeja(gambar); }, []);
  const onGambar = (id: GambarMeja) => { setGambar(id); pilihGambarMeja(id); };
  // Keluar dan "main lagi" kembali ke menu dengan target/balak ganda game ini tetap terisi (bisa diubah);
  // "kembali ke menu" mengatur ulang ke bawaan.
  const toMenuKeepConfig = () => setScreen('menu');
  if (screen === 'online') {
    return <LayarOnline audio={audio} muted={muted} onMute={toggleMute} gambar={gambar} onKeluar={() => setScreen('menu')} />;
  }
  return screen === 'menu' ? (
    <Menu
      initial={config}
      muted={muted}
      onMute={toggleMute}
      gambar={gambar}
      onGambar={onGambar}
      onOnline={() => {
        audio.unlock();
        setScreen('online');
      }}
      onStart={(cfg) => {
        audio.unlock();
        setConfig(cfg);
        setScreen('meja');
      }}
    />
  ) : (
    <Table
      config={config}
      audio={audio}
      muted={muted}
      onMute={toggleMute}
      onExit={toMenuKeepConfig}
      onPlayAgain={toMenuKeepConfig}
      onBackToMenu={() => {
        setConfig({});
        setScreen('menu');
      }}
      gambar={gambar}
    />
  );
}
