import type { Card } from './kartu';
import type { Seat } from './kursi';
import { legalMoves, type Chain, type GameConfig, type GameResult, type GameState, type Move, type Opening, type SessionEndCause } from './mesin';

/**
 * Pandangan publik (untuk Penonton): semua informasi publik tanpa tangan siapa pun.
 * Riwayat publik = `chain.placements` (urutan pemasangan kartu beserta kursinya).
 */
export type PublicView = {
  readonly config: GameConfig;
  readonly sessionNumber: number;
  readonly chain: Chain;
  readonly opening: Opening;
  readonly turn: Seat;
  /** Jumlah sisa kartu setiap kursi. */
  readonly handCounts: readonly number[];
  readonly totals: readonly number[];
  readonly sessionResult: SessionEndCause | null;
  readonly gameResult: GameResult | null;
};

/** Pandangan satu kursi: informasi publik ditambah tangan sendiri dan langkah legalnya. */
export type SeatView = PublicView & {
  readonly seat: Seat;
  readonly hand: readonly Card[];
  /** Langkah legal kursi ini; kosong jika bukan gilirannya. */
  readonly legalMoves: readonly Move[];
};

export function publicView(state: GameState): PublicView {
  const { session } = state;
  return {
    config: state.config,
    sessionNumber: session.number,
    chain: session.chain,
    opening: session.opening,
    turn: session.turn,
    handCounts: session.hands.map((h) => h.length),
    totals: state.totals,
    sessionResult: session.result,
    gameResult: state.result,
  };
}

export function seatView(state: GameState, seat: Seat): SeatView {
  const moves = state.session.turn === seat ? legalMoves(state) : [];
  return { ...publicView(state), seat, hand: state.session.hands[seat]!, legalMoves: moves };
}
