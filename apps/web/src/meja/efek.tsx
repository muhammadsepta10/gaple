import { useTick } from '@pixi/react';
import { Graphics, Text } from 'pixi.js';
import { useRef } from 'react';
import type { Seat } from '@gaple/aturan';
import { DURASI } from '../durasi';
import type { Presentation } from '../presentasi';
import type { Rect } from './tataLetak';

const ease = (t: number) => 1 - (1 - t) ** 3;

export function PassBubble({ rect, name, at }: { rect: Rect; name: string; at: number }) {
  const background = useRef<Graphics>(null);
  const label = useRef<Text>(null);
  const started = useRef(at);
  const x = rect.x + rect.w / 2;
  const y = rect.y < 60 ? rect.y + rect.h + 30 : rect.y - 25;
  useTick(() => {
    const t = Math.min(1, (performance.now() - started.current) / DURASI.pass);
    const alpha = Math.min(1, t * 8) * Math.min(1, (1 - t) * 3);
    const bounce = 1 + Math.sin(Math.min(t * 5, 1) * Math.PI) * 0.18;
    const g = background.current;
    const text = label.current;
    if (g) {
      g.position.set(x, y - 15 * ease(t));
      g.scale.set(bounce);
      g.alpha = alpha;
    }
    if (text) {
      text.position.set(x, y - 15 * ease(t));
      text.scale.set(bounce);
      text.alpha = alpha;
    }
  });
  return (
    <pixiContainer>
      <pixiGraphics
        ref={background}
        x={x} y={y} alpha={0}
        draw={(g) => { g.clear(); g.roundRect(-62, -19, 124, 38, 18).fill(0x13291e).stroke({ color: 0xf6d77d, width: 2 }); }}
      />
      <pixiText ref={label} text={name + ' pass'} x={x} y={y} alpha={0} anchor={0.5} resolution={2}
        style={{ fill: 0xffffff, fontSize: 17, fontWeight: '700', fontFamily: 'system-ui' }} />
    </pixiContainer>
  );
}

type BigEvent = Extract<Presentation, { kind: 'balak' | 'gaplek' | 'win' }>;

export function BigEffect({ event, seatNames, w, h }: { event: BigEvent; seatNames: readonly string[]; w: number; h: number }) {
  const graphic = useRef<Graphics>(null);
  const label = useRef<Text>(null);
  const started = useRef(event.at);
  const kind = event.kind;
  const duration = kind === 'balak' ? DURASI.balak
    : kind === 'gaplek' ? DURASI.gaplek : DURASI.menangSesi;
  const words = kind === 'balak' ? 'BALAK ' + event.pip + '!'
    : kind === 'gaplek' ? 'GAPLEK ' + event.pip + '!'
      : `${seatNames[event.seat]} Menang!`;
  const gold = kind === 'balak';
  useTick(() => {
    const g = graphic.current;
    const text = label.current;
    if (!g || !text) return;
    const elapsed = performance.now() - started.current;
    const t = Math.min(1, elapsed / duration);
    const fade = Math.min(1, t * 7) * Math.min(1, (1 - t) * 5);
    g.clear();
    if (kind === 'balak') {
      const radius = 18 + 170 * ease(Math.min(1, t * 1.7));
      g.circle(w / 2, h / 2, radius).stroke({ color: 0xffd54a, width: 7 * (1 - t) + 1, alpha: fade });
      for (let i = 0; i < 18; i++) {
        const a = i * Math.PI * 2 / 18;
        const r = 28 + 250 * ease(Math.min(1, t * 1.6));
        const x = w / 2 + Math.cos(a) * r;
        const y = h / 2 + Math.sin(a) * r;
        g.circle(x, y, 3 + (i % 3)).fill({ color: 0xffe68a, alpha: fade });
      }
    } else {
      const sweep = Math.min(1, t * 4);
      const width = w * sweep;
      if (kind !== 'gaplek') {
        g.rect(0, 0, w, h).fill({ color: 0xffffff, alpha: Math.max(0, 0.55 - t * 4) });
      }
      g.rect((w - width) / 2, h / 2 - 48, width, 96)
        .fill({ color: kind === 'gaplek' ? 0x310c18 : 0x131e1b, alpha: fade * 0.96 });
      if (kind !== 'gaplek') {
        const diagonal = -w * 0.4 + t * w * 2;
        g.poly([diagonal, h / 2 - 48, diagonal + 35, h / 2 - 48, diagonal - 25, h / 2 + 48, diagonal - 60, h / 2 + 48])
          .fill({ color: 0xffffff, alpha: fade * 0.5 });
      }
    }
    text.alpha = fade;
    text.scale.set(kind === 'balak' ? 1 + 0.35 * (1 - ease(Math.min(1, t * 4))) : 1 + 1.4 * (1 - ease(Math.min(1, t * 5))));
  });
  return (
    <pixiContainer>
      <pixiGraphics ref={graphic} draw={() => {}} />
      <pixiText ref={label} text={words} x={w / 2} y={h / 2} alpha={0} anchor={0.5} resolution={2}
        style={{ fill: kind === 'gaplek' ? 0xff5353 : gold ? 0xffd54a : 0xffffff,
          fontSize: Math.min(52, w * 0.07), fontWeight: '900', fontFamily: 'system-ui' }} />
    </pixiContainer>
  );
}

/** Penanda juara ditempel di dekat kursi juara, tanpa menutupi seluruh meja. */
export function ChampionBadge({ rect, seat, at }: { rect: Rect; seat: Seat; at: number }) {
  const background = useRef<Graphics>(null);
  const label = useRef<Text>(null);
  const x = rect.x + rect.w / 2;
  const y = seat === 2 ? rect.y + rect.h + 19 : rect.y - 19;
  useTick(() => {
    const t = Math.min(1, (performance.now() - at) / DURASI.juara);
    const alpha = Math.min(1, t * 8) * Math.min(1, (1 - t) * 5);
    const scale = 0.75 + 0.25 * ease(Math.min(1, t * 4));
    for (const node of [background.current, label.current]) {
      if (!node) continue;
      node.alpha = alpha;
      node.scale.set(scale);
    }
  });
  return (
    <pixiContainer>
      <pixiGraphics ref={background} x={x} y={y} alpha={0}
        draw={(g) => { g.clear(); g.roundRect(-48, -16, 96, 32, 16).fill(0x493713).stroke({ color: 0xffd54a, width: 2 }); }} />
      <pixiText ref={label} text="JUARA 1" x={x} y={y} alpha={0} anchor={0.5} resolution={2}
        style={{ fill: 0xffe28a, fontSize: 16, fontWeight: '900', fontFamily: 'system-ui' }} />
    </pixiContainer>
  );
}
