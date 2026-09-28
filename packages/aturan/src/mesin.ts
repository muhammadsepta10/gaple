import { shuffle, type Random } from './acak';
import { fullSet, isBalak, otherPip, type Card } from './kartu';

export type Seat = 0 | 1 | 2 | 3;

/** Semua kursi dalam urutan giliran searah jarum jam. */
export const SEATS: readonly Seat[] = [0, 1, 2, 3];

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

export type GameState = {
  readonly config: GameConfig;
  readonly session: SessionState;
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
    };

export type Transition = { readonly state: GameState; readonly events: readonly GameEvent[] };

const DEFAULT_CONFIG: GameConfig = { targetPoints: 100, doubleBalak: false };

export function startGame(config: Partial<GameConfig>, random: Random): Transition {
  const deck = shuffle(fullSet(), random);
  const hands = SEATS.map((i) => deck.slice(i * 7, i * 7 + 7));
  const opening: Opening = { kind: 'balak', pip: 0 };
  const turn = SEATS.find((s) => hands[s]!.some((c) => isBalak(c) && c.a === opening.pip))!;
  const session: SessionState = { number: 1, hands, chain: { placements: [], ends: null }, opening, turn, result: null };
  return {
    state: { config: { ...DEFAULT_CONFIG, ...config }, session },
    events: [{ type: 'dealt', session: 1, hands, redeal: false }],
  };
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
  let placement: Placement;
  let newEnds: { left: number; right: number };
  if (!ends) {
    placement = { seat: move.seat, card, end: 'left', open: card.a };
    newEnds = { left: card.a, right: card.b };
  } else {
    const open = otherPip(card, ends[move.end]);
    placement = { seat: move.seat, card, end: move.end, open };
    newEnds = { ...ends, [move.end]: open };
  }
  const hands = session.hands.map((h, i) => (i === move.seat ? h.filter((c) => c.id !== card.id) : h));
  const events: GameEvent[] = [{ type: 'cardPlaced', seat: move.seat, card, end: placement.end, balak: isBalak(card) }];
  let next: SessionState = {
    ...session,
    hands,
    chain: { placements: [...session.chain.placements, placement], ends: newEnds },
  };
  const end = (cause: SessionEndCause): MoveResult => {
    events.push({ type: 'sessionEnded', cause, hands });
    return { ok: true, state: { ...state, session: { ...next, result: cause } }, events };
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
