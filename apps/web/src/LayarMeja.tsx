import { Application } from '@pixi/react';
import { legalMoves, type GameResult, type GameState, type Move, type Seat } from '@gaple/aturan';
import { useEffect, useState } from 'react';
import { GAMBAR_MEJA, gambarMejaUrl, type GambarMeja } from './gambarMeja';
import { HasilAkhir } from './hasilAkhir';
import { Meja, type SeatInfo } from './meja/Meja';
import type { Presentation, SessionSummary } from './presentasi';
import { button, overlay } from './gaya';

/** Keluaran pengendali game (offline maupun online) yang ditampilkan meja. */
export type TampilanGame = {
  readonly state: GameState | null;
  readonly presentation: Presentation | null;
  readonly play: (move: Move) => void;
  readonly canAct: boolean;
  readonly summary: SessionSummary | null;
  readonly gameResult: GameResult | null;
  readonly redealNotice: boolean;
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

/** Meja beserta tombol, ringkasan ronde, dan hasil akhir; tidak bergantung pada pengendali mana pun. */
export function LayarMeja({
  game,
  seats,
  humanSeat,
  muted,
  onMute,
  gambar,
  onReady,
  exitConfirm,
  onExit,
  onPlayAgain,
  onBackToMenu,
}: {
  game: TampilanGame;
  seats: readonly SeatInfo[];
  humanSeat: Seat;
  muted: boolean;
  onMute: () => void;
  gambar: GambarMeja;
  onReady: () => void;
  exitConfirm: string;
  onExit: () => void;
  onPlayAgain?: () => void;
  onBackToMenu: () => void;
}) {
  const { w, h } = useWindowSize();
  const { state, presentation, play, canAct, summary, gameResult, redealNotice } = game;
  const askExit = () => {
    if (confirm(exitConfirm)) onExit();
  };

  return (
    <>
      <div data-testid="table-background" style={{ position: 'fixed', inset: 0, backgroundColor: GAMBAR_MEJA.find((item) => item.id === gambar)!.color, backgroundImage: `url("${gambarMejaUrl(gambar)}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <Application resizeTo={window} antialias autoDensity resolution={Math.min(devicePixelRatio, 2)} backgroundAlpha={0} onInit={onReady}>
          {state && <Meja w={w} h={h} state={state} seats={seats} humanSeat={humanSeat} canAct={canAct} presentation={presentation} onMove={play} />}
        </Application>
      </div>
      {state && canAct && (
        <div role="group" aria-label="Langkah tersedia" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>
          {legalMoves(state).filter((move) => move.seat === humanSeat).map((move) => (
            <button key={`${move.cardId}-${move.end}`} data-testid="legal-move" onClick={() => play(move)}>
              Pasang {move.cardId} ke {move.end === 'left' ? 'kiri' : 'kanan'}
            </button>
          ))}
        </div>
      )}
      <button onClick={onMute} aria-label={muted ? 'Aktifkan suara' : 'Senyapkan suara'} title={muted ? 'Aktifkan suara' : 'Senyapkan suara'}
        style={{ position: 'fixed', top: 12, right: 12, zIndex: 2, ...button, padding: '8px 14px', fontSize: 18,
          background: 'rgba(0,0,0,.65)', color: '#fff' }}>
        {muted ? '🔇' : '🔊'}
      </button>
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
        <div data-testid="session-summary" style={overlay}>
          <div style={{ textAlign: 'center', minWidth: 300 }}>
            <h2 style={{ fontSize: 30, margin: '0 0 20px' }}>
              {summary.cause.kind === 'emptyHand'
                ? `${seats[summary.cause.winner]!.name} Menang!`
                : `Gaplek ${summary.cause.pip}`}
            </h2>
            <table style={{ margin: '0 auto', borderCollapse: 'collapse', fontSize: 15 }}>
              <thead>
                <tr style={{ opacity: 0.7 }}>
                  <th style={{ padding: '2px 12px', textAlign: 'left' }} />
                  <th style={{ padding: '2px 12px' }}>Sisa kartu</th>
                  <th style={{ padding: '2px 12px' }}>Poin ronde</th>
                  <th style={{ padding: '2px 12px' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {summary.hands.map((hand, seat) => (
                  <tr key={seat}>
                    <td style={{ padding: '2px 12px', textAlign: 'left' }}>{seats[seat]!.name}</td>
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
      {gameResult && state && <HasilAkhir result={gameResult} totals={state.totals} seats={seats}
        onPlayAgain={onPlayAgain} onBackToMenu={onBackToMenu} />}
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
