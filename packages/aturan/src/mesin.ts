import { shuffle, type Random } from './acak';
import { fullSet, isBalak, otherPip, type Card } from './kartu';
import { SEATS, type Seat } from './kursi';
import { sessionPoints } from './poin';

export { SEATS, type Seat } from './kursi';

export type GameConfig = { readonly targetPoints: number; readonly doubleBalak: boolean };

export type End = 'left' | 'right';

/** Aksi pemain: pasang kartu di ujung susunan. Saat rantai kosong, ujung selalu 'left'. */
export type Move = { readonly seat: Seat; readonly cardId: string; readonly end: End };

/** Aturan pembuka sesi: wajib balak tertentu, atau bebas (pemenang sesi sebelumnya). */
export type Opening = { readonly kind: 'balak'; readonly pip: number } | { readonly kind: 'free' };

/** Satu kartu di rantai, dalam urutan pemasangan. `open` = nilai ujung terbuka yang dihasilkan kartu ini. */
export type Placement = { readonly seat: Seat; readonly card: Card; readonly end: End; readonly open: number };

export type Chain = {
  readonly placements: readonly Placement[];
  /** Nilai kedua ujung susunan; `null` saat rantai kosong. */
  readonly ends: { readonly left: number; readonly right: number } | null;
};

export type SessionState = {
  /** Nomor sesi dalam game, mulai dari 1. */
  readonly number: number;
  readonly hands: readonly (readonly Card[])[];
  readonly chain: Chain;
  readonly opening: Opening;
  readonly turn: Seat;
  /** Hasil sesi; `null` selama sesi berjalan. */
  readonly result: SessionEndCause | null;
};

/** Sebab sesi berakhir. Kartu habis diperiksa sebelum gaplek. */
export type SessionEndCause = { readonly kind: 'emptyHand'; readonly winner: Seat } | { readonly kind: 'gaplek'; readonly pip: number };

/** Hasil game: kursi juara 1 (bisa bersama, atau kosong jika semua kalah) dan kursi yang kalah. */
export type GameResult = { readonly champions: readonly Seat[]; readonly losers: readonly Seat[] };

export type GameState = {
  readonly config: GameConfig;
  /** Total poin terakumulasi per kursi dalam game ini. */
  readonly totals: readonly number[];
  readonly session: SessionState;
  /** Hasil game; `null` selama game berjalan. */
  readonly result: GameResult | null;
};

export type GameEvent =
  | {
      readonly type: 'dealt';
      readonly session: number;
      readonly hands: readonly (readonly Card[])[];
      /** Benar jika pembagian ini hasil pembagian ulang. */
      readonly redeal: boolean;
    }
  | { readonly type: 'cardPlaced'; readonly seat: Seat; readonly card: Card; readonly end: End; readonly balak: boolean }
  | { readonly type: 'pass'; readonly seat: Seat }
  | {
      readonly type: 'sessionEnded';
      readonly cause: SessionEndCause;
      /** Sisa kartu setiap kursi saat sesi berakhir. */
      readonly hands: readonly (readonly Card[])[];
      /** Poin sesi per kursi (balak ganda dan balak 0 mati sudah diperhitungkan). */
      readonly sessionPoints: readonly number[];
      /** Total poin per kursi setelah poin sesi ini ditambahkan. */
      readonly totals: readonly number[];
    }
  | { readonly type: 'gameEnded'; readonly result: GameResult };

export type Transition = { readonly state: GameState; readonly events: readonly GameEvent[] };

const DEFAULT_CONFIG: GameConfig = { targetPoints: 100, doubleBalak: false };

const hasFiveOrMoreBalak = (hand: readonly Card[]): boolean => hand.filter(isBalak).length >= 5;

/**
 * Hasil game setelah total kursi diperbarui, atau `null` jika belum ada yang mencapai atau melewati target.
 * Kursi yang mencapai atau melewati target kalah; juara 1 adalah kursi bertotal terendah di antara sisanya
 * (bisa bersama), atau tidak ada juara 1 jika semua kursi kalah.
 */
function gameResultFor(totals: readonly number[], targetPoints: number): GameResult | null {
  const losers = SEATS.filter((s) => totals[s]! >= targetPoints);
  if (losers.length === 0) return null;
  const contenders = SEATS.filter((s) => !losers.includes(s));
  if (contenders.length === 0) return { champions: [], losers };
  const lowest = Math.min(...contenders.map((s) => totals[s]!));
  return { champions: contenders.filter((s) => totals[s] === lowest), losers };
}

/** Membagikan 28 kartu untuk satu sesi, mengulang jika ada kursi dengan ≥5 balak. */
function dealSession(sessionNumber: number, random: Random): { hands: Card[][]; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let hands: Card[][];
  let attempt = 0;
  do {
    const deck = shuffle(fullSet(), random);
    hands = SEATS.map((i) => deck.slice(i * 7, i * 7 + 7));
    events.push({ type: 'dealt', session: sessionNumber, hands, redeal: attempt > 0 });
    attempt++;
  } while (hands.some(hasFiveOrMoreBalak));
  return { hands, events };
}

export function startGame(config: Partial<GameConfig>, random: Random): Transition {
  const { hands, events } = dealSession(1, random);
  const opening: Opening = { kind: 'balak', pip: 0 };
  const turn = SEATS.find((s) => hands[s]!.some((c) => isBalak(c) && c.a === opening.pip))!;
  const session: SessionState = { number: 1, hands, chain: { placements: [], ends: null }, opening, turn, result: null };
  const totals = SEATS.map(() => 0);
  return { state: { config: { ...DEFAULT_CONFIG, ...config }, totals, session, result: null }, events };
}

/**
 * Memulai sesi berikutnya dalam game yang sama, setelah sesi sebelumnya berakhir.
 * Pembuka: bebas memilih kartu untuk pemenang sesi, atau wajib balak n untuk pemegangnya setelah gaplek n.
 */
export function nextSession(state: GameState, random: Random): Transition {
  if (state.result) throw new Error('game sudah berakhir');
  const cause = state.session.result;
  if (!cause) throw new Error('sesi belum berakhir');
  const number = state.session.number + 1;
  const { hands, events } = dealSession(number, random);
  const opening: Opening = cause.kind === 'emptyHand' ? { kind: 'free' } : { kind: 'balak', pip: cause.pip };
  const turn: Seat =
    cause.kind === 'emptyHand' ? cause.winner : SEATS.find((s) => hands[s]!.some((c) => isBalak(c) && c.a === cause.pip))!;
  const session: SessionState = { number, hands, chain: { placements: [], ends: null }, opening, turn, result: null };
  return { state: { ...state, session }, events };
}

/** Nilai kedua ujung setelah `card` dipasang di `end`; pada rantai kosong kartu menjadi kedua ujung. */
export function endsAfter(ends: Chain['ends'], card: Card, end: End): { left: number; right: number } {
  if (!ends) return { left: card.a, right: card.b };
  return { ...ends, [end]: otherPip(card, ends[end]) };
}

export function legalMoves(state: GameState): Move[] {
  const session = state.session;
  if (session.result) return [];
  return movesFor(session, session.turn);
}

function movesFor(session: SessionState, turn: Seat): Move[] {
  const { hands, chain, opening } = session;
  const hand = hands[turn]!;
  if (!chain.ends) {
    const allowed = opening.kind === 'free' ? hand : hand.filter((c) => isBalak(c) && c.a === opening.pip);
    return allowed.map((c) => ({ seat: turn, cardId: c.id, end: 'left' }));
  }
  const { left, right } = chain.ends;
  const moves: Move[] = [];
  for (const c of hand) {
    if (c.a === left || c.b === left) moves.push({ seat: turn, cardId: c.id, end: 'left' });
    if (c.a === right || c.b === right) moves.push({ seat: turn, cardId: c.id, end: 'right' });
  }
  return moves;
}

export type RejectReason = 'session-over' | 'not-your-turn' | 'card-not-in-hand' | 'must-open-with-balak' | 'card-does-not-fit';

export type MoveResult =
  | ({ readonly ok: true } & Transition)
  | { readonly ok: false; readonly reason: RejectReason; readonly state: GameState };

const nextSeat = (seat: Seat): Seat => ((seat + 1) % 4) as Seat;

export function applyMove(state: GameState, move: Move): MoveResult {
  const session = state.session;
  const reject = (reason: RejectReason): MoveResult => ({ ok: false, reason, state });
  if (session.result) return reject('session-over');
  if (move.seat !== session.turn) return reject('not-your-turn');
  const card = session.hands[move.seat]!.find((c) => c.id === move.cardId);
  if (!card) return reject('card-not-in-hand');
  const legal = legalMoves(state);
  if (!legal.some((m) => m.cardId === card.id && (m.end === move.end || !session.chain.ends))) {
    return reject(session.chain.ends || session.opening.kind === 'free' ? 'card-does-not-fit' : 'must-open-with-balak');
  }
  const ends = session.chain.ends;
  const newEnds = endsAfter(ends, card, move.end);
  const placement: Placement = ends
    ? { seat: move.seat, card, end: move.end, open: newEnds[move.end] }
    : { seat: move.seat, card, end: 'left', open: card.a };
  const hands = session.hands.map((h, i) => (i === move.seat ? h.filter((c) => c.id !== card.id) : h));
  const events: GameEvent[] = [{ type: 'cardPlaced', seat: move.seat, card, end: placement.end, balak: isBalak(card) }];
  let next: SessionState = {
    ...session,
    hands,
    chain: { placements: [...session.chain.placements, placement], ends: newEnds },
  };
  const end = (cause: SessionEndCause): MoveResult => {
    const winner = cause.kind === 'emptyHand' ? cause.winner : null;
    const points = sessionPoints(hands, winner, state.config.doubleBalak);
    const totals = state.totals.map((t, i) => t + points[i]!);
    events.push({ type: 'sessionEnded', cause, hands, sessionPoints: points, totals });
    const result = gameResultFor(totals, state.config.targetPoints);
    if (result) events.push({ type: 'gameEnded', result });
    return { ok: true, state: { ...state, totals, result, session: { ...next, result: cause } }, events };
  };
  if (hands[move.seat]!.length === 0) return end({ kind: 'emptyHand', winner: move.seat });
  if (!SEATS.some((s) => movesFor(next, s).length > 0)) return end({ kind: 'gaplek', pip: newEnds.left });
  // Pass otomatis: lewati kursi tanpa langkah legal sampai ada kursi yang harus memilih.
  let turn = nextSeat(move.seat);
  while (movesFor(next, turn).length === 0) {
    events.push({ type: 'pass', seat: turn });
    turn = nextSeat(turn);
  }
  next = { ...next, turn };
  return { ok: true, state: { ...state, session: next }, events };
}
