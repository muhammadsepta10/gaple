# 08 — Uji di HP asli dan review visual

Status: done
Blocked by: 07

## Parent

`.scratch/mode-offline/spec.md`

## What to build

Pengguna menguji tahap 1 di HP asli dan laptop untuk memutuskan apakah tahap ini siap dirilis.

- **Target performa** (usulan di spec):
  - 60 fps di laptop;
  - minimal 50 fps di HP Android kelas menengah;
  - dibuka ulang dari cache PWA dan siap bermain dalam kurang dari 2 detik.
- **Review visual:** membandingkan tampilan dengan screenshot prototype.
- **Konfirmasi asumsi** di Further Notes spec:
  - gaplek langsung diumumkan tanpa empat gelembung pass;
  - ringkasan sesi tampil 5 detik;
  - pemain manusia bernama "Kamu" dan bot memakai nama tetap.

Perbaikan yang ditemukan dicatat sebagai tiket baru.

## Acceptance criteria

- [ ] Angka performa diukur di minimal satu HP Android asli dan laptop, lalu dicatat di bagian Comments tiket ini.
- [ ] Target performa disetujui pengguna, atau diubah dengan angka baru yang disepakati.
- [ ] Tampilan meja dan efek disetujui pengguna.
- [ ] Ketiga asumsi di Further Notes spec dikonfirmasi atau diubah.
- [ ] Temuan yang perlu diperbaiki sudah menjadi tiket baru di `.scratch/mode-offline/issues/`.

## Blocked by

- 07

## Comments

### 2026-09-28 — persiapan review

- Build produksi diuji di Mac Apple M4, RAM 16 GiB, Chromium headless 153.0.8010.12. Skrip: `node .scratch/mode-offline/review-bench.mjs` setelah `pnpm build` dan `pnpm --filter @gaple/web exec vite preview --host 127.0.0.1 --port 4173 --strictPort`. FPS di bawah ialah **proksi** dari selang `requestAnimationFrame`, bukan hitungan frame Pixi yang benar-benar digambar. Sampel diambil selama 5 detik pertama setelah masuk meja, lalu 5 detik setelah satu langkah manusia. Lima pengulangan:

  | Viewport | Awal meja (fps) | Setelah langkah (fps) | Kunjungan ulang dari cache, menu siap (ms) |
  | --- | --- | --- | --- |
  | 844×390, **simulasi viewport di laptop** | 56,0 / 56,0 / 56,2 / 56,0 / 56,0 | 60,0 / 60,0 / 60,0 / 60,0 / 60,0 | 33 / 28 / 28 / 27 / 27 |
  | 1440×900, laptop | 55,4 / 54,6 / 55,0 / 54,0 / 54,8 | 59,8 / 60,0 / 60,0 / 59,2 / 59,4 | 31 / 27 / 29 / 27 / 27 |

- Pada pengulangan terakhir, ada jeda satu frame 350 ms pada simulasi HP dan 333 ms pada laptop saat awal meja. Temuan ini dicatat di tiket 09. Nilai awal belum memenuhi usulan 60 fps secara rata-rata. Pengukuran ini **bukan** hasil HP Android asli. Waktu cache dihitung dari reload offline sampai tombol **Main offline** muncul; belum mengukur waktu sampai giliran manusia dapat bertindak.
- Kandidat visual 844×390: [`../review/844-table.png`](../review/844-table.png), dibandingkan dengan [`../../prototype-meja/shots/D-hp.png`](../../prototype-meja/shots/D-hp.png). Kursi, deret punggung kartu, kipas tangan, dan area rantai mengikuti komposisi prototype. Latar produksi memakai tekstur; prototype memakai warna polos. Efek bergerak dan rantai 28 kartu tetap perlu dilihat saat bermain di HP asli. Keputusan visual tetap milik pengguna.
- `adb devices -l` tidak menemukan perangkat Android yang tersambung. Ukur di minimal satu HP Android asli; catat model, versi Chrome, ukuran layar, FPS 5 detik awal meja dan 5 detik setelah memasang kartu, serta waktu reload offline sampai menu siap. Jalankan tiga kali pada build produksi yang sama. Catat hasil di sini.
- Keputusan pengguna masih diperlukan: target 60 fps laptop / 50 fps HP / <2 detik cache (atau angka pengganti), persetujuan visual meja dan efek, serta tiga asumsi di Further Notes spec: gaplek langsung tanpa empat pass; ringkasan 5 detik; nama **Kamu** + nama bot tetap.

### 2026-09-28 — ditutup

- Pengguna menguji di HP asli dan menyatakan permainan berjalan normal. Tiket dinyatakan selesai.
- Target performa, tampilan meja dan efek, serta tiga asumsi di Further Notes spec (gaplek langsung tanpa empat pass; ringkasan 5 detik; nama **Kamu** + nama bot tetap) diterima sesuai perilaku saat ini.
- Angka FPS di HP asli tidak dicatat. Jika nanti ada keluhan performa, ukur ulang dengan langkah di komentar persiapan review.
