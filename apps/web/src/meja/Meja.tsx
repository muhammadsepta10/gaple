import { extend, useTick } from '@pixi/react';
import { legalMoves, SEATS, type End, type GameState, type Move, type Seat } from '@gaple/aturan';
import { Container, Graphics, Text } from 'pixi.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DURASI } from '@gaple/ruang';
import type { Presentation } from '../presentasi';
import { BigEffect, ChampionBadge, PassBubble } from './efek';
import { CardView, GOLD } from './kartu';
import { layoutChain, posisiKursi, tableLayout, type Rect } from './tataLetak';

extend({ Container, Graphics, Text });

const FONT = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

export type SeatInfo = {
  name: string;
  bot: boolean;
  /** Pemain manusia di kursi ini sedang Terputus (mode online). */
  terputus?: boolean;
};

type MejaProps = {
  w: number;
  h: number;
  state: GameState;
  seats: readonly SeatInfo[];
  /** Kursi manusia di layar ini; selalu digambar di bawah. */
  humanSeat: Seat;
  /** Tampilan penonton: kursi bawah juga digambar sebagai punggung kartu, tanpa kipas tangan. */
  penonton?: boolean;
  /** Pemain manusia boleh bertindak sekarang. */
  canAct: boolean;
  presentation: Presentation | null;
  onMove: (move: Move) => void;
};

export function Meja({ w, h, state, seats, humanSeat, penonton = false, canAct, presentation, onMove }: MejaProps) {
  const L = useMemo(() => tableLayout(w, h), [w, h]);
  const pos = (seat: Seat) => posisiKursi(seat, humanSeat);
  const { session } = state;
  const table = useRef<Container>(null);
  const effectStarted = useRef(performance.now());
  useEffect(() => { effectStarted.current = presentation?.at ?? performance.now(); }, [presentation?.key]);
  useTick(() => {
    const node = table.current;
    if (!node) return;
    const elapsed = performance.now() - effectStarted.current;
    const shake = presentation?.kind === 'balak'
      ? { duration: DURASI.getarBalak, amplitude: 5 }
      : presentation?.kind === 'gaplek'
        ? { duration: DURASI.getarGaplek, amplitude: 10 }
        : null;
    const force = shake && elapsed < shake.duration ? shake.amplitude * (1 - elapsed / shake.duration) : 0;
    node.position.set(force * Math.sin(elapsed * 0.22), force * Math.cos(elapsed * 0.29));
  });
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => setPending(null), [state]);

  const myMoves = canAct ? legalMoves(state).filter((m) => m.seat === humanSeat) : [];
  const endsFor = (cardId: string): End[] => myMoves.filter((m) => m.cardId === cardId).map((m) => m.end);

  const tapHand = (cardId: string) => {
    if (!canAct) return;
    if (pending === cardId) return setPending(null);
    const ends = endsFor(cardId);
    if (ends.length === 1) return onMove({ seat: humanSeat, cardId, end: ends[0]! });
    setPending(ends.length === 2 ? cardId : null);
  };

  const chain = useMemo(
    () => layoutChain(session.chain.placements, L.chainArea, L.chainMaxS),
    [session.chain.placements, L],
  );

  const hand = session.hands[humanSeat]!;
  // Satu array bersaudara menjaga instance CardView saat kartu pindah dari tangan ke rantai.
  const cards: React.ReactNode[] = [];
  const center = { x: w / 2, y: h / 2, rot: 0, scale: 0.25 };
  for (const seat of SEATS) {
    for (let i = 0; i < session.hands[seat]!.length; i++) {
      const card = session.hands[seat]![i]!;
      const mine = !penonton && seat === humanSeat;
      const legal = mine && endsFor(card.id).length > 0;
      const lift = mine ? pending === card.id ? 24 : legal ? 10 : 0 : 0;
      const motion = presentation?.kind === 'deal'
        ? { key: presentation.key, at: presentation.at, from: center, delay: (i * 4 + pos(seat)) * DURASI.jedaBagi }
        : undefined;
      cards.push(<CardView
        key={card.id}
        pose={mine ? L.hand(i, hand.length, lift) : L.back(pos(seat), i)}
        face={mine ? { top: card.a, bottom: card.b } : undefined}
        dim={mine && canAct && !legal}
        outline={mine && pending === card.id}
        onTap={mine && canAct ? () => tapHand(card.id) : undefined}
        motion={motion}
      />);
    }
  }
  for (const { placement, pose, face } of chain.poses) {
    const moving = presentation?.kind === 'move' && presentation.cardId === placement.card.id;
    cards.push(<CardView
      key={placement.card.id}
      pose={pose}
      face={face}
      motion={moving ? {
        key: presentation.key,
        at: presentation.at,
        flip: penonton || presentation.seat !== humanSeat,
        origin: L.back(pos(presentation.seat), session.hands[presentation.seat]!.length),
      } : undefined}
    />);
  }
  return (
    <pixiContainer ref={table}>
      {SEATS.map((seat) => (
        <SeatPill
          key={seat}
          rect={L.pill(pos(seat))}
          compact={L.compact}
          info={seats[seat]!}
          points={state.totals[seat]!}
          count={session.hands[seat]!.length}
          turn={!session.result && session.turn === seat}
        />
      ))}
      {cards}
      {pending &&
        (['left', 'right'] as const).map((end) => (
          <EndTarget
            key={end}
            x={chain.ends[end].x}
            y={chain.ends[end].y}
            size={chain.target}
            onTap={() => onMove({ seat: humanSeat, cardId: pending, end })}
          />
        ))}
      {presentation?.kind === 'pass' && <PassBubble key={presentation.key} at={presentation.at} rect={L.pill(pos(presentation.seat))} name={seats[presentation.seat]!.name} />}
      {presentation && (presentation.kind === 'balak' || presentation.kind === 'win' || presentation.kind === 'gaplek') &&
        <BigEffect key={presentation.key} event={presentation} seatNames={seats.map((seat) => seat.name)} w={w} h={h} />}
      {presentation?.kind === 'champion' && presentation.seats.map((seat) => (
        <ChampionBadge key={`${presentation.key}-${seat}`} rect={L.pill(pos(seat))} posisi={pos(seat)} at={presentation.at} />
      ))}
    </pixiContainer>
  );
}

function SeatPill({
  rect,
  compact,
  info,
  points,
  count,
  turn,
}: {
  rect: Rect;
  compact: boolean;
  info: SeatInfo;
  points: number;
  count: number;
  turn: boolean;
}) {
  const { x, y, w, h } = rect;
  const glow = useRef<Graphics>(null);
  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      g.roundRect(x, y, w, h, h / 2)
        .fill({ color: turn ? 0x3a2a05 : 0x0b1f16, alpha: 0.85 })
        .stroke({ color: turn ? GOLD : 0xffffff, width: 1.5, alpha: turn ? 1 : 0.25 });
      if (info.bot) g.roundRect(x + w - 36, y + h / 2 - 8, 28, 16, 8).fill(0x5b6b7a);
      // Penanda Terputus menempel di tepi atas pil agar tidak menabrak nama dan skor.
      if (info.terputus) g.roundRect(x + w - 66, y - 8, 58, 15, 7.5).fill(0xa8402f).stroke({ color: 0xffffff, width: 1, alpha: 0.6 });
    },
    [x, y, w, h, turn, info.bot, info.terputus],
  );
  // Penanda giliran: garis emas berdenyut.
  const pulse = useCallback(() => {
    const g = glow.current;
    if (!g) return;
    g.clear();
    if (!turn) return;
    const p = (Math.sin(performance.now() / DURASI.denyutGiliran) + 1) / 2;
    g.roundRect(x - 3 - p * 2, y - 3 - p * 2, w + 6 + p * 4, h + 6 + p * 4, h / 2 + 3).stroke({ color: GOLD, width: 3, alpha: 0.55 + 0.45 * p });
  }, [x, y, w, h, turn]);
  useTick(pulse);
  return (
    <pixiContainer>
      <pixiGraphics ref={glow} draw={() => {}} />
      <pixiGraphics draw={draw} />
      <pixiText text={info.name} x={x + 12} y={y + (compact ? 4 : 5)} resolution={2} style={{ fill: 0xffffff, fontSize: compact ? 12 : 13, fontWeight: '700', fontFamily: FONT }} />
      <pixiText text={`${points} poin · ${count} kartu`} x={x + 12} y={y + (compact ? 17 : 21)} resolution={2} style={{ fill: 0xcfe3d6, fontSize: compact ? 9.5 : 11, fontFamily: FONT }} />
      {info.bot && <pixiText text="BOT" anchor={0.5} x={x + w - 22} y={y + h / 2} resolution={2} style={{ fill: 0xffffff, fontSize: 9, fontWeight: '800', fontFamily: FONT }} />}
      {info.terputus && <pixiText text="TERPUTUS" anchor={0.5} x={x + w - 37} y={y - 0.5} resolution={2} style={{ fill: 0xffffff, fontSize: 8.5, fontWeight: '800', fontFamily: FONT }} />}
    </pixiContainer>
  );
}

/** Kotak emas berdenyut di ujung rantai untuk memilih ujung. */
function EndTarget({ x, y, size, onTap }: { x: number; y: number; size: number; onTap: () => void }) {
  const g = useRef<Graphics>(null);
  const pulse = useCallback(() => {
    const gg = g.current;
    if (!gg) return;
    const p = (Math.sin(performance.now() / DURASI.denyutUjung) + 1) / 2;
    gg.clear();
    gg.roundRect(x - size / 2, y - size / 2, size, size, 8).fill({ color: GOLD, alpha: 0.25 + 0.35 * p }).stroke({ color: GOLD, width: 3 });
  }, [x, y, size]);
  useTick(pulse);
  return <pixiGraphics ref={g} draw={() => {}} eventMode="static" cursor="pointer" onPointerTap={onTap} />;
}
