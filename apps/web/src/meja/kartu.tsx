import type { Graphics } from 'pixi.js';
import { useCallback } from 'react';
import { U, type Pose } from './kartuGeometry';

/** Lebar dasar kartu; tinggi 2U. Semua kartu digambar pada ukuran ini lalu diskalakan. */
export { U } from './kartuGeometry';

export const GOLD = 0xffd54a;

const PIP: Record<number, [number, number][]> = {
  0: [],
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
};

function drawFace(g: Graphics, top: number, bottom: number) {
  const w = U, h = 2 * U, r = U * 0.16;
  g.roundRect(-w / 2, -h / 2, w, h, r).fill(0xfbf6ea).stroke({ color: 0x3a2f25, width: 2 });
  g.moveTo(-w / 2 + 6, 0).lineTo(w / 2 - 6, 0).stroke({ color: 0xb9ad9a, width: 2 });
  const o = U * 0.25;
  for (const [val, cy] of [[top, -U / 2], [bottom, U / 2]] as const) {
    for (const [px, py] of PIP[val] ?? []) g.circle(px * o, cy + py * o, U * 0.1).fill(val === 1 ? 0xc0392b : 0x1f1a17);
  }
}

function drawBack(g: Graphics) {
  const w = U, h = 2 * U, r = U * 0.16;
  g.roundRect(-w / 2, -h / 2, w, h, r).fill(0x8e2b2b).stroke({ color: 0xf2d8a7, width: 3 });
  g.roundRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, r / 2).stroke({ color: 0xf2d8a7, width: 2, alpha: 0.6 });
  g.circle(0, 0, U * 0.18).fill({ color: 0xf2d8a7, alpha: 0.8 });
}

export type { Pose } from './kartuGeometry';

type CardProps = {
  pose: Pose;
  /** Nilai bagian atas dan bawah; kosong berarti punggung kartu. */
  face?: { top: number; bottom: number };
  dim?: boolean;
  outline?: boolean;
  onTap?: () => void;
};

export function CardView({ pose, face, dim, outline, onTap }: CardProps) {
  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      if (face) drawFace(g, face.top, face.bottom);
      else drawBack(g);
      if (outline) g.roundRect(-U / 2 - 4, -U - 4, U + 8, 2 * U + 8, U * 0.22).stroke({ color: GOLD, width: 5 });
    },
    [face?.top, face?.bottom, outline],
  );
  return (
    <pixiGraphics
      draw={draw}
      x={pose.x}
      y={pose.y}
      rotation={pose.rot}
      scale={pose.scale}
      alpha={dim ? 0.42 : 1}
      eventMode={onTap ? 'static' : 'none'}
      cursor={onTap ? 'pointer' : undefined}
      onPointerTap={onTap}
    />
  );
}
