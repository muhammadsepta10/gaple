import { isBalak, otherPip, type Card, type Placement, type Seat } from '@gaple/aturan';
import { U, type Pose } from './kartu';

export type Rect = { x: number; y: number; w: number; h: number };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Tata letak meja statis (varian D, tanpa kipas).
 * Kursi: 0 = kamu (bawah), 1 = kiri, 2 = atas, 3 = kanan — searah jarum jam.
 */
export function tableLayout(w: number, h: number) {
  const m = 8;
  const sideW = clamp(w * 0.11, 78, 140);
  const topH = clamp(h * 0.13, 44, 76);
  const handH = clamp(h * 0.3, 90, 200);
  const handScale = handH / (2 * U);
  const backScale = clamp(h / 1300, 0.28, 0.5);
  const tw = U * backScale;
  const compact = h < 500;
  const pillH = compact ? 30 : 38;
  const pillW = Math.min(136, sideW + 40);
  const sideY = h * 0.28;

  return {
    compact,
    chainArea: { x: sideW + m, y: topH + 4, w: w - 2 * (sideW + m), h: h - topH - handH - 20 } as Rect,
    chainMaxS: clamp(h / 16, 18, 34),
    pill(seat: Seat): Rect {
      if (seat === 0) return { x: m, y: h - pillH - m, w: pillW, h: pillH };
      if (seat === 2) return { x: w / 2 - 70 - 136, y: m, w: 136, h: pillH };
      return { x: seat === 1 ? m : w - m - pillW, y: sideY, w: pillW, h: pillH };
    },
    hand(i: number, n: number, lift: number): Pose {
      const step = U * handScale + 8;
      return { x: w / 2 + (i - (n - 1) / 2) * step, y: h - handH / 2 - 6 - lift, rot: 0, scale: handScale };
    },
    back(seat: Seat, i: number): Pose {
      if (seat === 2) return { x: w / 2 - 50 + i * (tw + 3) + tw / 2, y: m + tw + 4, rot: 0, scale: backScale };
      const x = seat === 1 ? m + sideW / 2 : w - m - sideW / 2;
      return { x, y: sideY + pillH + 14 + i * (tw + 3) + tw / 2, rot: Math.PI / 2, scale: backScale };
    },
  };
}

/** Kartu rantai dari kiri ke kanan, dengan nilai yang menghadap kiri dan kanan. */
export type ChainCell = { card: Card; left: number; right: number };

export function chainCells(placements: readonly Placement[]): ChainCell[] {
  const cells: ChainCell[] = [];
  for (const [i, p] of placements.entries()) {
    const other = otherPip(p.card, p.open);
    if (i === 0) cells.push({ card: p.card, left: p.card.a, right: p.card.b });
    else if (p.end === 'left') cells.unshift({ card: p.card, left: p.open, right: other });
    else cells.push({ card: p.card, left: other, right: p.open });
  }
  return cells;
}

/** Ukuran minimum target ketuk ujung rantai (px). */
export const END_TARGET = 40;

/** Rantai lurus di tengah area; balak melintang. Kartu mengecil agar muat. */
export function straightChain(cells: ChainCell[], area: Rect, maxS: number) {
  const units = cells.reduce((n, c) => n + (isBalak(c.card) ? 1 : 2), 0);
  // cadangan di tiap sisi untuk target ketuk ujung
  const S = Math.min(maxS, (area.w - 2 * (END_TARGET + 4)) / Math.max(units, 1));
  const cy = area.y + area.h / 2;
  const startX = area.x + (area.w - units * S) / 2;
  let x = startX;
  const poses = cells.map((c) => {
    const balak = isBalak(c.card);
    const width = balak ? S : 2 * S;
    const pose: Pose = { x: x + width / 2, y: cy, rot: balak ? 0 : -Math.PI / 2, scale: S / U };
    x += width;
    return { cell: c, pose };
  });
  const target = Math.max(2 * S, END_TARGET);
  return {
    poses,
    target,
    /** Pusat target ketuk tiap ujung. */
    ends: {
      left: { x: startX - target / 2 - 4, y: cy },
      right: { x: x + target / 2 + 4, y: cy },
    },
  };
}
