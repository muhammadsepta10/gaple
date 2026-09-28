import { describe, expect, it } from 'vitest';
import { chooseMove, type Move, type SeatView } from '../src/index';
import { card } from '../src/kartu';

type Setup = {
  hand: string[];
  ends: [number, number] | null;
  moves: [string, Move['end']][];
  doubleBalak?: boolean;
};

/** Pandangan kursi 0 yang disusun manual: tangan, ujung rantai, dan langkah legal. */
function view({ hand, ends, moves, doubleBalak = false }: Setup): SeatView {
  const cards = hand.map((id) => {
    const [a, b] = id.split('-').map(Number);
    return card(a!, b!);
  });
  return {
    config: { targetPoints: 100, doubleBalak },
    sessionNumber: 2,
    chain: { placements: [], ends: ends && { left: ends[0], right: ends[1] } },
    opening: { kind: 'free' },
    turn: 0,
    handCounts: [cards.length, 5, 5, 5],
    totals: [0, 0, 0, 0],
    sessionResult: null,
    gameResult: null,
    seat: 0,
    hand: cards,
    legalMoves: moves.map(([cardId, end]) => ({ seat: 0, cardId, end })),
  };
}

describe('bot: membuang nilai terbesar', () => {
  it('memilih kartu bernilai terbesar di antara langkah legal', () => {
    const v = view({
      hand: ['1-2', '5-6', '0-6', '4-4'],
      ends: [6, 1],
      moves: [
        ['1-2', 'right'],
        ['5-6', 'left'],
        ['0-6', 'left'],
      ],
    });
    expect(chooseMove(v)).toEqual({ seat: 0, cardId: '5-6', end: 'left' });
  });

  it('pada pembuka bebas, membuka dengan kartu bernilai terbesar', () => {
    const v = view({
      hand: ['1-2', '3-6', '2-2'],
      ends: null,
      moves: [
        ['1-2', 'left'],
        ['3-6', 'left'],
        ['2-2', 'left'],
      ],
    });
    expect(chooseMove(v).cardId).toBe('3-6');
  });

  it('balak sedikit diprioritaskan saat nilainya sama', () => {
    const v = view({ hand: ['2-4', '3-3'], ends: [3, 2], moves: [['2-4', 'right'], ['3-3', 'left']] });
    expect(chooseMove(v).cardId).toBe('3-3');
  });

  it('balak tidak mengalahkan kartu yang nilainya lebih besar', () => {
    const v = view({ hand: ['2-5', '3-3'], ends: [3, 2], moves: [['2-5', 'right'], ['3-3', 'left']] });
    expect(chooseMove(v).cardId).toBe('2-5');
  });

  it('saat balak ganda aktif, balak dinilai dua kali lipat', () => {
    const setup: Setup = { hand: ['1-6', '3-3'], ends: [3, 1], moves: [['1-6', 'right'], ['3-3', 'left']] };
    expect(chooseMove(view(setup)).cardId).toBe('1-6');
    expect(chooseMove(view({ ...setup, doubleBalak: true })).cardId).toBe('3-3');
  });
});

describe('bot: mempertahankan angka yang banyak dipegang', () => {
  it('memilih ujung yang menyisakan angka terbanyak di tangan (ke kanan)', () => {
    // 3-5 di kiri membuat ujung (5,5); di kanan membuat ujung (3,3). Tangan lebih banyak memegang 3.
    const v = view({ hand: ['3-5', '1-3', '3-4', '0-5'], ends: [3, 5], moves: [['3-5', 'left'], ['3-5', 'right']] });
    expect(chooseMove(v)).toEqual({ seat: 0, cardId: '3-5', end: 'right' });
  });

  it('memilih ujung yang menyisakan angka terbanyak di tangan (ke kiri)', () => {
    const v = view({ hand: ['3-5', '1-5', '4-5', '0-3'], ends: [3, 5], moves: [['3-5', 'left'], ['3-5', 'right']] });
    expect(chooseMove(v)).toEqual({ seat: 0, cardId: '3-5', end: 'left' });
  });

  it('di antara kartu bernilai sama, memilih yang menyisakan ujung yang bisa disambung', () => {
    // 1-4 di kanan menyisakan ujung (2,4): 2-3 dan 0-4 masih bisa disambung.
    // 2-3 di kiri menyisakan ujung (3,1): hanya 1-4 yang bisa disambung.
    const v = view({ hand: ['1-4', '2-3', '0-4'], ends: [2, 1], moves: [['1-4', 'right'], ['2-3', 'left']] });
    expect(chooseMove(v)).toEqual({ seat: 0, cardId: '1-4', end: 'right' });
  });
});

describe('bot: tie-break deterministik', () => {
  it('pilihan tidak bergantung pada urutan langkah legal', () => {
    const moves: [string, Move['end']][] = [
      ['1-4', 'left'],
      ['2-3', 'left'],
      ['0-5', 'left'],
    ];
    const hand = ['1-4', '2-3', '0-5'];
    const a = chooseMove(view({ hand, ends: null, moves }));
    const b = chooseMove(view({ hand, ends: null, moves: [...moves].reverse() }));
    expect(b).toEqual(a);
  });

  it('menolak pandangan tanpa langkah legal', () => {
    expect(() => chooseMove(view({ hand: ['1-4'], ends: [6, 6], moves: [] }))).toThrow();
  });
});
