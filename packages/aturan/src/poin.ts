import { isBalak, type Card } from './kartu';
import type { Seat } from './kursi';

function cardValue(c: Card, zeroDead: boolean, doubleBalak: boolean): number {
  if (isBalak(c)) {
    if (c.a === 0) return zeroDead ? 25 : 0;
    return doubleBalak ? (c.a + c.b) * 2 : c.a + c.b;
  }
  return c.a + c.b;
}

/** Balak 0 mati jika tidak ada satu pun pemain yang masih memegang kartu berangka 0 lain (0-1..0-6). */
function isZeroDead(hands: readonly (readonly Card[])[]): boolean {
  return !hands.some((hand) => hand.some((c) => (c.a === 0 || c.b === 0) && !(c.a === 0 && c.b === 0)));
}

/**
 * Poin sesi per kursi dari sisa kartu yang dipegang. Pemenang sesi (kartu habis) mendapat nol.
 * Balak 1-6 dihitung dua kali jika `doubleBalak`; balak 0 tidak terpengaruh opsi ini.
 */
export function sessionPoints(
  hands: readonly (readonly Card[])[],
  winner: Seat | null,
  doubleBalak: boolean,
): number[] {
  const zeroDead = isZeroDead(hands);
  return hands.map((hand, seat) =>
    seat === winner ? 0 : hand.reduce((sum, c) => sum + cardValue(c, zeroDead, doubleBalak), 0),
  );
}
