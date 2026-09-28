# 09 — Profil jeda frame saat awal meja

Status: wontfix
Blocked by: 08

## Parent

`.scratch/mode-offline/spec.md`

## Temuan

Pengukuran awal build produksi pada Mac Apple M4, Chromium headless 153, menunjukkan satu jeda `requestAnimationFrame` sekitar 333 ms sesaat setelah masuk meja. Rata-rata 5 detik pertama 54,0–55,4 fps pada 1440×900, di bawah target usulan 60 fps. Setelah langkah manusia proksi mencapai 59,2–60,0 fps. Ini proksi cadence browser, belum menghitung frame Pixi yang digambar. Hasil headless perlu dikonfirmasi pada browser laptop yang terlihat dan HP Android asli sebelum menyimpulkan dampak pengguna.

## Tindak lanjut

- Rekam trace Performance saat 5 detik pertama masuk meja; identifikasi penyebab jeda panjang.
- Jika jeda juga terlihat di perangkat asli, kurangi kerja pada frame awal dan ukur ulang terhadap target yang disetujui di tiket 08.
- Catat perangkat, versi browser, langkah reproduksi, FPS, dan frame terpanjang sebelum/sesudah perbaikan.

## Comments

### 2026-09-28 — triage

- `wontfix`. Jeda hanya terlihat pada proksi Chromium headless. Uji di HP asli (tiket 08) berjalan normal, tanpa keluhan jeda di awal meja.
- Buka kembali (`needs-triage`) jika jeda awal meja terasa di perangkat asli.
