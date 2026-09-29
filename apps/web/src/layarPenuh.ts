/**
 * Memaksa meja tampil landscape di HP: masuk layar penuh lalu mengunci orientasi.
 * Hanya Chrome/Android (termasuk PWA terpasang) yang mengizinkannya; iPhone tidak punya API ini
 * sehingga tetap memakai layar "Putar HP". Harus dipanggil dari ketukan pengguna.
 */
type Orientasi = { lock?: (orientasi: 'landscape') => Promise<void>; unlock?: () => void };
export type Lingkungan = {
  dokumen: {
    fullscreenElement: Element | null;
    exitFullscreen: () => Promise<void>;
    documentElement: { requestFullscreen?: (opsi?: FullscreenOptions) => Promise<void> };
  };
  orientasi: Orientasi | undefined;
  /** Perangkat sentuh; laptop tidak dipaksa layar penuh. */
  sentuh: boolean;
};

const bawaan = (): Lingkungan => ({
  dokumen: document,
  orientasi: screen.orientation as unknown as Orientasi | undefined,
  sentuh: matchMedia('(pointer: coarse)').matches,
});

/** Layar penuh dimasuki oleh game (bukan pemain), jadi game pula yang keluar. */
let layarPenuhDariGame = false;

export const bisaKunciLandscape = (env: Lingkungan = bawaan()) =>
  env.sentuh && typeof env.dokumen.documentElement.requestFullscreen === 'function' && typeof env.orientasi?.lock === 'function';

export async function kunciLandscape(env: Lingkungan = bawaan()): Promise<boolean> {
  if (!bisaKunciLandscape(env)) return false;
  try {
    if (!env.dokumen.fullscreenElement) {
      // Dipanggil sebelum `await` pertama agar masih terhitung ketukan pengguna.
      const masuk = env.dokumen.documentElement.requestFullscreen!({ navigationUI: 'hide' });
      layarPenuhDariGame = true;
      await masuk;
    }
    await env.orientasi!.lock!('landscape');
    return true;
  } catch {
    return false;
  }
}

export function lepasLandscape(env: Lingkungan = bawaan()) {
  try {
    env.orientasi?.unlock?.();
  } catch {
    // Browser tanpa kunci aktif boleh menolak unlock.
  }
  if (layarPenuhDariGame && env.dokumen.fullscreenElement) env.dokumen.exitFullscreen().catch(() => {});
  layarPenuhDariGame = false;
}
