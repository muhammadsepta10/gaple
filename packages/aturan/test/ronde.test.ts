import { describe, expect, it } from 'vitest';
import { applyMove, legalMoves, otherPip, seededRandom, startGame, type GameState, type Seat } from '../src/index';

const holderOf = (state: GameState, id: string): Seat =>
  state.session.hands.findIndex((h) => h.some((c) => c.id === id)) as Seat;

describe('pembagian kartu', () => {
  it('membagikan 28 kartu unik, 7 per kursi', () => {
    const { state } = startGame({}, seededRandom(1));
    const hands = state.session.hands;
    expect(hands).toHaveLength(4);
    for (const hand of hands) expect(hand).toHaveLength(7);
    const ids = hands.flat().map((c) => c.id);
    expect(new Set(ids).size).toBe(28);
    for (const c of hands.flat()) {
      expect(c.a).toBeLessThanOrEqual(c.b);
      expect(c.id).toBe(`${c.a}-${c.b}`);
    }
  });
});

describe('determinisme', () => {
  it('seed sama menghasilkan pembagian dan event yang sama', () => {
    const a = startGame({}, seededRandom(42));
    const b = startGame({}, seededRandom(42));
    expect(b.state).toEqual(a.state);
    expect(b.events).toEqual(a.events);
    expect(a.events[0]).toMatchObject({ type: 'dealt', session: 1, redeal: false });
    expect(JSON.parse(JSON.stringify(a.state))).toEqual(a.state);
  });

  it('seed sama menghasilkan urutan event yang sama sampai ronde berakhir', () => {
    const play = () => {
      const start = startGame({}, seededRandom(99));
      const rest = playOut(start.state);
      return [...start.events, ...rest.events];
    };
    const a = play();
    expect(play()).toEqual(a);
    expect(a.at(-1)!.type).toBe('sessionEnded');
  });

  it('seed berbeda menghasilkan pembagian berbeda', () => {
    const a = startGame({}, seededRandom(1));
    const b = startGame({}, seededRandom(2));
    expect(b.state.session.hands).not.toEqual(a.state.session.hands);
  });
});

describe('pembuka ronde pertama', () => {
  it('pemegang 0–0 mendapat giliran pertama dan hanya boleh membuka dengan 0–0', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { state } = startGame({}, seededRandom(seed));
      expect(state.session.turn).toBe(holderOf(state, '0-0'));
      expect(legalMoves(state)).toEqual([{ seat: state.session.turn, cardId: '0-0', end: 'left' }]);
    }
  });
});

describe('memasang kartu', () => {
  it('membuka dengan 0–0 memindahkan kartu ke rantai dan memberi giliran ke kursi berikutnya', () => {
    const { state } = startGame({}, seededRandom(7));
    const opener = state.session.turn;
    const result = applyMove(state, { seat: opener, cardId: '0-0', end: 'left' });
    if (!result.ok) throw new Error(result.reason);
    const next = result.state.session;
    expect(next.hands[opener]!.map((c) => c.id)).not.toContain('0-0');
    expect(next.hands[opener]).toHaveLength(6);
    expect(next.chain.ends).toEqual({ left: 0, right: 0 });
    expect(result.events[0]).toEqual({
      type: 'cardPlaced',
      seat: opener,
      card: { id: '0-0', a: 0, b: 0 },
      end: 'left',
      balak: true,
    });
    // giliran searah jarum jam: bawah(0) → kiri(1) → atas(2) → kanan(3)
    const passed = result.events.filter((e) => e.type === 'pass').map((e) => e.seat);
    const expected: Seat[] = [];
    let s = ((opener + 1) % 4) as Seat;
    while (!next.hands[s]!.some((c) => c.a === 0)) {
      expected.push(s);
      s = ((s + 1) % 4) as Seat;
    }
    expect(passed).toEqual(expected);
    expect(next.turn).toBe(s);
  });

  it('kartu tersambung pada nilai ujung yang cocok', () => {
    const { state } = startGame({}, seededRandom(7));
    let st = state;
    for (let i = 0; i < 4; i++) {
      const move = legalMoves(st)[0]!;
      const card = st.session.hands[move.seat]!.find((c) => c.id === move.cardId)!;
      const before = st.session.chain.ends;
      const r = applyMove(st, move);
      if (!r.ok) throw new Error(r.reason);
      st = r.state;
      if (before) {
        const open = otherPip(card, before[move.end]);
        expect(st.session.chain.ends![move.end]).toBe(open);
        const other = move.end === 'left' ? 'right' : 'left';
        expect(st.session.chain.ends![other]).toBe(before[other]);
      }
    }
    expect(st.session.chain.placements).toHaveLength(4);
  });
});

describe('aksi ilegal', () => {
  const opened = () => {
    const { state } = startGame({}, seededRandom(7));
    const r = applyMove(state, { seat: state.session.turn, cardId: '0-0', end: 'left' });
    if (!r.ok) throw new Error(r.reason);
    return r.state;
  };

  const expectRejected = (state: GameState, move: Parameters<typeof applyMove>[1], reason: string) => {
    const snapshot = JSON.parse(JSON.stringify(state));
    const r = applyMove(state, move);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe(reason);
    expect(r.state).toBe(state);
    expect(state).toEqual(snapshot);
  };

  it('menolak aksi di luar giliran', () => {
    const state = opened();
    const other = ((state.session.turn + 1) % 4) as Seat;
    const cardId = state.session.hands[other]![0]!.id;
    expectRejected(state, { seat: other, cardId, end: 'left' }, 'not-your-turn');
  });

  it('menolak kartu yang bukan milik kursi', () => {
    const state = opened();
    const seat = state.session.turn;
    const other = ((seat + 1) % 4) as Seat;
    const cardId = state.session.hands[other]![0]!.id;
    expectRejected(state, { seat, cardId, end: 'left' }, 'card-not-in-hand');
  });

  it('menolak kartu yang tidak cocok di ujung yang dipilih', () => {
    const state = opened();
    const seat = state.session.turn;
    const misfit = state.session.hands[seat]!.find((c) => c.a !== 0 && c.b !== 0);
    if (!misfit) throw new Error('seed tidak cocok untuk uji ini');
    expectRejected(state, { seat, cardId: misfit.id, end: 'right' }, 'card-does-not-fit');
  });

  it('menolak pembuka ronde pertama selain 0–0', () => {
    const { state } = startGame({}, seededRandom(7));
    const seat = state.session.turn;
    const cardId = state.session.hands[seat]!.find((c) => c.id !== '0-0')!.id;
    expectRejected(state, { seat, cardId, end: 'left' }, 'must-open-with-balak');
  });
});

/** Memainkan ronde dengan langkah legal pertama sampai tidak ada kursi yang harus memilih. */
function playOut(state: GameState) {
  const events = [];
  let st = state;
  for (let guard = 0; guard < 100; guard++) {
    const move = legalMoves(st)[0];
    if (!move) return { state: st, events };
    const r = applyMove(st, move);
    if (!r.ok) throw new Error(r.reason);
    st = r.state;
    events.push(...r.events);
  }
  throw new Error('ronde tidak berakhir');
}

describe('akhir ronde', () => {
  it('berakhir saat seorang pemain menghabiskan kartunya, dan event menyebut pemenangnya', () => {
    let found = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const { state } = startGame({}, seededRandom(seed));
      const end = playOut(state);
      const last = end.events.at(-1)!;
      expect(last.type).toBe('sessionEnded');
      if (last.type !== 'sessionEnded' || last.cause.kind !== 'emptyHand') continue;
      found++;
      const winner = last.cause.winner;
      expect(end.state.session.hands[winner]).toHaveLength(0);
      expect(end.events.at(-2)).toMatchObject({ type: 'cardPlaced', seat: winner });
      expect(last.hands).toEqual(end.state.session.hands);
      expect(end.state.session.result).toEqual(last.cause);
    }
    expect(found).toBeGreaterThan(0);
  });

  it('menolak aksi setelah ronde berakhir', () => {
    const { state } = startGame({}, seededRandom(3));
    const end = playOut(state).state;
    expect(legalMoves(end)).toEqual([]);
    const seat = end.session.turn;
    const cardId = end.session.hands.flat()[0]!.id;
    const r = applyMove(end, { seat, cardId, end: 'left' });
    expect(r).toMatchObject({ ok: false, reason: 'session-over' });
  });
});

describe('pass otomatis', () => {
  it('kursi tanpa kartu cocok dilewati dengan event pass, dan giliran jatuh ke kursi yang punya langkah', () => {
    let passes = 0;
    for (let seed = 1; seed <= 20; seed++) {
      let st = startGame({}, seededRandom(seed)).state;
      for (let move = legalMoves(st)[0]; move; move = legalMoves(st)[0]) {
        const r = applyMove(st, move);
        if (!r.ok) throw new Error(r.reason);
        const { left, right } = r.state.session.chain.ends!;
        let expected = ((move.seat + 1) % 4) as Seat;
        for (const e of r.events.filter((e) => e.type === 'pass')) {
          passes++;
          expect(e.seat).toBe(expected);
          const hand = r.state.session.hands[e.seat]!;
          expect(hand.some((c) => [c.a, c.b].some((v) => v === left || v === right))).toBe(false);
          expected = ((expected + 1) % 4) as Seat;
        }
        if (!r.state.session.result) {
          expect(r.state.session.turn).toBe(expected);
          expect(legalMoves(r.state).length).toBeGreaterThan(0);
        }
        st = r.state;
      }
    }
    expect(passes).toBeGreaterThan(0);
  });
});

describe('pilihan ujung', () => {
  it('kartu yang cocok di kedua ujung punya dua langkah legal, satu per ujung', () => {
    let checked = 0;
    for (let seed = 1; seed <= 20; seed++) {
      let st = startGame({}, seededRandom(seed)).state;
      for (let move = legalMoves(st)[0]; move; move = legalMoves(st)[0]) {
        const ends = st.session.chain.ends;
        if (ends) {
          for (const c of st.session.hands[st.session.turn]!) {
            const fitsLeft = c.a === ends.left || c.b === ends.left;
            const fitsRight = c.a === ends.right || c.b === ends.right;
            const endsFor = legalMoves(st).filter((m) => m.cardId === c.id).map((m) => m.end);
            expect(endsFor).toEqual([...(fitsLeft ? ['left'] : []), ...(fitsRight ? ['right'] : [])]);
            if (fitsLeft && fitsRight) checked++;
          }
        }
        const r = applyMove(st, move);
        if (!r.ok) throw new Error(r.reason);
        st = r.state;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
