import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applyMove, chooseMove, legalMoves, nextSession, seatView, seededRandom, startGame, type GameState } from '../src/index';

const MAX_STEPS = 5_000;

const cardCount = (state: GameState): number =>
  state.session.hands.reduce((n, h) => n + h.length, 0) + state.session.chain.placements.length;

describe('properti: game acak dimainkan empat bot', () => {
  it('selalu berakhir, 28 kartu, langkah bot selalu legal, total tidak pernah turun', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 32 - 1 }),
        fc.integer({ min: 1, max: 150 }),
        fc.boolean(),
        (seed, targetPoints, doubleBalak) => {
          const random = seededRandom(seed);
          let state = startGame({ targetPoints, doubleBalak }, random).state;
          let steps = 0;
          while (!state.result) {
            expect(++steps).toBeLessThan(MAX_STEPS);
            if (state.session.result) {
              const next = nextSession(state, random).state;
              expect(next.totals).toEqual(state.totals);
              state = next;
              continue;
            }
            expect(cardCount(state)).toBe(28);
            const move = chooseMove(seatView(state, state.session.turn));
            expect(legalMoves(state)).toContainEqual(move);
            const r = applyMove(state, move);
            if (!r.ok) throw new Error(r.reason);
            r.state.totals.forEach((t, i) => expect(t).toBeGreaterThanOrEqual(state.totals[i]!));
            state = r.state;
          }
          expect(cardCount(state)).toBe(28);
          expect(state.totals.some((t) => t >= targetPoints)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });
});
