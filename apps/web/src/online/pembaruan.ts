const KUNCI_PEMBARUAN = 'gaple.pembaruan';
/** Pembaruan paksa tidak diulang dalam jangka ini, supaya server yang lebih lama dari klien tidak membuat halaman memuat ulang terus. */
const JEDA_PEMBARUAN = 60_000;
/** Batas menunggu service worker baru aktif sebelum tetap memuat ulang. */
const BATAS_TUNGGU_SW = 10_000;

function bacaSesi(): number {
  try { return Number(sessionStorage.getItem(KUNCI_PEMBARUAN)) || 0; } catch { return 0; }
}

function tulisSesi(nilai: number) {
  try { sessionStorage.setItem(KUNCI_PEMBARUAN, String(nilai)); } catch { /* tanpa storage: jeda tidak diingat */ }
}

/** Menunggu service worker `sw` aktif (atau gagal dipasang), paling lama `BATAS_TUNGGU_SW`. */
function tungguAktif(sw: ServiceWorker): Promise<void> {
  return new Promise((selesai) => {
    const cek = () => { if (sw.state === 'activated' || sw.state === 'redundant') selesai(); };
    sw.addEventListener('statechange', cek);
    setTimeout(selesai, BATAS_TUNGGU_SW);
    cek();
  });
}

/**
 * Server meminta versi protokol lain: paksa service worker mengambil versi aplikasi terbaru, lalu
 * muat ulang halaman di tautan ruang `kode` (atau halaman sekarang jika `null`). Setelah dimuat
 * ulang, klien masuk lagi dengan token yang sama dan kembali ke tempatnya tanpa aksi pemain.
 * `false` jika pembaruan baru saja dicoba dan tidak menolong; pemanggil menampilkan pesan.
 */
export async function perbaruiAplikasi(kode: string | null): Promise<boolean> {
  if (Date.now() - bacaSesi() < JEDA_PEMBARUAN) return false;
  tulisSesi(Date.now());
  if (kode) history.replaceState(null, '', `${import.meta.env.BASE_URL}r/${kode}`);
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.update();
      // Service worker baru memanggil skipWaiting + clients.claim dan menghapus cache lama saat aktif.
      const baru = reg.installing ?? reg.waiting;
      if (baru) await tungguAktif(baru);
    }
  } catch { /* tanpa service worker, memuat ulang sudah mengambil versi terbaru */ }
  location.reload();
  return true;
}
