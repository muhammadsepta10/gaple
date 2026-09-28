import { isBalak, type Card } from './kartu';
import { endsAfter, type Move } from './mesin';
import type { SeatView } from './pandangan';
import { cardValue } from './poin';

/** Bonus kecil untuk balak: hanya memenangkan nilai yang sama, tidak mengalahkan kartu bernilai lebih besar. */
const BALAK_BONUS = 0.5;

/** Nilai kartu jika tertahan di tangan saat ronde berakhir, ditambah bonus balak. */
function discardValue(c: Card, doubleBalak: boolean): number {
  return cardValue(c, false, doubleBalak) + (isBalak(c) ? BALAK_BONUS : 0);
}

/** Jumlah kartu sisa tangan yang masih bisa disambung ke ujung susunan setelah langkah ini. */
function keptPlayable(view: SeatView, c: Card, move: Move): number {
  const next = endsAfter(view.chain.ends, c, move.end);
  return view.hand.filter((h) => h.id !== c.id && [h.a, h.b].some((p) => p === next.left || p === next.right)).length;
}

const compareIds = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Bot strategis: fungsi murni atas pandangan kursi, mengembalikan satu langkah legal.
 * Urutan kriteria: nilai buangan terbesar (balak sedikit diutamakan), lalu ujung yang menyisakan
 * paling banyak kartu yang bisa disambung, lalu id kartu terkecil dan ujung kiri lebih dulu.
 */
export function chooseMove(view: SeatView): Move {
  const scored = view.legalMoves.map((move) => {
    const c = view.hand.find((h) => h.id === move.cardId)!;
    return { move, value: discardValue(c, view.config.doubleBalak), kept: keptPlayable(view, c, move) };
  });
  scored.sort(
    (x, y) =>
      y.value - x.value ||
      y.kept - x.kept ||
      compareIds(x.move.cardId, y.move.cardId) ||
      compareIds(x.move.end, y.move.end),
  );
  const best = scored[0];
  if (!best) throw new Error('tidak ada langkah legal');
  return best.move;
}
