import { describe, expect, it } from 'vitest';
import {
  applyMove,
  isBalak,
  legalMoves,
  nextSession,
  seededRandom,
  startGame,
  type Card,
  type GameState,
  type MoveResult,
  type Seat,
  type SessionState,
} from '../src/index';

const c = (a: number, b: number): Card => ({ id: `${Math.min(a, b)}-${Math.max(a, b)}`, a: Math.min(a, b), b: Math.max(a, b) });

const balakCount = (hand: readonly Card[]) => hand.filter(isBalak).length;

/** Menerima hasil `applyMove` yang berhasil dan berakhir dengan sesi selesai. */
function endedEvent(r: MoveResult) {
  if (!r.ok) throw new Error(r.reason);
  const last = r.events.at(-1)!;
  if (last.type !== 'sessionEnded') throw new Error('sesi belum berakhir');
  return last;
}

/** State minimal untuk menguji akhir sesi dan poin secara langsung, tanpa melalui pembagian acak. */
function fixture(overrides: {
  hands: readonly (readonly Card[])[];
  doubleBalak?: boolean;
  totals?: readonly number[];
}): GameState {
  const session: SessionState = {
    number: 1,
    hands: overrides.hands,
    chain: { placements: [], ends: null },
    opening: { kind: 'free' },
    turn: 0,
    result: null,
  };
  return {
    config: { targetPoints: 100, doubleBalak: overrides.doubleBalak ?? false },
    totals: overrides.totals ?? [0, 0, 0, 0],
    session,
  };
}

describe('pembagian ulang (≥5 balak)', () => {
  it('mengulang pembagian dan menandai event dealt yang diulang', () => {
    // seed 10: pembagian pertama memberi kursi 0 lima balak; pembagian kedua sah.
    const { state, events } = startGame({}, seededRandom(10));
    const dealt = events.filter((e) => e.type === 'dealt');
    expect(dealt.length).toBeGreaterThanOrEqual(2);
    expect(dealt[0]).toMatchObject({ redeal: false });
    expect(balakCount(dealt[0]!.hands[0]!)).toBeGreaterThanOrEqual(5);
    expect(dealt.slice(1).every((e) => e.redeal)).toBe(true);
    for (const hand of state.session.hands) expect(balakCount(hand)).toBeLessThan(5);
    // pembagian final tetap 28 kartu unik, 7 per kursi.
    const ids = state.session.hands.flat().map((card) => card.id);
    expect(new Set(ids).size).toBe(28);
  });

  it('berlaku juga saat membagikan sesi lanjutan lewat nextSession', () => {
    const base = fixture({ hands: [[c(1, 2)], [c(3, 4)], [c(2, 5)], [c(0, 1)]] });
    const withResult: GameState = { ...base, session: { ...base.session, result: { kind: 'emptyHand', winner: 0 } } };
    // seed 10: pembagian pertama memberi kursi 0 lima balak; pembagian kedua sah (lihat tes di atas).
    const { state, events } = nextSession(withResult, seededRandom(10));
    const dealt = events.filter((e) => e.type === 'dealt');
    expect(dealt.length).toBeGreaterThanOrEqual(2);
    expect(dealt[0]).toMatchObject({ session: 2, redeal: false });
    expect(balakCount(dealt[0]!.hands[0]!)).toBeGreaterThanOrEqual(5);
    expect(dealt.slice(1).every((e) => e.redeal)).toBe(true);
    for (const hand of state.session.hands) expect(balakCount(hand)).toBeLessThan(5);
  });
});

describe('kartu habis sekaligus buntu', () => {
  it('menghasilkan menang sesi, bukan gaplek', () => {
    const session: SessionState = {
      number: 1,
      hands: [
        [c(5, 6)], // giliran; kartu terakhir, sekaligus tidak ada yang bisa lanjut 6/6
        [c(1, 2)],
        [c(3, 4)],
        [c(0, 1)],
      ],
      chain: { placements: [{ seat: 3, card: c(6, 6), end: 'left', open: 6 }], ends: { left: 6, right: 6 } },
      opening: { kind: 'free' },
      turn: 0,
      result: null,
    };
    const state: GameState = { config: { targetPoints: 100, doubleBalak: false }, totals: [0, 0, 0, 0], session };
    const r = applyMove(state, { seat: 0, cardId: '5-6', end: 'right' });
    expect(endedEvent(r)).toMatchObject({ type: 'sessionEnded', cause: { kind: 'emptyHand', winner: 0 } });
  });
});

describe('gaplek', () => {
  it('kedua ujung bernilai n, dan tidak ada kursi berlangkah legal', () => {
    let found = 0;
    for (let seed = 1; seed <= 60; seed++) {
      let st = startGame({}, seededRandom(seed)).state;
      for (let move = legalMoves(st)[0]; move; move = legalMoves(st)[0]) {
        const r = applyMove(st, move);
        if (!r.ok) throw new Error(r.reason);
        st = r.state;
        const ended = r.events.find((e) => e.type === 'sessionEnded');
        if (ended && ended.type === 'sessionEnded' && ended.cause.kind === 'gaplek') {
          found++;
          const pip = ended.cause.pip;
          const { left, right } = st.session.chain.ends!;
          expect(left).toBe(pip);
          expect(right).toBe(pip);
          for (const hand of ended.hands) {
            expect(hand.some((card) => card.a === pip || card.b === pip)).toBe(false);
          }
        }
      }
    }
    expect(found).toBeGreaterThan(0);
  });
});

describe('poin sesi', () => {
  it('balak 6 = 12 tanpa balak ganda, 24 dengan balak ganda; 4-4 ganda = 16', () => {
    const hands = [[c(0, 0)], [c(6, 6)], [c(4, 4)], [c(0, 1)]];
    const off = fixture({ hands });
    const endedOff = endedEvent(applyMove(off, { seat: 0, cardId: '0-0', end: 'left' }));
    expect(endedOff.sessionPoints[1]).toBe(12);

    const on = fixture({ hands, doubleBalak: true });
    const endedOn = endedEvent(applyMove(on, { seat: 0, cardId: '0-0', end: 'left' }));
    expect(endedOn.sessionPoints[1]).toBe(24);
    expect(endedOn.sessionPoints[2]).toBe(16);
  });

  it('balak 0 tidak mati jika masih ada kartu berangka 0 lain: Budi 0-0 dan 0-4 = 4', () => {
    const state = fixture({ hands: [[c(1, 2)], [c(3, 4)], [c(0, 0), c(0, 4)], [c(1, 5)]] });
    const ended = endedEvent(applyMove(state, { seat: 0, cardId: '1-2', end: 'left' }));
    expect(ended.sessionPoints[2]).toBe(4);
  });

  it('balak 0 mati (25) jika tidak ada kartu berangka 0 lain di meja: Budi 0-0 dan 3-5 = 33', () => {
    const state = fixture({ hands: [[c(1, 2)], [c(3, 4)], [c(0, 0), c(3, 5)], [c(1, 6)]] });
    const ended = endedEvent(applyMove(state, { seat: 0, cardId: '1-2', end: 'left' }));
    expect(ended.sessionPoints[2]).toBe(33);
  });

  it('balak 0 mati juga berlaku saat sesi berakhir karena gaplek, bukan hanya kartu habis', () => {
    const session: SessionState = {
      number: 1,
      hands: [
        [c(6, 2), c(1, 3)], // giliran; setelah main 6-2, masih pegang 1-3 (bukan menang sesi)
        [c(4, 5)],
        [c(0, 0), c(3, 5)],
        [c(1, 4)],
      ],
      chain: { placements: [{ seat: 3, card: c(6, 6), end: 'left', open: 6 }], ends: { left: 6, right: 6 } },
      opening: { kind: 'free' },
      turn: 0,
      result: null,
    };
    const state: GameState = { config: { targetPoints: 100, doubleBalak: false }, totals: [0, 0, 0, 0], session };
    const ended = endedEvent(applyMove(state, { seat: 0, cardId: '2-6', end: 'right' }));
    expect(ended.cause).toEqual({ kind: 'gaplek', pip: 6 });
    expect(ended.sessionPoints[2]).toBe(33);
  });

  it('pemenang sesi mendapat nol poin', () => {
    const state = fixture({ hands: [[c(1, 2)], [c(6, 6)], [c(2, 3)], [c(0, 1)]] });
    const ended = endedEvent(applyMove(state, { seat: 0, cardId: '1-2', end: 'left' }));
    expect(ended.sessionPoints[0]).toBe(0);
  });

  it('poin sesi ditambahkan ke total yang sudah ada', () => {
    const state = fixture({ hands: [[c(1, 2)], [c(6, 6)], [c(2, 3)], [c(0, 1)]], totals: [10, 20, 30, 40] });
    const r = applyMove(state, { seat: 0, cardId: '1-2', end: 'left' });
    const ended = endedEvent(r);
    expect(ended.totals).toEqual([10, 20 + ended.sessionPoints[1]!, 30 + ended.sessionPoints[2]!, 40 + ended.sessionPoints[3]!]);
    expect(r.ok && r.state.totals).toEqual(ended.totals);
  });
});

describe('pembuka sesi lanjutan', () => {
  it('pemenang sesi bebas memilih kartu apa pun untuk membuka sesi berikutnya', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const winner = (seed % 4) as Seat;
      const base = fixture({ hands: [[c(1, 2)], [c(3, 4)], [c(2, 5)], [c(0, 1)]] });
      const withResult: GameState = { ...base, session: { ...base.session, result: { kind: 'emptyHand', winner } } };
      const { state } = nextSession(withResult, seededRandom(seed));
      expect(state.session.number).toBe(2);
      expect(state.session.opening).toEqual({ kind: 'free' });
      expect(state.session.turn).toBe(winner);
      const moves = legalMoves(state);
      expect(moves).toHaveLength(state.session.hands[winner]!.length);
      expect(moves.every((m) => m.seat === winner && m.end === 'left')).toBe(true);
    }
  });

  it('setelah gaplek n, hanya balak n yang legal untuk pemegangnya', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const base = fixture({ hands: [[c(1, 2)], [c(3, 4)], [c(2, 5)], [c(0, 1)]] });
      const withResult: GameState = { ...base, session: { ...base.session, result: { kind: 'gaplek', pip: 6 } } };
      const { state } = nextSession(withResult, seededRandom(seed));
      const holder = state.session.hands.findIndex((h) => h.some((card) => card.id === '6-6')) as Seat;
      expect(state.session.opening).toEqual({ kind: 'balak', pip: 6 });
      expect(state.session.turn).toBe(holder);
      expect(legalMoves(state)).toEqual([{ seat: holder, cardId: '6-6', end: 'left' }]);
    }
  });

  it('menolak lanjut ke sesi berikutnya jika sesi berjalan belum berakhir', () => {
    const { state } = startGame({}, seededRandom(1));
    expect(() => nextSession(state, seededRandom(1))).toThrow();
  });
});
