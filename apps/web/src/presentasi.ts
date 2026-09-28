import type { Card, Seat, SessionEndCause } from '@gaple/aturan';

/** Event visual yang dipakai pengendali offline maupun pengendali online kelak. */
export type Presentation =
  | { readonly kind: 'deal'; readonly key: number; readonly at: number }
  | { readonly kind: 'move'; readonly key: number; readonly at: number; readonly cardId: string; readonly seat: Seat }
  | { readonly kind: 'pass'; readonly key: number; readonly at: number; readonly seat: Seat }
  | { readonly kind: 'balak'; readonly key: number; readonly at: number; readonly pip: number }
  | { readonly kind: 'win'; readonly key: number; readonly at: number; readonly seat: Seat }
  | { readonly kind: 'gaplek'; readonly key: number; readonly at: number; readonly pip: number }
  | { readonly kind: 'champion'; readonly key: number; readonly at: number; readonly seats: readonly Seat[] };

export type PresentationEvent = Presentation extends infer E ? E extends Presentation ? Omit<E, 'key' | 'at'> : never : never;

/** Ringkasan ronde yang tampil di antara ronde. */
export type SessionSummary = {
  readonly cause: SessionEndCause;
  readonly hands: readonly (readonly Card[])[];
  readonly sessionPoints: readonly number[];
  readonly totals: readonly number[];
};
