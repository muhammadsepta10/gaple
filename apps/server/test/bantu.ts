import { chooseMove, type SeatView } from '@gaple/aturan';
import type { Room } from '@colyseus/sdk';
import { VERSI_PROTOKOL, type Pesan } from '@gaple/ruang';

export type Pemain = { room: Room; pesan: Pesan[]; lobi: string[] };

export function rekam(room: Room): Pemain {
  const pemain: Pemain = { room, pesan: [], lobi: [] };
  room.onMessage('pesan', (p: Pesan) => pemain.pesan.push(p));
  room.onStateChange((state) => pemain.lobi.push(JSON.stringify(state.toJSON())));
  return pemain;
}

/** Bermain otomatis: pada gilirannya, tunggu sisa jendela presentasi (dibagi `skala`) lalu kirim langkah bot. */
export function mainOtomatis(p: Pemain, skala: number) {
  let tunda: ReturnType<typeof setTimeout> | undefined;
  let terakhir: SeatView | null = null;
  const coba = (ms: number) => {
    clearTimeout(tunda);
    const view = terakhir;
    if (!view || view.gameResult || view.sessionResult || view.turn !== view.seat) return;
    tunda = setTimeout(() => {
      const m = chooseMove(view);
      p.room.send('pasang', { cardId: m.cardId, end: m.end });
    }, ms);
  };
  p.room.onMessage('pesan', (pesan: Pesan) => {
    if (pesan.jenis === 'transisi' || pesan.jenis === 'snapshot') {
      terakhir = pesan.pandangan as SeatView | null;
      coba(pesan.sisaPresentasi / skala + 1);
    } else if (pesan.alasan === 'masih-presentasi') coba(2);
  });
}

export async function tunggu(syarat: () => boolean | Promise<boolean>, batas = 20_000) {
  const mulai = Date.now();
  while (!(await syarat())) {
    if (Date.now() - mulai > batas) throw new Error('waktu habis');
    await new Promise((r) => setTimeout(r, 5));
  }
}

export const opsi = (token: string, nama: string) => ({ token, nama, versi: VERSI_PROTOKOL });
