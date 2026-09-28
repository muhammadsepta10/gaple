import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Placement } from '@gaple/aturan';
import { fullSet } from '../../../packages/aturan/src/kartu';
import { layoutChain, tableLayout } from '../src/meja/tataLetak';

const placed = (a: number, b: number, end: 'left' | 'right', open: number): Placement => ({
  seat: 0,
  card: { id: `${a}-${b}`, a, b },
  end,
  open,
});

describe('layoutChain', () => {
  it('turns first right edge with an upright connector', () => {
    const chain = [placed(0, 1, 'left', 1), placed(1, 2, 'right', 2), placed(2, 3, 'right', 3)];
    const layout = layoutChain(chain, { x: 0, y: 0, w: 180, h: 200 }, 20);

    expect(layout.cardWidth).toBe(20);
    expect(layout.poses[2]?.connector).toBe(true);
    expect(layout.poses[2]?.pose.rot).toBe(0);
    expect(layout.poses[2]?.pose.y).toBeGreaterThan(layout.poses[1]!.pose.y);
    expect(layout.ends.right.y).toBeGreaterThan(layout.poses[1]!.pose.y);
  });

  it('keeps a balak transverse and shifts it half a card after a turn', () => {
    const chain = [placed(0, 1, 'left', 1), placed(1, 2, 'right', 2), placed(2, 3, 'right', 3), placed(3, 3, 'right', 3)];
    const layout = layoutChain(chain, { x: 0, y: 0, w: 180, h: 200 }, 20);
    const turn = layout.poses[2]!;
    const balak = layout.poses[3]!;
    expect(turn.connector).toBe(true);
    expect(balak.connector).toBe(false);
    expect(balak.pose.rot).toBe(0);
    expect(balak.pose.y - turn.pose.y).toBe(1.5 * layout.cardWidth);
  });

  it('keeps 28 cards near 24 px wide on an 844×390 table', () => {
    const table = tableLayout(844, 390);
    for (let seed = 1; seed <= 50; seed++) {
      const layout = layoutChain(legalChain(seed, 28, seed % 28), table.chainArea, table.chainMaxS);
      expect(layout.cardWidth).toBeGreaterThanOrEqual(22);
      expect(layout.cardWidth).toBeLessThanOrEqual(25);
    }
  });

  it('fits random legal chains up to 28 cards without overlap or broken links', () => {
    const areas = [tableLayout(844, 390).chainArea, tableLayout(1440, 900).chainArea];
    fc.assert(fc.property(fc.integer({ min: 1, max: 100_000 }), fc.integer({ min: 1, max: 28 }), fc.integer({ min: 0, max: 27 }), (seed, count, split) => {
      const chain = legalChain(seed, count, split % count);
      for (const area of areas) {
        const layout = layoutChain(chain, area, area === areas[0] ? tableLayout(844, 390).chainMaxS : tableLayout(1440, 900).chainMaxS);
        expect(layout.poses).toHaveLength(count);
        const boxes = layout.poses.map(({ pose }) => {
          const vertical = pose.rot === 0 || pose.rot === Math.PI;
          const w = (vertical ? 1 : 2) * layout.cardWidth;
          const h = (vertical ? 2 : 1) * layout.cardWidth;
          return { x1: pose.x - w / 2, x2: pose.x + w / 2, y1: pose.y - h / 2, y2: pose.y + h / 2 };
        });
        for (const [i, box] of boxes.entries()) {
          expect(box.x1).toBeGreaterThanOrEqual(area.x - 0.001);
          expect(box.x2).toBeLessThanOrEqual(area.x + area.w + 0.001);
          expect(box.y1).toBeGreaterThanOrEqual(area.y - 0.001);
          expect(box.y2).toBeLessThanOrEqual(area.y + area.h + 0.001);
          expect(layout.ends.left.x).toBeGreaterThanOrEqual(area.x);
          expect(layout.ends.right.x).toBeLessThanOrEqual(area.x + area.w);
          expect(layout.poses[i]!.connector && layout.poses[i]!.placement.card.a === layout.poses[i]!.placement.card.b).toBe(false);
          if (layout.poses[i]!.placement.card.a === layout.poses[i]!.placement.card.b) expect(layout.poses[i]!.pose.rot).toBe(0);
          for (let j = 0; j < i; j++) {
            const prev = boxes[j]!;
            const overlapX = Math.min(box.x2, prev.x2) - Math.max(box.x1, prev.x1);
            const overlapY = Math.min(box.y2, prev.y2) - Math.max(box.y1, prev.y1);
            expect(overlapX > 0.001 && overlapY > 0.001).toBe(false);
          }
          if (i > 0) {
            const end = layout.poses[i]!.placement.end;
            const prevIndex = layout.poses.findLastIndex((entry, j) => j < i && entry.placement.end === end);
            const prev = boxes[prevIndex < 0 ? 0 : prevIndex]!;
            const touchX = (Math.abs(box.x1 - prev.x2) < 0.001 || Math.abs(box.x2 - prev.x1) < 0.001) && Math.min(box.y2, prev.y2) - Math.max(box.y1, prev.y1) > 0.001;
            const touchY = (Math.abs(box.y1 - prev.y2) < 0.001 || Math.abs(box.y2 - prev.y1) < 0.001) && Math.min(box.x2, prev.x2) - Math.max(box.x1, prev.x1) > 0.001;
            expect(touchX || touchY).toBe(true);
          }
        }
      }
    }), { numRuns: 100 });
  });
});

/** Random Euler trail: every tile appears once and neighbouring values match. */
function legalChain(seed: number, count: number, split: number): Placement[] {
  const tiles = fullSet();
  let random = seed;
  const next = () => ((random = (Math.imul(random, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const used = new Set<number>();
  const vertices: number[] = [];
  function visit(pip: number) {
    const candidates = tiles.map((_, i) => i).filter((i) => tiles[i]!.a === pip || tiles[i]!.b === pip);
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
    }
    for (const i of candidates) {
      if (used.has(i)) continue;
      used.add(i);
      const tile = tiles[i]!;
      visit(tile.a === pip ? tile.b : tile.a);
    }
    vertices.push(pip);
  }
  visit(0);
  vertices.reverse();
  const edge = (i: number, end: 'left' | 'right', open: number): Placement => ({
    seat: 0,
    card: tiles.find((tile) => tile.a === Math.min(vertices[i]!, vertices[i + 1]!) && tile.b === Math.max(vertices[i]!, vertices[i + 1]!))!,
    end,
    open,
  });
  const chain = [edge(split, 'left', vertices[split + 1]!)];
  const left: Placement[] = [];
  const right: Placement[] = [];
  for (let i = split - 1; i >= 0; i--) left.push(edge(i, 'left', vertices[i]!));
  for (let i = split + 1; i < count; i++) right.push(edge(i, 'right', vertices[i + 1]!));
  while (left.length || right.length) {
    if (!right.length || (left.length && next() < 0.5)) chain.push(left.shift()!);
    else chain.push(right.shift()!);
  }
  return chain;
}
