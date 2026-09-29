import { isBalak, otherPip, type Placement, type Seat } from '@gaple/aturan';
import { U, type Pose } from './kartuGeometry';

export type Rect = { x: number; y: number; w: number; h: number };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Posisi layar sebuah kursi dilihat dari kursi sendiri: 0 = bawah, lalu searah jarum jam.
 * Dengan begitu kursi sendiri selalu di bawah, di kursi mana pun ia duduk.
 */
export const posisiKursi = (seat: Seat, kursiSendiri: Seat) => ((seat - kursiSendiri + 4) % 4) as Seat;

/**
 * Tata letak meja varian D.
 * Posisi (lihat `posisiKursi`): 0 = kamu (bawah), 1 = kiri, 2 = atas, 3 = kanan — searah jarum jam.
 */
export function tableLayout(w: number, h: number) {
  const m = 8;
  const sideW = clamp(w * 0.11, 78, 140);
  const topH = clamp(h * 0.13, 44, 76);
  const compact = h < 500;
  // Di HP landscape tinggi layar sempit: kipas tangan harus hemat agar meja tetap lega.
  const handH = clamp(h * (compact ? 0.21 : 0.3), 68, 270);
  const handBottom = compact ? 8 : 17;
  const handScale = handH / (2 * U);
  const backScale = clamp(h / 1300, 0.28, 0.5);
  const tw = U * backScale;
  const pillH = compact ? 30 : 38;
  // Lebar tetap: cukup untuk "10000 poin · 7 kartu" di samping nama; di HP sideW terlalu sempit untuk jadi patokan.
  const pillW = compact ? 136 : 150;
  const sideY = h * 0.28;
  // Pil kursi samping bisa lebih lebar dari kolom sampingnya; rantai mulai setelah pil agar tidak menabrak nama.
  const sideCol = Math.max(sideW, pillW + 4);

  return {
    compact,
    chainArea: { x: sideCol + m, y: topH + 4, w: w - 2 * (sideCol + m), h: h - topH - handH - handBottom - 12 } as Rect,
    chainMaxS: clamp(h / 16, 18, 34),
    pill(seat: Seat): Rect {
      if (seat === 0) return { x: m, y: h * 0.75, w: pillW, h: pillH };
      if (seat === 2) return { x: w / 2 - 70 - pillW, y: m, w: pillW, h: pillH };
      return { x: seat === 1 ? m : w - m - pillW, y: sideY, w: pillW, h: pillH };
    },
    hand(i: number, n: number, lift: number): Pose {
      const offset = i - (n - 1) / 2;
      const step = Math.min(U * handScale + 5, (w - 2 * sideW - 20) / Math.max(n, 1));
      const curve = Math.min(h * 0.095, 62) * (offset / 3) ** 2;
      return {
        x: w / 2 + offset * step,
        y: h - handH / 2 - handBottom + curve - lift,
        rot: offset * 0.115,
        scale: handScale,
      };
    },
    back(seat: Seat, i: number): Pose {
      // Kursi bawah hanya digambar sebagai punggung kartu di tampilan penonton.
      if (seat === 0) return { x: w / 2 + (i - 3) * (tw + 3), y: h - m - tw - 4, rot: 0, scale: backScale };
      if (seat === 2) return { x: w / 2 + 40 + i * (tw + 3) + tw / 2, y: m + tw + 4, rot: 0, scale: backScale };
      const x = seat === 1 ? m + sideW / 2 : w - m - sideW / 2;
      return { x, y: sideY + pillH + 14 + i * (tw + 3) + tw / 2, rot: Math.PI / 2, scale: backScale };
    },
  };
}

/** Isi pil kursi: nama + lencana BOT di baris atas, poin dan jumlah kartu selebar pil di baris bawah. */
export function isiPil(rect: Rect, compact: boolean, tanda: { bot: boolean; terputus: boolean }) {
  const { x, y, w, h } = rect;
  const pad = 12;
  const nameY = y + (compact ? 4 : 5);
  const badge: Rect = { x: x + w - pad - 28, y: nameY + 1, w: 28, h: compact ? 12 : 15 };
  // Penanda Terputus menempel di tepi atas pil, sisi kanan.
  const terputus: Rect = { x: x + w - 66, y: y - 8, w: 58, h: 15 };
  const nameRight = tanda.terputus ? terputus.x - 4 : tanda.bot ? badge.x - 6 : x + w - pad;
  return {
    name: { x: x + pad, y: nameY, maxW: nameRight - x - pad, size: compact ? 12 : 13 },
    stats: { x: x + pad, y: y + (compact ? 17 : 21), maxW: w - 2 * pad, size: compact ? 9.5 : 11 },
    badge,
    terputus,
    h,
  };
}

/** Potong teks dengan "…" sampai muat di `maxW` menurut pengukur `ukur`. */
export function potongTeks(teks: string, maxW: number, ukur: (t: string) => number): string {
  if (ukur(teks) <= maxW) return teks;
  const huruf = [...teks];
  for (let n = huruf.length - 1; n > 0; n--) {
    const coba = huruf.slice(0, n).join('').trimEnd() + '…';
    if (ukur(coba) <= maxW) return coba;
  }
  return '…';
}

/** Ukuran minimum target ketuk ujung rantai (px). */
export const END_TARGET = 40;

export type ChainPose = {
  placement: Placement;
  pose: Pose;
  face: { top: number; bottom: number };
  connector: boolean;
};

type Point = { x: number; y: number };
type Arm = { x: number; y: number; dir: 1 | -1; vertical: 1 | -1; tip: Point; tangent: Point; turned: boolean };

function bounds(entry: ChainPose, s: number): Rect {
  const vertical = entry.pose.rot === 0 || entry.pose.rot === Math.PI;
  const w = vertical ? s : 2 * s;
  const h = vertical ? 2 * s : s;
  return { x: entry.pose.x - w / 2, y: entry.pose.y - h / 2, w, h };
}

function buildChain(placements: readonly Placement[], s: number, width: number) {
  const first = placements[0]!;
  const firstWidth = isBalak(first.card) ? s : 2 * s;
  const poses: ChainPose[] = [{
    placement: first,
    pose: { x: 0, y: 0, rot: isBalak(first.card) ? 0 : -Math.PI / 2, scale: s / U },
    face: { top: first.card.a, bottom: first.card.b },
    connector: false,
  }];
  const arms: { left: Arm; right: Arm } = {
    left: { x: -firstWidth / 2, y: 0, dir: -1, vertical: -1, tip: { x: -firstWidth / 2, y: 0 }, tangent: { x: -1, y: 0 }, turned: false },
    right: { x: firstWidth / 2, y: 0, dir: 1, vertical: 1, tip: { x: firstWidth / 2, y: 0 }, tangent: { x: 1, y: 0 }, turned: false },
  };
  const limit = width / 2 - 2;
  const fits = (edge: number, dir: number, size: number) => Math.abs(edge + dir * (size + s)) <= limit;

  for (let i = 1; i < placements.length; i++) {
    const p = placements[i]!;
    const arm = arms[p.end];
    const balak = isBalak(p.card);
    const cardWidth = balak ? s : 2 * s;
    const next = placements.slice(i + 1).find((candidate) => candidate.end === p.end);
    const mustTurnForNextBalak = !balak && !!next && isBalak(next.card) && !fits(arm.x + arm.dir * cardWidth, arm.dir, s);
    const connector = !balak && (!fits(arm.x, arm.dir, cardWidth) || mustTurnForNextBalak);
    if ((!connector && !fits(arm.x, arm.dir, cardWidth)) || (connector && Math.abs(arm.x + arm.dir * s) > limit)) return null;

    const attached = otherPip(p.card, p.open);
    let pose: Pose;
    if (connector) {
      pose = { x: arm.x + arm.dir * s / 2, y: arm.y + arm.vertical * s, rot: arm.vertical === 1 ? 0 : Math.PI, scale: s / U };
      arm.y += arm.vertical * 2 * s;
      arm.dir = arm.dir === 1 ? -1 : 1;
      arm.tip = { x: pose.x, y: arm.y };
      arm.tangent = { x: 0, y: arm.vertical };
      arm.turned = true;
    } else {
      pose = {
        x: arm.x + arm.dir * cardWidth / 2,
        y: arm.y + (balak && arm.turned ? arm.vertical * s / 2 : 0),
        rot: balak ? 0 : arm.dir === 1 ? -Math.PI / 2 : Math.PI / 2,
        scale: s / U,
      };
      arm.x += arm.dir * cardWidth;
      arm.tip = { x: arm.x, y: arm.y };
      arm.tangent = { x: arm.dir, y: 0 };
      arm.turned = false;
    }
    poses.push({ placement: p, pose, face: { top: attached, bottom: p.open }, connector });
  }
  return { poses, arms };
}

/** Pure snake layout. Placement order remains stable for card animation keys. */
export function layoutChain(placements: readonly Placement[], area: Rect, maxCardWidth: number) {
  const center = { x: area.x + area.w / 2, y: area.y + area.h / 2 };
  const empty = { poses: [] as ChainPose[], cardWidth: 0, target: END_TARGET, ends: { left: center, right: center } };
  if (!placements.length) return empty;

  for (let s = Math.floor(maxCardWidth); s >= 1; s--) {
    const built = buildChain(placements, s, area.w);
    if (!built) continue;
    const boxes = built.poses.map((entry) => bounds(entry, s));
    const minX = Math.min(...boxes.map((box) => box.x));
    const maxX = Math.max(...boxes.map((box) => box.x + box.w));
    const minY = Math.min(...boxes.map((box) => box.y));
    const maxY = Math.max(...boxes.map((box) => box.y + box.h));
    if (maxX - minX > area.w - 4 || maxY - minY > area.h - 4) continue;

    const dx = center.x - (minX + maxX) / 2;
    const dy = center.y - (minY + maxY) / 2;
    const poses = built.poses.map((entry) => ({ ...entry, pose: { ...entry.pose, x: entry.pose.x + dx, y: entry.pose.y + dy } }));
    const target = Math.max(END_TARGET, 2 * s);
    const targetFor = (arm: Arm): Point => ({
      x: clamp(arm.tip.x + dx + arm.tangent.x * (target / 2 + 2), area.x + target / 2, area.x + area.w - target / 2),
      y: clamp(arm.tip.y + dy + arm.tangent.y * (target / 2 + 2), area.y + target / 2, area.y + area.h - target / 2),
    });
    return { poses, cardWidth: s, target, ends: { left: targetFor(built.arms.left), right: targetFor(built.arms.right) } };
  }
  throw new Error('area rantai terlalu kecil');
}
