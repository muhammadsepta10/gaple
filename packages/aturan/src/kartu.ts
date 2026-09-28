/** Kartu kanonik: nilai kecil lebih dulu (`a <= b`), `id` stabil berbentuk "a-b". */
export type Card = { readonly id: string; readonly a: number; readonly b: number };

export function card(a: number, b: number): Card {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return { id: `${lo}-${hi}`, a: lo, b: hi };
}

export function isBalak(c: Card): boolean {
  return c.a === c.b;
}

/** Nilai bagian lain kartu, dari bagian yang bernilai `pip`. */
export function otherPip(c: Card, pip: number): number {
  return c.a === pip ? c.b : c.a;
}

/** Set kartu: 28 kartu, 0–0 sampai 6–6. */
export function fullSet(): Card[] {
  const out: Card[] = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) out.push(card(a, b));
  return out;
}
