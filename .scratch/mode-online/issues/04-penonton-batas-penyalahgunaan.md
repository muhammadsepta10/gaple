# 04 — Penonton dan batas penyalahgunaan

Status: done
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

- [x] Membuka tautan saat game berjalan memasukkan orang itu sebagai penonton yang melihat meja, susunan kartu, dan skor, tetapi tidak melihat tangan siapa pun.
- [x] Penonton ke-9 ditolak dengan pesan ruang penuh.
- [x] Setelah game selesai, penonton bisa duduk di kursi kosong atau kursi bot.
- [x] Tes paket ruang: properti bahwa tidak ada pesan ke penonton yang memuat kartu tangan siapa pun sebelum ronde berakhir; aturan kursi bot sejak awal vs bot pengganti.
- [x] Tes integrasi server untuk ketiga batas (buat ruang, tebakan kode, laju pesan) dan untuk endpoint jumlah ruang aktif.
- [x] Verifikasi agent-browser: penonton masuk di tengah game dan tidak melihat tangan.

## Blocked by

- `03-terputus-bot-pengganti-host.md`

## Comments

- (tiket 04 selesai) Verifikasi: `.scratch/mode-online/verifikasi-04-penonton.md`. Keputusan yang perlu diketahui tiket berikutnya:
  - `VERSI_PROTOKOL` naik ke 4: `pandangan` pada `snapshot`/`transisi` kini `Pandangan` (`SeatView | PublicView`); penonton menerima `PublicView` dan event `dealt` dengan `hand: null`. `LobiPublik`/Schema punya `penonton` (nama penonton yang tersambung). Alasan tolak baru `batas-terlampaui` (dari adaptor).
  - Penonton = orang di ruang tanpa kursi. Selain token baru saat game berjalan, pendatang di lobi saat keempat kursi diisi manusia juga menjadi penonton (dulu ditolak "ruang penuh"); glosarium `CONTEXT.md` diperbarui.
  - Batas 8 penonton menghitung yang Terputus juga, supaya `orang` tidak menumpuk. Pendatang baru menggantikan penonton yang Terputus (token itu lalu harus mengisi nama lagi); "ruang penuh" hanya jika kedelapannya tersambung. Penonton yang keluar saat game berjalan dilepas beserta namanya.
  - Tenggat hapus ruang kini hanya menghitung pemain yang duduk dan tersambung (sesuai spec "pemain manusia"); penonton tidak menahan ruang.
  - Batas matchmaking (`apps/server/src/batas.ts`) membungkus `matchMaker.controller.invokeMethod`, karena Colyseus tidak punya kait untuk kode yang tidak ditemukan. Setelah batas tebakan terlampaui, semua `joinById` dari IP itu ditolak selama jendela 1 menit, termasuk kode yang benar. Pembuatan ruang hanya dihitung jika berhasil. Batas pesan memakai `maxMessagesPerSecond` bawaan Colyseus (koneksi ditutup, klien menyambung ulang sendiri).
  - **Untuk tiket 06:** IP diambil dari hop terakhir `X-Forwarded-For`, yang harus ditulis Caddy (`reverse_proxy` bawaan tidak mempercayai XFF kiriman klien). Jangan expose port Node langsung ke internet, dan jangan pasang `trusted_proxies` yang terlalu longgar. Tanpa proxy semua permintaan berbagi satu kunci. Endpoint kesehatan: `GET /kesehatan` → `{ "ruangAktif": n }`.
  - Tes integrasi server kini `listen(PORT)` sendiri lalu `new ColyseusTestServer(server)`, karena `boot()` mengabaikan port untuk instance `Server` (selalu 2568), sehingga file tes paralel bentrok.
