# Verifikasi agent-browser — tiket 01 (game online lawan bot)

Dijalankan agen dengan `/agent-browser`, bukan Playwright.

## Persiapan

```bash
pnpm dev:server   # Colyseus di :2567
pnpm dev          # Vite; klien dev tersambung ke <host>:2567
```

## Skenario A — satu game penuh melawan tiga bot

1. Buka aplikasi, tekan **Main online**.
2. Isi nama panggilan, tekan **Buat ruang**. Lobi menampilkan kursi 1 = nama sendiri + label Host, tiga kursi kosong, dan "Target 100 poin · Balak ganda mati".
3. Tekan **Mulai**. Meja tampil dengan animasi bagi kartu, tiga kursi lawan berlabel BOT, dan tangan sendiri terbuka.
4. Setiap kali ada tombol tersembunyi `[data-testid=legal-move]`, klik lewat DOM (`element.click()`; tombolnya ter-clip sehingga klik pointer tidak sampai).
5. Ulangi sampai `[data-testid=final-score]` tampil.

Yang diharapkan: langkah bot dan ronde berikutnya selalu muncul setelah animasi sebelumnya, ringkasan ronde tampil di antara ronde, dan hasil akhir tampil.

## Skenario B — tab disembunyikan lalu dibuka lagi

1. Di tengah game, sembunyikan tab (buka tab lain) selama ±15 detik, sementara bot terus bermain di server.
2. Kembali ke tab. Meja langsung menampilkan keadaan terbaru (jumlah kartu, susunan, skor, dan giliran sesuai server) tanpa memutar ulang langkah yang terlewat.

## Hasil

Dijalankan 2026-09-28 (Chromium via agent-browser, viewport 1280×720).

- **Skenario A: lulus.** Ruang dibuat, lobi menampilkan host dan tiga kursi kosong. Setelah Mulai, meja tampil dengan tiga bot. Game dimainkan sampai skor akhir (Juara 1: 44 poin, lainnya 50/84, Kalah: 103 poin). Balak, pass, ringkasan ronde, dan ronde berikutnya tampil berurutan.
- **Temuan dan perbaikannya:** di skor akhir, nama kursi bot kosong karena proyeksi lobi menganggap kursi bot kosong di fase `hasil`. Sudah diperbaiki, dan tes paket ruang serta tes server sekarang memeriksanya.
- **Skenario B: lulus.** `visibilityState` tercatat `hidden` lalu `visible` (sekitar 20 detik). Begitu kembali, meja langsung menampilkan susunan, jumlah kartu, dan giliran terbaru, dan kartu legal langsung terbuka.
- **Catatan:** HMR Vite di tengah game melepas pemain dari ruang, karena efek unmount memanggil keluar. Kembali ke kursi dikerjakan di tiket 03.
