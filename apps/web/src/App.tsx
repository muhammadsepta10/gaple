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

function useWindowSize() {
  const [size, setSize] = useState({ w: innerWidth, h: innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ w: innerWidth, h: innerHeight });
    addEventListener('resize', onResize);
    return () => removeEventListener('resize', onResize);
  }, []);
  return size;
}

function Menu({ onStart }: { onStart: (config: Partial<GameConfig>) => void }) {
  const [targetPoints, setTargetPoints] = useState(100);
  const [doubleBalak, setDoubleBalak] = useState(false);
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

function Table({ config }: { config: Partial<GameConfig> }) {
  const { w, h } = useWindowSize();
  const [ready, setReady] = useState(false);
  const { state, start, play, canAct, summary, redealNotice } = useOfflineGame();
  // State meja baru diisi setelah kanvas siap (ADR 0001).
  useEffect(() => {
    if (ready) start(config);
  }, [ready, config, start]);

  return (
    <>
      <Application resizeTo={window} antialias autoDensity resolution={Math.min(devicePixelRatio, 2)} background={0x1d6b45} onInit={() => setReady(true)}>
        {state && <Meja w={w} h={h} state={state} seats={SEAT_INFO} humanSeat={HUMAN_SEAT} canAct={canAct} onMove={play} />}
      </Application>
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
        <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.55)', color: '#fff', fontFamily: 'system-ui' }}>
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
    </>
  );
}

export function App() {
  const [screen, setScreen] = useState<'menu' | 'meja'>('menu');
  const [config, setConfig] = useState<Partial<GameConfig>>({});
  return screen === 'menu' ? (
    <Menu
      onStart={(cfg) => {
        setConfig(cfg);
        setScreen('meja');
      }}
    />
  ) : (
    <Table config={config} />
  );
}
