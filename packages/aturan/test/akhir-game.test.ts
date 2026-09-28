import { describe, expect, it } from 'vitest';
import { applyMove, nextSession, seededRandom, startGame, type Card, type GameState, type SessionState } from '../src/index';

const c = (a: number, b: number): Card => ({ id: `${Math.min(a, b)}-${Math.max(a, b)}`, a: Math.min(a, b), b: Math.max(a, b) });

/**
 * State minimal untuk menguji akhir game: kursi 0 menghabiskan kartu terakhirnya (`1-2` di ujung kiri
 * bernilai 1), sehingga ronde berakhir dengan kursi 0 sebagai pemenang. Kursi lain dibuat kosong agar
 * poin ronde mereka nol, sehingga totalnya sama persis dengan `totals` yang diberikan.
 */
function fixture(overrides: { totals: readonly number[]; targetPoints?: number }): GameState {
  const session: SessionState = {
    number: 1,
    hands: [[c(1, 2)], [], [], []],
    chain: { placements: [{ seat: 3, card: c(1, 1), end: 'left', open: 1 }], ends: { left: 1, right: 5 } },
    opening: { kind: 'free' },
    turn: 0,
    result: null,
  };
  return { config: { targetPoints: overrides.targetPoints ?? 100, doubleBalak: false }, totals: overrides.totals, session, result: null };
}

const endGame = (totals: readonly number[], targetPoints = 100) => applyMove(fixture({ totals, targetPoints }), { seat: 0, cardId: '1-2', end: 'left' });

describe('akhir game', () => {
  it('berakhir saat total melewati target, tidak harus tepat (92 + 14 = 106)', () => {
    const r = endGame([0, 92, 0, 0]);
    if (!r.ok) throw new Error(r.reason);
    // ronde ini tidak menambah poin (lihat fixture), jadi tambahan 14 harus datang dari total awal itu sendiri
    const withGain = endGame([0, 92 + 14, 0, 0]);
    if (!withGain.ok) throw new Error(withGain.reason);
    const ended = withGain.events.find((e) => e.type === 'gameEnded');
    expect(ended).toMatchObject({ type: 'gameEnded', result: { losers: [1] } });
    expect(withGain.state.result).toEqual({ champions: [0, 2, 3], losers: [1] });
    // di bawah target: game belum berakhir
    expect(r.events.some((e) => e.type === 'gameEnded')).toBe(false);
    expect(r.state.result).toBeNull();
  });

  it('juara 1 bersama dan kalah bersama: Anwar 20, Agus 20, Joko 105, Budi 112 (target 100)', () => {
    const r = endGame([20, 20, 105, 112]);
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.totals).toEqual([20, 20, 105, 112]);
    expect(r.state.result).toEqual({ champions: [0, 1], losers: [2, 3] });
    const ended = r.events.find((e) => e.type === 'gameEnded');
    expect(ended).toEqual({ type: 'gameEnded', result: { champions: [0, 1], losers: [2, 3] } });
  });

  it('tidak ada juara 1 jika keempat pemain kalah di ronde yang sama', () => {
    const r = endGame([100, 100, 100, 100]);
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.result).toEqual({ champions: [], losers: [0, 1, 2, 3] });
  });

  it('game berlanjut (tanpa event gameEnded) jika belum ada yang mencapai target', () => {
    const r = endGame([10, 10, 10, 10]);
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.result).toBeNull();
    expect(r.events.some((e) => e.type === 'gameEnded')).toBe(false);
    // ronde berikutnya tetap bisa dimulai selama game belum berakhir
    expect(() => nextSession(r.state, seededRandom(1))).not.toThrow();
  });

  it('menolak lanjut ke ronde berikutnya setelah game berakhir', () => {
    const r = endGame([100, 0, 0, 0]);
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.result).not.toBeNull();
    expect(() => nextSession(r.state, seededRandom(1))).toThrow();
  });

  it('game baru selalu mengembalikan total ke nol dan pembuka 0–0, apa pun hasil game sebelumnya', () => {
    const { state } = startGame({}, seededRandom(1));
    expect(state.totals).toEqual([0, 0, 0, 0]);
    expect(state.result).toBeNull();
    expect(state.session.opening).toEqual({ kind: 'balak', pip: 0 });
  });
});
