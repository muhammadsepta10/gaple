import { describe, expect, it } from 'vitest';
import {
  applyMove,
  legalMoves,
  SEATS,
  publicView,
  seatView,
  seededRandom,
  startGame,
  type GameState,
} from '../src/index';

/** Memainkan beberapa langkah pertama (langkah legal pertama) agar rantai terisi. */
function advance(state: GameState, steps: number): GameState {
  for (let i = 0; i < steps && !state.session.result; i++) {
    const r = applyMove(state, legalMoves(state)[0]!);
    if (!r.ok) throw new Error(r.reason);
    state = r.state;
  }
  return state;
}

const idsInJson = (value: unknown): string[] => [...JSON.stringify(value).matchAll(/"id":"(\d-\d)"/g)].map((m) => m[1]!);

describe('pandangan kursi', () => {
  it('memuat tangan sendiri, rantai, ujung, jumlah kartu lawan, total, dan riwayat publik', () => {
    const state = advance(startGame({}, seededRandom(7)).state, 5);
    const seat = state.session.turn;
    const view = seatView(state, seat);
    expect(view.seat).toBe(seat);
    expect(view.hand).toEqual(state.session.hands[seat]);
    expect(view.chain).toEqual(state.session.chain);
    expect(view.chain.ends).toEqual(state.session.chain.ends);
    expect(view.handCounts).toEqual(state.session.hands.map((h) => h.length));
    expect(view.totals).toEqual(state.totals);
    expect(view.chain.placements).toHaveLength(5);
    expect(view.turn).toBe(seat);
    expect(view.legalMoves).toEqual(legalMoves(state));
  });

  it('tidak memuat kartu tangan kursi lain', () => {
    for (const seed of [1, 2, 3]) {
      const state = advance(startGame({}, seededRandom(seed)).state, 6);
      for (const seat of SEATS) {
        const view = seatView(state, seat);
        const seen = new Set(idsInJson(view));
        for (const other of SEATS.filter((s) => s !== seat)) {
          for (const c of state.session.hands[other]!) expect(seen.has(c.id)).toBe(false);
        }
      }
    }
  });

  it('tidak memberi langkah legal saat bukan giliran kursi itu', () => {
    const state = startGame({}, seededRandom(3)).state;
    const other = SEATS.find((s) => s !== state.session.turn)!;
    expect(seatView(state, other).legalMoves).toEqual([]);
  });

  it('pandangan dapat diserialisasi', () => {
    const view = seatView(advance(startGame({}, seededRandom(5)).state, 4), 0);
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });
});

describe('pandangan publik (penonton)', () => {
  it('tidak memuat tangan siapa pun, hanya jumlahnya', () => {
    const state = advance(startGame({}, seededRandom(11)).state, 6);
    const view = publicView(state);
    const seen = new Set(idsInJson(view));
    for (const c of state.session.hands.flat()) expect(seen.has(c.id)).toBe(false);
    expect(view.handCounts).toEqual(state.session.hands.map((h) => h.length));
    expect(view.chain).toEqual(state.session.chain);
    expect(view.totals).toEqual(state.totals);
    expect(view).not.toHaveProperty('hand');
    expect(view).not.toHaveProperty('legalMoves');
  });
});
