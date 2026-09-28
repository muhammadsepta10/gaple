import { Application } from '@pixi/react';
import type { GameConfig } from '@gaple/aturan';
import { useEffect, useState } from 'react';
import { Meja, type SeatInfo } from './meja/Meja';
import { HUMAN_SEAT, useOfflineGame } from './offline/useOfflineGame';

const SEAT_INFO: SeatInfo[] = [
  { name: 'Kamu', bot: false },
  { name: 'Budi', bot: true },
  { name: 'Agus', bot: true },
  { name: 'Joko', bot: true },
];

const button: React.CSSProperties = {
  font: '600 18px system-ui',
  padding: '12px 28px',
  borderRadius: 999,
  border: 0,
  background: '#ffd54a',
  color: '#3a2a05',
  cursor: 'pointer',
};

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(0,0,0,.55)',
  color: '#fff',
  fontFamily: 'system-ui',
};

function useWindowSize() {
  const [size, setSize] = useState({ w: innerWidth, h: innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ w: innerWidth, h: innerHeight });
    addEventListener('resize', onResize);
    return () => removeEventListener('resize', onResize);
  }, []);
  return size;
}

function Menu({ initial, onStart }: { initial: Partial<GameConfig>; onStart: (config: Partial<GameConfig>) => void }) {
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
        </div>
        <button style={button} onClick={() => onStart({ targetPoints, doubleBalak })}>
          Main offline
        </button>
      </div>
    </div>
  );
}

/** Gabungkan nama kursi jadi satu daftar terpisah koma, untuk daftar juara 1/kalah di layar hasil. */
const namesFor = (seats: readonly number[]) => seats.map((seat) => SEAT_INFO[seat]!.name).join(', ');

function Table({
  config,
  onExit,
  onPlayAgain,
  onBackToMenu,
}: {
  config: Partial<GameConfig>;
  onExit: () => void;
  onPlayAgain: () => void;
  onBackToMenu: () => void;
}) {
  const { w, h } = useWindowSize();
  const [ready, setReady] = useState(false);
  const { state, start, play, canAct, summary, gameResult, redealNotice } = useOfflineGame();
  // State meja baru diisi setelah kanvas siap (ADR 0001).
  useEffect(() => {
    if (ready) start(config);
  }, [ready, config, start]);

  const askExit = () => {
    if (confirm('Keluar dari game yang sedang berjalan? Progres game ini akan hilang.')) onExit();
  };

  return (
    <>
      <Application resizeTo={window} antialias autoDensity resolution={Math.min(devicePixelRatio, 2)} background={0x1d6b45} onInit={() => setReady(true)}>
        {state && <Meja w={w} h={h} state={state} seats={SEAT_INFO} humanSeat={HUMAN_SEAT} canAct={canAct} onMove={play} />}
      </Application>
      {!gameResult && (
        <button
          onClick={askExit}
          style={{
            position: 'fixed',
            top: 12,
            left: 12,
            zIndex: 1,
            font: '600 13px system-ui',
            padding: '8px 16px',
            borderRadius: 999,
            border: 0,
            background: 'rgba(0,0,0,.5)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Keluar
        </button>
      )}
      {redealNotice && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '10px 20px',
            borderRadius: 999,
            background: 'rgba(0,0,0,.75)',
            color: '#fff',
            fontFamily: 'system-ui',
            fontSize: 14,
            pointerEvents: 'none',
          }}
        >
          Kartu dibagikan ulang: ada kursi dengan 5 balak atau lebih
        </div>
      )}
      {summary && (
        <div style={overlay}>
          <div style={{ textAlign: 'center', minWidth: 300 }}>
            <h2 style={{ fontSize: 30, margin: '0 0 20px' }}>
              {summary.cause.kind === 'emptyHand'
                ? summary.cause.winner === HUMAN_SEAT
                  ? 'Kamu menang sesi!'
                  : `${SEAT_INFO[summary.cause.winner]!.name} menang sesi`
                : `Gaplek ${summary.cause.pip}`}
            </h2>
            <table style={{ margin: '0 auto', borderCollapse: 'collapse', fontSize: 15 }}>
              <thead>
                <tr style={{ opacity: 0.7 }}>
                  <th style={{ padding: '2px 12px', textAlign: 'left' }} />
                  <th style={{ padding: '2px 12px' }}>Sisa kartu</th>
                  <th style={{ padding: '2px 12px' }}>Poin sesi</th>
                  <th style={{ padding: '2px 12px' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {summary.hands.map((hand, seat) => (
                  <tr key={seat}>
                    <td style={{ padding: '2px 12px', textAlign: 'left' }}>{SEAT_INFO[seat]!.name}</td>
                    <td style={{ padding: '2px 12px' }}>{hand.length}</td>
                    <td style={{ padding: '2px 12px' }}>{summary.sessionPoints[seat]}</td>
                    <td style={{ padding: '2px 12px' }}>{summary.totals[seat]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {gameResult && (
        <div style={overlay}>
          <div style={{ textAlign: 'center', minWidth: 300 }}>
            <h2 style={{ fontSize: 30, margin: '0 0 20px' }}>Game berakhir</h2>
            <p style={{ fontSize: 18, margin: '0 0 10px' }}>
              🏆 Juara 1:{' '}
              {gameResult.champions.length > 0 ? namesFor(gameResult.champions) : 'tidak ada, semua pemain kalah'}
            </p>
            <p style={{ fontSize: 15, opacity: 0.8, margin: '0 0 28px' }}>Kalah: {namesFor(gameResult.losers)}</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button style={button} onClick={onPlayAgain}>
                Main lagi
              </button>
              <button style={{ ...button, background: '#3a3a3a', color: '#fff' }} onClick={onBackToMenu}>
                Kembali ke menu
              </button>
            </div>
          </div>
        </div>
      )}
      {w < h && (
        <div style={{ ...overlay, zIndex: 3, background: '#123e2b', textAlign: 'center', padding: 24, boxSizing: 'border-box' }}>
          <div>
            <div aria-hidden="true" style={{ fontSize: 52, marginBottom: 12 }}>↻</div>
            <h2 style={{ fontSize: 24, margin: '0 0 8px' }}>Putar HP ke posisi landscape</h2>
            <p style={{ margin: 0, opacity: 0.8 }}>Meja dimainkan dalam posisi mendatar.</p>
          </div>
        </div>
      )}
    </>
  );
}

export function App() {
  const [screen, setScreen] = useState<'menu' | 'meja'>('menu');
  const [config, setConfig] = useState<Partial<GameConfig>>({});
  // Keluar dan "main lagi" kembali ke menu dengan target/balak ganda game ini tetap terisi (bisa diubah);
  // "kembali ke menu" mengatur ulang ke bawaan.
  const toMenuKeepConfig = () => setScreen('menu');
  return screen === 'menu' ? (
    <Menu
      initial={config}
      onStart={(cfg) => {
        setConfig(cfg);
        setScreen('meja');
      }}
    />
  ) : (
    <Table
      config={config}
      onExit={toMenuKeepConfig}
      onPlayAgain={toMenuKeepConfig}
      onBackToMenu={() => {
        setConfig({});
        setScreen('menu');
      }}
    />
  );
}
