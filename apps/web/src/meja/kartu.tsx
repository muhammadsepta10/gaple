import type { FederatedPointerEvent, Graphics } from 'pixi.js';
import { useTick } from '@pixi/react';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { DURASI } from '@gaple/ruang';
import { U, type Pose } from './kartuGeometry';
import type { Alat } from './fokusTangan';

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
  /** Kejadian pointer di atas kartu; bila ada, kartu menerima pointer. */
  onPointer?: (tipe: 'masuk' | 'keluar' | 'tekan' | 'lepas' | 'lepasDiLuar', alat: Alat) => void;
  /** Kursor tangan saat mouse di atas kartu. */
  bisaDiklik?: boolean;
  /** Perubahan pose kecil (mis. kartu terangkat) dianimasikan singkat, bukan melompat. */
  halus?: boolean;
  /** `origin`: titik awal terbang bila kartu belum pernah tampil (mis. kartu lawan online yang tidak dikenal). */
  motion?: { key: number; at: number; from?: Pose; origin?: Pose; delay?: number; flip?: boolean };
};

type Flight = { from: Pose; to: Pose; started: number; delay: number; flip: boolean; revealed: boolean; duration: number };
/** Lama animasi kartu terangkat/turun (ms). */
const DURASI_ANGKAT = 120;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function CardView({ pose, face, dim, outline, onPointer, bisaDiklik, halus, motion }: CardProps) {
  const graphic = useRef<Graphics>(null);
  const renderedPose = useRef<Pose | null>(null);
  const flight = useRef<Flight | null>(null);
  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      if (face) drawFace(g, face.top, face.bottom);
      else drawBack(g);
      if (outline) g.roundRect(-U / 2 - 4, -U - 4, U + 8, 2 * U + 8, U * 0.22).stroke({ color: GOLD, width: 5 });
    },
    [face?.top, face?.bottom, outline],
  );
  useLayoutEffect(() => {
    const g = graphic.current;
    if (!g) return;
    // Flip yang terpotong sebelum tick membuka muka (mis. tab tersembunyi: rAF berhenti, setTimeout tetap jalan)
    // meninggalkan punggung kartu; `draw` tidak dipanggil ulang karena identitasnya tidak berubah.
    const faceHidden = !!flight.current?.flip && !flight.current.revealed;
    if (motion) {
      const from = motion.from ?? renderedPose.current ?? motion.origin ?? pose;
      flight.current = {
        from,
        to: pose,
        started: motion.at,
        delay: motion.delay ?? 0,
        flip: !!motion.flip,
        revealed: false,
        duration: DURASI.kartuTerbang,
      };
      g.position.set(from.x, from.y);
      g.rotation = from.rot;
      g.scale.set(from.scale);
      if (motion.flip) {
        g.clear();
        drawBack(g);
      } else if (faceHidden) draw(g);
    } else if (halus && renderedPose.current && !faceHidden) {
      flight.current = { from: renderedPose.current, to: pose, started: performance.now(), delay: 0, flip: false, revealed: false, duration: DURASI_ANGKAT };
    } else {
      if (faceHidden) draw(g);
      flight.current = null;
      g.position.set(pose.x, pose.y);
      g.rotation = pose.rot;
      g.scale.set(pose.scale);
      renderedPose.current = pose;
    }
  }, [motion?.key, pose.x, pose.y, pose.rot, pose.scale]);

  useTick(() => {
    const f = flight.current;
    const g = graphic.current;
    if (!f || !g) return;
    const raw = Math.max(0, Math.min(1, (performance.now() - f.started - f.delay) / f.duration));
    const eased = 1 - (1 - raw) ** 3;
    const current = {
      x: mix(f.from.x, f.to.x, eased),
      y: mix(f.from.y, f.to.y, eased),
      rot: mix(f.from.rot, f.to.rot, eased),
      scale: mix(f.from.scale, f.to.scale, eased),
    };
    g.position.set(current.x, current.y);
    g.rotation = current.rot;
    const flipX = f.flip ? Math.max(0.005, Math.abs(1 - 2 * raw)) : 1;
    g.scale.set(current.scale * flipX, current.scale);
    if (f.flip && !f.revealed && raw >= 0.5) {
      f.revealed = true;
      draw(g);
    }
    renderedPose.current = current;
    if (raw === 1) {
      flight.current = null;
      g.scale.set(f.to.scale);
      renderedPose.current = f.to;
    }
  });
  return (
    <pixiGraphics
      ref={graphic}
      draw={draw}
      alpha={dim ? 0.42 : 1}
      eventMode={onPointer ? 'static' : 'none'}
      cursor={bisaDiklik ? 'pointer' : undefined}
      onPointerOver={onPointer && ((e: FederatedPointerEvent) => onPointer('masuk', alat(e)))}
      onPointerOut={onPointer && ((e: FederatedPointerEvent) => onPointer('keluar', alat(e)))}
      onPointerDown={onPointer && ((e: FederatedPointerEvent) => onPointer('tekan', alat(e)))}
      onPointerUp={onPointer && ((e: FederatedPointerEvent) => onPointer('lepas', alat(e)))}
      onPointerUpOutside={onPointer && ((e: FederatedPointerEvent) => onPointer('lepasDiLuar', alat(e)))}
    />
  );
}

const alat = (e: FederatedPointerEvent): Alat => (e.pointerType === 'touch' ? 'touch' : e.pointerType === 'pen' ? 'pen' : 'mouse');
