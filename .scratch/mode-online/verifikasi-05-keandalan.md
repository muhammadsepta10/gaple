# Verifikasi agent-browser — tiket 05 (keandalan, versi protokol)

Dijalankan agen dengan `/agent-browser`, bukan Playwright. Setiap orang memakai sesi browser terpisah (`--session <nama>`).

## Persiapan

```bash
docker run -d --name gaple-redis -p 127.0.0.1:6390:6379 redis:7-alpine redis-server --appendonly yes --appendfsync everysec
REDIS_URL=redis://127.0.0.1:6390 PORT=2577 npx tsx apps/server/src/main.ts   # tanpa watch: restart manual
VITE_SERVER_URL=http://localhost:2577 npx vite --port 5183                   # skenario A
```

Skenario B memakai build produksi (`pnpm build` lalu `vite preview`), karena dev server Vite memuat ulang halaman sendiri saat ia di-restart dan tidak memasang service worker.

## Skenario A — server di-restart saat game berjalan

1. Host membuat ruang, teman bergabung lewat tautan, host memulai game (dua bot). Host memasang satu kartu; kini giliran teman.
2. Screenshot meja teman, lalu matikan server paksa (`kill -9`, seperti crash) selama ±10 detik, lalu nyalakan lagi.
3. Yang diharapkan: kedua klien menampilkan "Menyambung ulang…", lalu kembali sendiri ke kursi dan kartu yang sama; game berlanjut.

## Skenario B — versi protokol berbeda

1. Kedua klien sedang di meja dengan build versi N.
2. Naikkan `VERSI_PROTOKOL`, build ulang web, restart server.
3. Yang diharapkan: klien ditolak "perlu-pembaruan", service worker mengambil versi baru, halaman dimuat ulang di `/r/<kode>`, dan pemain kembali ke kursinya tanpa aksi apa pun.

## Skenario C — main online tanpa internet

1. Browser offline, tekan **Main online**.
2. Yang diharapkan: pesan "Main online butuh koneksi internet…" dengan tombol kembali ke menu. Saat online lagi, formulir masuk tampil.

## Hasil

Dijalankan 2026-09-29 (Chromium via agent-browser, viewport 1280×720).

- **Skenario A: lulus.** Setelah `kill -9`, kedua tab menampilkan "Menyambung ulang…". Server baru memulihkan ruang (`/kesehatan` → `ruangAktif: 1`), kedua klien kembali tanpa aksi, dan screenshot meja teman sebelum dan sesudah identik (kursi, tujuh kartu, susunan, poin). Teman lalu memasang kartu, kedua bot bermain, dan giliran pindah ke host.
- **Skenario B: lulus.** Host dengan bundle lama dimuat ulang ke bundle baru (cache service worker ikut berganti) dan kembali ke meja dengan langkah legal pada gilirannya. Dengan kedua klien di meja, server di-restart dengan versi baru: keduanya pindah ke bundle baru dan kembali ke kursinya tanpa aksi.
- Catatan: percobaan pertama skenario B berakhir di "Ruang sudah tidak tersedia", karena halaman dev versi lebih baru sempat menyambung ke server versi lama dan mengisi penanda `gaple.pembaruan`. Penjaga 60 detik lalu menahan pembaruan berikutnya, sesuai desain untuk mencegah muat ulang tanpa henti. Setelah penjaga lewat, alurnya berjalan seperti yang diharapkan.
- **Skenario C: lulus.** Offline menampilkan pesan butuh internet; kembali online menampilkan formulir masuk.
- **Tidak diverifikasi di browser** (sudah dites di paket ruang dan tes integrasi Redis): tenggat 5 menit / 2 menit / 10 menit yang digeser waktu henti, dan penolakan "ruang sudah dihapus" untuk kode bekas.
