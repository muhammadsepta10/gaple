import { applyMove, legalMoves, seededRandom, startGame, type GameState, type Move, type Seat } from '@gaple/aturan';
import { useCallback, useEffect, useState } from 'react';
import { DURASI } from '../durasi';

export const HUMAN_SEAT: Seat = 0;

/**
 * Pengendali game offline: memegang state mesin di memori, meneruskan aksi pemain,
 * dan menjalankan bot (sementara: langkah legal pertama) setelah jeda berpikir.
 */
export function useOfflineGame() {
  const [state, setState] = useState<GameState | null>(null);

  const start = useCallback(() => {
    const seed = Math.floor(Math.random() * 2 ** 32);
    setState(startGame({}, seededRandom(seed)).state);
  }, []);

  const play = useCallback((move: Move) => {
    setState((s) => {
      if (!s) return s;
      const r = applyMove(s, move);
      return r.ok ? r.state : s;
    });
  }, []);

  useEffect(() => {
    if (!state || state.session.result || state.session.turn === HUMAN_SEAT) return;
    const id = setTimeout(() => {
      const move = legalMoves(state)[0];
      if (move) play(move);
    }, DURASI.botBerpikir);
    return () => clearTimeout(id);
  }, [state, play]);

  const canAct = !!state && !state.session.result && state.session.turn === HUMAN_SEAT;
  return { state, start, play, canAct };
}
