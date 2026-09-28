export const GAMBAR_MEJA = [
  { id: 'hijau', name: 'Hijau klasik', color: '#1d6b45' },
  { id: 'kayu', name: 'Kayu hangat', color: '#785036' },
  { id: 'biru', name: 'Biru malam', color: '#173c58' },
] as const;

export type GambarMeja = (typeof GAMBAR_MEJA)[number]['id'];

const STORAGE_KEY = 'gaple:gambar-meja';

export function gambarMejaAwal(): GambarMeja {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const match = GAMBAR_MEJA.find((item) => item.id === saved);
    if (match) return match.id;
  } catch { /* Private browsing may block storage. */ }
  return 'hijau';
}

export function pilihGambarMeja(id: GambarMeja) {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* Selection still works for this visit. */ }
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    void navigator.serviceWorker.ready.then((registration) => {
      registration.active?.postMessage({ type: 'CACHE_TABLE', id });
    });
  }
}

export function gambarMejaUrl(id: GambarMeja) {
  return `${import.meta.env.BASE_URL}meja/${id}.svg`;
}
