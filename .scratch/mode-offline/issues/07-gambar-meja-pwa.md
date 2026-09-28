# 07 — Gambar meja dan PWA offline

Status: done
Blocked by: 06

## Parent

`.scratch/mode-offline/spec.md`

## What to build

- **Gambar meja:**
  - koleksi gambar disiapkan di folder aset;
  - pemain memilih **Gambar meja** dari menu, dan pilihan diingat di `localStorage`;
  - hanya gambar yang dipilih yang dimuat.
- **PWA:**
  - manifest agar aplikasi bisa dipasang ke layar utama (orientasi tidak dikunci);
  - service worker mem-precache shell aplikasi, kode, suara, dan gambar meja bawaan;
  - gambar meja lain di-cache saat pertama kali dipilih.
- **Smoke test Playwright:** memulai game offline, memainkan setidaknya satu sesi sampai ringkasan sesi muncul, lalu memuat ulang aplikasi tanpa jaringan dan memastikan aplikasi masih bisa dimainkan.

## Acceptance criteria

- [ ] Pemain bisa memilih gambar meja, dan pilihan bertahan setelah reload.
- [ ] Hanya gambar meja yang dipilih yang diunduh (dicek di tab network).
- [ ] Aplikasi bisa dipasang sebagai PWA di Android Chrome dan iOS Safari.
- [ ] Setelah kunjungan pertama, aplikasi terbuka dan bisa dimainkan tanpa internet.
- [ ] Smoke test Playwright lulus: satu sesi selesai, dan aplikasi tetap bisa dibuka setelah jaringan dimatikan.

## Blocked by

- 06
