import {
  applyMove,
  chooseMove,
  nextSession,
  seatView,
  seededRandom,
  startGame,
  type Card,
  type GameConfig,
  type GameEvent,
  type GameResult,
  type GameState,
  type Move,
  type Seat,
  type SessionEndCause,
} from '@gaple/aturan';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DURASI } from '../durasi';

export const HUMAN_SEAT: Seat = 0;

/** Ringkasan sesi yang baru berakhir, untuk ditampilkan sebelum sesi berikutnya dimulai otomatis. */
export type SessionSummary = {
  readonly cause: SessionEndCause;
  readonly hands: readonly (readonly Card[])[];
  readonly sessionPoints: readonly number[];
  readonly totals: readonly number[];
};

const randomSeed = () => Math.floor(Math.random() * 2 ** 32);

/**
 * Pengendali game offline: memegang state mesin di memori, meneruskan aksi pemain,
 * dan menjalankan bot strategis (hanya melihat pandangan kursinya) setelah jeda berpikir.
 */
export function useOfflineGame() {
  const [state, setState] = useState<GameState | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [redealNotice, setRedealNotice] = useState(false);
  const redealTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flagRedeal = useCallback((events: readonly GameEvent[]) => {
    if (!events.some((e) => e.type === 'dealt' && e.redeal)) return;
    setRedealNotice(true);
    clearTimeout(redealTimer.current);
    redealTimer.current = setTimeout(() => setRedealNotice(false), DURASI.notifikasiBagiUlang);
  }, []);

  const start = useCallback(
    (config: Partial<GameConfig>) => {
      const { state, events } = startGame(config, seededRandom(randomSeed()));
      setState(state);
      setSummary(null);
      setGameResult(null);
      flagRedeal(events);
    },
    [flagRedeal],
  );

  const play = useCallback(
    (move: Move) => {
      if (!state) return;
      const r = applyMove(state, move);
      if (!r.ok) return;
      setState(r.state);
      const gameEnded = r.events.find((e) => e.type === 'gameEnded');
      if (gameEnded && gameEnded.type === 'gameEnded') {
        // Layar hasil akhir muncul langsung, tanpa ringkasan sesi lebih dulu.
        setGameResult(gameEnded.result);
        return;
      }
      const ended = r.events.find((e) => e.type === 'sessionEnded');
      if (ended && ended.type === 'sessionEnded') {
        setSummary({ cause: ended.cause, hands: ended.hands, sessionPoints: ended.sessionPoints, totals: ended.totals });
      }
    },
    [state],
  );

  useEffect(() => {
    if (!state || state.session.result || state.session.turn === HUMAN_SEAT) return;
    const id = setTimeout(() => {
      play(chooseMove(seatView(state, state.session.turn)));
    }, DURASI.botBerpikir);
    return () => clearTimeout(id);
  }, [state, play]);

  // Ringkasan sesi tampil sebentar, lalu sesi berikutnya dimulai otomatis (kecuali game sudah berakhir).
  useEffect(() => {
    if (!state || !state.session.result || state.result) return;
    const id = setTimeout(() => {
      const { state: next, events } = nextSession(state, seededRandom(randomSeed()));
      setState(next);
      setSummary(null);
      flagRedeal(events);
    }, DURASI.ringkasanSesi);
    return () => clearTimeout(id);
  }, [state, flagRedeal]);

  const canAct = !!state && !state.session.result && state.session.turn === HUMAN_SEAT;
  return { state, start, play, canAct, summary, gameResult, redealNotice };
}
