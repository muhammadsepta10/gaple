import { DURASI } from './durasi';

/** Bentuk minimum event yang menentukan durasi presentasi; dipenuhi `GameEvent` maupun event tersensor. */
export type EventTempo =
  | { readonly type: 'dealt' }
  | { readonly type: 'cardPlaced'; readonly balak: boolean }
  | { readonly type: 'pass' }
  | { readonly type: 'sessionEnded'; readonly cause: { readonly kind: 'emptyHand' | 'gaplek' } }
  | { readonly type: 'gameEnded'; readonly result: { readonly champions: readonly unknown[] } };

/** Lama presentasi satu event di layar (ms). */
export function durasiEvent(event: EventTempo): number {
  switch (event.type) {
    case 'dealt': return DURASI.bagiTotal;
    case 'cardPlaced': return DURASI.kartuTerbang + (event.balak ? DURASI.balak : 0);
    case 'pass': return DURASI.pass;
    case 'sessionEnded': return event.cause.kind === 'emptyHand' ? DURASI.menangRonde : DURASI.gaplek;
    case 'gameEnded': return event.result.champions.length > 0 ? DURASI.juara : 0;
  }
}

/**
 * Panjang jendela presentasi satu transisi: jumlah durasi event, ditambah ringkasan ronde
 * bila ronde berakhir tanpa mengakhiri game.
 */
export function durasiJendela(events: readonly EventTempo[]): number {
  const total = events.reduce((t, e) => t + durasiEvent(e), 0);
  const rondeBerakhir = events.some((e) => e.type === 'sessionEnded');
  const gameBerakhir = events.some((e) => e.type === 'gameEnded');
  return total + (rondeBerakhir && !gameBerakhir ? DURASI.ringkasanRonde : 0);
}

