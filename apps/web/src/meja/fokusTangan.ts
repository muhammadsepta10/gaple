/**
 * Fokus kartu di tangan, seperti Yu-Gi-Oh! Duel Links: mouse di atas kartu mengangkatnya;
 * di layar sentuh, kartu terangkat selama ditekan (jari boleh digeser ke kartu lain),
 * dan kartu baru terklik saat jari dilepas di atasnya.
 */
export type Alat = 'mouse' | 'touch' | 'pen';
export type Fokus = { readonly kartu: string | null; readonly ditekan: boolean };
export type AksiFokus =
  | { tipe: 'masuk' | 'keluar' | 'tekan' | 'lepas'; kartu: string; alat: Alat }
  | { tipe: 'lepasDiLuar'; alat: Alat };

export const FOKUS_AWAL: Fokus = { kartu: null, ditekan: false };

export function fokusTangan(fokus: Fokus, aksi: AksiFokus): { fokus: Fokus; klik?: string } {
  const sentuh = aksi.alat === 'touch';
  switch (aksi.tipe) {
    case 'masuk':
      // Jari yang lewat tanpa menekan kartu tidak mengangkat apa pun.
      return { fokus: sentuh && !fokus.ditekan ? fokus : { ...fokus, kartu: aksi.kartu } };
    case 'keluar':
      return { fokus: fokus.kartu === aksi.kartu ? { ...fokus, kartu: null } : fokus };
    case 'tekan':
      return { fokus: { kartu: aksi.kartu, ditekan: true } };
    case 'lepas':
      if (!fokus.ditekan) return { fokus };
      // Setelah dilepas, jari sudah tidak di layar; mouse masih di atas kartu.
      return { fokus: { kartu: sentuh ? null : aksi.kartu, ditekan: false }, klik: aksi.kartu };
    case 'lepasDiLuar':
      return { fokus: sentuh ? FOKUS_AWAL : { ...fokus, ditekan: false } };
  }
}
