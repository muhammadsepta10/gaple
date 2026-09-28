# 04 — Penonton dan batas penyalahgunaan

Status: ready-for-agent
Blocked by: 03

## Parent

`.scratch/mode-online/spec.md`

## What to build

Orang yang datang saat game berjalan bisa menonton, dan server terlindung dari penggunaan berlebihan.

- **Penonton:** token baru yang masuk saat game berjalan menjadi **Penonton**. Penonton menerima snapshot pandangan publik dan event publik (event kartu dibagikan hanya berisi jumlah kartu). Meja tampil tanpa kipas tangan dan diberi label penonton. Penonton maksimal 8 per ruang; lebih dari itu ditolak "ruang penuh". Penonton ikut dalam Schema lobi.
- **Aturan kursi saat game berjalan:** kursi "bot sejak awal" dimainkan bot sampai game selesai, dan kursi bot pengganti hanya bisa diambil pemilik token aslinya. Setelah game selesai, penonton bisa menempati kursi kosong atau kursi bot untuk game berikutnya.
- **Batas penyalahgunaan** (angka awal lewat konfigurasi): buat ruang maksimal 5 per IP per jam; join ke kode yang tidak dikenal maksimal 20 per IP per menit; maksimal sekitar 10 pesan per detik per koneksi, dan koneksi yang melanggar diputus. Pengirim perintah selalu diturunkan dari token, tidak pernah dari kursi kiriman klien.
- **Endpoint kesehatan** yang melaporkan jumlah ruang aktif.

## Acceptance criteria

- [ ] Membuka tautan saat game berjalan memasukkan orang itu sebagai penonton yang melihat meja, susunan kartu, dan skor, tetapi tidak melihat tangan siapa pun.
- [ ] Penonton ke-9 ditolak dengan pesan ruang penuh.
- [ ] Setelah game selesai, penonton bisa duduk di kursi kosong atau kursi bot.
- [ ] Tes paket ruang: properti bahwa tidak ada pesan ke penonton yang memuat kartu tangan siapa pun sebelum ronde berakhir; aturan kursi bot sejak awal vs bot pengganti.
- [ ] Tes integrasi server untuk ketiga batas (buat ruang, tebakan kode, laju pesan) dan untuk endpoint jumlah ruang aktif.
- [ ] Verifikasi agent-browser: penonton masuk di tengah game dan tidak melihat tangan.

## Blocked by

- `03-terputus-bot-pengganti-host.md`
