# Verifikasi agent-browser — tiket 02 (main bersama teman)

Dijalankan agen dengan `/agent-browser`, bukan Playwright. Setiap orang memakai sesi browser terpisah (`--session <nama>`), sehingga token di `localStorage` berbeda.

## Persiapan

```bash
pnpm dev:server   # Colyseus di :2567
pnpm dev          # Vite; klien dev tersambung ke <host>:2567
```

## Skenario A — host + teman + dua bot, satu game sampai ringkasan

1. **Host:** Main online → isi nama "Budi" → **Buat ruang**. URL menjadi `/r/<kode>`. Lobi menampilkan kode 6 karakter besar, tombol **Salin tautan** / **Bagikan**, kursi 1 = Budi (Host), tiga kursi kosong.
2. **Teman (lewat tautan):** buka `/r/<kode>`. Form menampilkan "Bergabung ke ruang <kode>". Isi "budi" → ditolak "Nama panggilan sudah dipakai…". Isi "Agus" → masuk lobi di kursi 2.
3. **Orang ketiga (kode manual):** Main online → nama "Joko" → kode dalam huruf kecil dengan tanda hubung (mis. `abc-def`) → Enter. Masuk lobi di kursi 3.
4. **Teman:** **Duduk di sini** pada kursi kosong → pindah kursi.
5. **Host:** pindahkan Agus lewat pilihan "Pindahkan…" ke kursi 2, lalu **Kosongkan** kursi Joko. Joko melihat "Kamu belum duduk". Ubah target poin ke 30 dan centang Balak ganda. Teman melihat "Target 30 poin · Balak ganda aktif" tanpa kontrol.
6. Tutup sesi Joko. **Host:** **Mulai game**. Kursi 3 dan 4 menjadi bot.
7. Kedua sesi mengklik `[data-testid=legal-move]` lewat DOM (`element.click()`) setiap kali muncul, sampai `[data-testid=session-summary]` dan akhirnya `[data-testid=final-score]` tampil.

Yang diharapkan: setiap pemain melihat dirinya di bawah meja dengan urutan kursi searah jarum jam; ringkasan ronde tampil untuk keduanya; skor akhir tampil untuk keduanya.

## Skenario B — game baru setelah hasil akhir

1. **Host:** di skor akhir tekan **Main lagi** → kembali ke lobi dengan kursi yang sama (kursi bot bertanda "(bot)" dan bisa diduduki).
2. Ubah target poin → **Mulai game**. Teman yang masih di layar skor akhir langsung pindah ke meja baru dengan total 0.

## Skenario C — token baru saat game berjalan

Sesi baru membuka `/r/<kode>` saat game berjalan dan mengisi nama → pesan "Game sedang berjalan. Coba lagi setelah game selesai."

## Hasil

Dijalankan 2026-09-28 (Chromium via agent-browser, viewport 1280×720; lobi juga dicek pada 390×844).

- **Skenario A: lulus.** Gabung lewat tautan dan lewat kode manual huruf kecil dengan tanda hubung berhasil. Nama bentrok beda huruf besar-kecil ditolak dengan pesan jelas. Pindah kursi, pindahkan oleh host, kosongkan, dan konfigurasi tampil di semua sesi. Meja teman (kursi 2) memutar kursi: Agus di bawah, Bot 3 di kiri, Bot 4 di atas, Budi di kanan. Dua belas ringkasan ronde teramati sebelum skor akhir (Bot 3 Juara 1 dengan 0 poin, Agus 13, Bot 4 dan Budi kalah).
- **Skenario B: lulus.** Host kembali ke lobi, mengubah target, lalu memulai game kedua. Overlay skor akhir di sesi teman hilang dan game baru dimulai dengan kursi sama dan total 0.
- **Skenario C: lulus.**
- **Temuan dan perbaikannya:** form "Main online" awalnya tidak punya tombol submit, sehingga Enter di kolom kode tidak melakukan apa pun. Sekarang **Gabung** menjadi tombol submit; Enter dengan kode terisi bergabung, tanpa kode membuat ruang.
- **Catatan:** HMR Vite di tengah verifikasi melepas semua pemain dan ruang terhapus, sehingga kode lama benar menampilkan "Kode ruang tidak ditemukan". Kembali ke kursi dikerjakan di tiket 03.
