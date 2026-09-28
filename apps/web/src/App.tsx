import { Application } from '@pixi/react';
import { useEffect, useState } from 'react';
import { Meja, type SeatInfo } from './meja/Meja';
import { HUMAN_SEAT, useOfflineGame } from './offline/useOfflineGame';

const SEATS: SeatInfo[] = [
  { name: 'Kamu', bot: false, points: 0 },
  { name: 'Budi', bot: true, points: 0 },
  { name: 'Agus', bot: true, points: 0 },
  { name: 'Joko', bot: true, points: 0 },
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

function Menu({ onStart }: { onStart: () => void }) {
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'system-ui' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 48, margin: '0 0 24px' }}>Gaple</h1>
        <button style={button} onClick={onStart}>Main offline</button>
      </div>
    </div>
  );
}

function Table({ onExit }: { onExit: () => void }) {
  const { w, h } = useWindowSize();
  const [ready, setReady] = useState(false);
  const { state, start, play, canAct } = useOfflineGame();
  // State meja baru diisi setelah kanvas siap (ADR 0001).
  useEffect(() => {
    if (ready) start();
  }, [ready, start]);

  const result = state?.session.result;
  return (
    <>
      <Application resizeTo={window} antialias autoDensity resolution={Math.min(devicePixelRatio, 2)} background={0x1d6b45} onInit={() => setReady(true)}>
        {state && <Meja w={w} h={h} state={state} seats={SEATS} humanSeat={HUMAN_SEAT} canAct={canAct} onMove={play} />}
      </Application>
      {result && (
        <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.55)', color: '#fff', fontFamily: 'system-ui' }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 36, margin: '0 0 20px' }}>
              {result.kind === 'emptyHand'
                ? result.winner === HUMAN_SEAT ? 'Kamu menang sesi!' : `${SEATS[result.winner]!.name} menang sesi`
                : `Gaplek ${result.pip}`}
            </h2>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button style={button} onClick={start}>Main lagi</button>
              <button style={{ ...button, background: '#fff' }} onClick={onExit}>Menu</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function App() {
  const [screen, setScreen] = useState<'menu' | 'meja'>('menu');
  return screen === 'menu' ? <Menu onStart={() => setScreen('meja')} /> : <Table onExit={() => setScreen('menu')} />;
}

