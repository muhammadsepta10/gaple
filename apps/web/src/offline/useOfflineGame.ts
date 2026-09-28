import {
  applyMove, chooseMove, nextSession, seatView, seededRandom, startGame,
  type Card, type GameConfig, type GameEvent, type GameResult, type GameState,
  type Move, type Seat, type SessionEndCause,
} from '@gaple/aturan';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Suara } from '../audio/suara';
import { DURASI } from '../durasi';
import type { Presentation, PresentationEvent } from '../presentasi';

export const HUMAN_SEAT: Seat = 0;

export type SessionSummary = {
  readonly cause: SessionEndCause;
  readonly hands: readonly (readonly Card[])[];
  readonly sessionPoints: readonly number[];
  readonly totals: readonly number[];
};

const randomSeed = () => Math.floor(Math.random() * 2 ** 32);

function wait(ms: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      resolve(ok);
    };
    const abort = () => finish(false);
    const timer = setTimeout(() => finish(true), ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

function dealClicks(audio: Suara, signal: AbortSignal) {
  const timers = Array.from({ length: 28 }, (_, i) => setTimeout(() => {
    if (!signal.aborted) audio.dealClick();
  }, i * DURASI.jedaBagi));
  const cancel = () => timers.forEach(clearTimeout);
  signal.addEventListener('abort', cancel, { once: true });
  return () => { cancel(); signal.removeEventListener('abort', cancel); };
}

/** Event mesin dipresentasikan berurutan; input terkunci sampai rangkaian selesai. */
export function useOfflineGame(audio: Suara) {
  const [state, setState] = useState<GameState | null>(null);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [redealNotice, setRedealNotice] = useState(false);
  const stateRef = useRef<GameState | null>(null);
  const busyRef = useRef(false);
  const serial = useRef(0);
  const noticeSerial = useRef(0);
  const aborter = useRef(new AbortController());

  useEffect(() => () => aborter.current.abort(), []);

  const lock = (value: boolean) => { busyRef.current = value; setBusy(value); };
  const present = (event: PresentationEvent) => {
    setPresentation({ ...event, key: ++serial.current, at: performance.now() } as Presentation);
  };

  const runDeal = useCallback(async (next: GameState, events: readonly GameEvent[]) => {
    const signal = aborter.current.signal;
    lock(true);
    for (const event of events) {
      if (signal.aborted || event.type !== 'dealt') continue;
      setState({ ...next, session: { ...next.session, hands: event.hands } });
      present({ kind: 'deal' });
      if (event.redeal) {
        const notice = ++noticeSerial.current;
        setRedealNotice(true);
        void wait(DURASI.notifikasiBagiUlang, signal).then((alive) => { if (alive && notice === noticeSerial.current) setRedealNotice(false); });
      }
      const cancelClicks = dealClicks(audio, signal);
      const alive = await wait(DURASI.bagiTotal, signal);
      cancelClicks();
      if (!alive) return;
    }
    if (signal.aborted) return;
    stateRef.current = next;
    setState(next);
    setPresentation(null);
    lock(false);
  }, [audio]);

  const start = useCallback((config: Partial<GameConfig>) => {
    if (busyRef.current || stateRef.current) return;
    const { state: next, events } = startGame(config, seededRandom(randomSeed()));
    stateRef.current = next;
    setSummary(null);
    setGameResult(null);
    void runDeal(next, events);
  }, [runDeal]);

  const takeMove = useCallback(async (move: Move, human: boolean) => {
    const current = stateRef.current;
    if (!current || busyRef.current || current.session.result || current.session.turn !== move.seat || (human && move.seat !== HUMAN_SEAT)) return;
    const result = applyMove(current, move);
    if (!result.ok) return;
    lock(true);
    stateRef.current = result.state;
    setState(result.state);
    const signal = aborter.current.signal;
    const placed = result.events.find((e) => e.type === 'cardPlaced');
    if (!placed || placed.type !== 'cardPlaced') return;
    present({ kind: 'move', cardId: placed.card.id, seat: placed.seat });
    if (!await wait(DURASI.kartuTerbang, signal)) return;
    audio.cardLand();

    for (const event of result.events) {
      if (signal.aborted) return;
      if (event.type === 'cardPlaced' && event.balak) {
        present({ kind: 'balak', pip: event.card.a });
        audio.balak();
        if (!await wait(DURASI.balak, signal)) return;
      } else if (event.type === 'pass') {
        present({ kind: 'pass', seat: event.seat });
        audio.pass();
        if (!await wait(DURASI.pass, signal)) return;
      } else if (event.type === 'sessionEnded') {
        if (event.cause.kind === 'emptyHand') {
          present({ kind: 'win', seat: event.cause.winner });
          audio.winSession();
          if (!await wait(DURASI.menangSesi, signal)) return;
        } else {
          present({ kind: 'gaplek', pip: event.cause.pip });
          audio.gaplek();
          if (!await wait(DURASI.gaplek, signal)) return;
        }
        if (!result.state.result) {
          setPresentation(null);
          setSummary({ cause: event.cause, hands: event.hands, sessionPoints: event.sessionPoints, totals: event.totals });
          if (!await wait(DURASI.ringkasanSesi, signal)) return;
          const next = nextSession(result.state, seededRandom(randomSeed()));
          setSummary(null);
          await runDeal(next.state, next.events);
          return;
        }
      } else if (event.type === 'gameEnded') {
        if (event.result.champions.length) {
          present({ kind: 'champion' });
          audio.champion();
          if (!await wait(DURASI.juara, signal)) return;
        }
        setPresentation(null);
        setGameResult(event.result);
        lock(false);
        return;
      }
    }
    setPresentation(null);
    lock(false);
  }, [audio, runDeal]);

  const play = useCallback((move: Move) => { void takeMove(move, true); }, [takeMove]);

  useEffect(() => {
    if (!state || busy || state.session.result || state.session.turn === HUMAN_SEAT) return;
    const id = setTimeout(() => {
      const current = stateRef.current;
      if (current && !busyRef.current && current.session.turn !== HUMAN_SEAT) {
        void takeMove(chooseMove(seatView(current, current.session.turn)), false);
      }
    }, DURASI.botBerpikir);
    return () => clearTimeout(id);
  }, [state, busy, takeMove]);

  const canAct = !!state && !busy && !state.session.result && state.session.turn === HUMAN_SEAT;
  return { state, presentation, start, play, canAct, summary, gameResult, redealNotice };
}
