import { SEATS, type GameResult, type Seat } from '@gaple/aturan';
import type { SeatInfo } from './meja/Meja';

/** Juara bersama tetap berdampingan; pemain kalah selalu berada setelah pemain lain. */
export function rankedFinalSeats(result: GameResult, totals: readonly number[]): Seat[] {
  const champions = new Set(result.champions);
  const losers = new Set(result.losers);
  const group = (seat: Seat) => champions.has(seat) ? 0 : losers.has(seat) ? 2 : 1;
  return [...SEATS].sort((a, b) => group(a) - group(b) || totals[a]! - totals[b]! || a - b);
}

export function HasilAkhir({ result, totals, seats, onPlayAgain, onBackToMenu }: {
  result: GameResult;
  totals: readonly number[];
  seats: readonly SeatInfo[];
  /** Tanpa ini tombol "Main lagi" disembunyikan. */
  onPlayAgain?: () => void;
  onBackToMenu: () => void;
}) {
  const ranked = rankedFinalSeats(result, totals);
  return (
    <div data-testid="final-score" style={{
      position: 'fixed', inset: 0, display: 'grid', placeItems: 'center',
      background: 'rgba(0,0,0,.7)', color: '#fff', fontFamily: 'system-ui',
    }}>
      <div style={{ width: 'min(92vw, 440px)', maxHeight: 'calc(100dvh - 20px)', overflowY: 'auto', boxSizing: 'border-box',
        padding: '18px 20px', borderRadius: 18, background: '#101e1b', border: '1px solid #496354',
        boxShadow: '0 18px 50px #0008' }}>
        <h2 style={{ fontSize: 25, margin: '0 0 14px', textAlign: 'center' }}>Skor akhir</h2>
        {result.champions.length === 0 &&
          <p style={{ margin: '-5px 0 12px', textAlign: 'center', color: '#ffb3a9' }}>Semua pemain kalah</p>}
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
          {ranked.map((seat) => {
            const champion = result.champions.includes(seat);
            const loser = result.losers.includes(seat);
            return (
              <li key={seat} data-testid="final-score-row" data-seat={seat} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                minHeight: 40, padding: '5px 12px', boxSizing: 'border-box', borderRadius: 10,
                background: champion ? '#493917' : loser ? '#2b1e1c' : '#20312c',
                border: champion ? '1px solid #d5af48' : '1px solid #ffffff18',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <strong>{seats[seat]!.name}</strong>
                  {champion && <span style={{ color: '#ffe08a', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>Juara 1</span>}
                  {loser && <span style={{ color: '#ffb3a9', fontSize: 12, fontWeight: 700 }}>Kalah</span>}
                </span>
                <strong style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{totals[seat]} poin</strong>
              </li>
            );
          })}
        </ol>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
          {onPlayAgain && <button style={{ border: 0, borderRadius: 999, padding: '10px 18px', background: '#ffd54a',
            color: '#3a2a05', font: '700 14px system-ui', cursor: 'pointer' }} onClick={onPlayAgain}>
            Main lagi
          </button>}
          <button style={{ border: 0, borderRadius: 999, padding: '10px 18px', background: '#35413d',
            color: '#fff', font: '700 14px system-ui', cursor: 'pointer' }} onClick={onBackToMenu}>
            Kembali ke menu
          </button>
        </div>
      </div>
    </div>
  );
}
