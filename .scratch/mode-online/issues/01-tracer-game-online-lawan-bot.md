# 01 — Tracer: game online penuh melawan bot

Status: done
Blocked by: None

## Parent

`.scratch/mode-online/spec.md`

## What to build

Irisan pertama dari ujung ke ujung. Seorang pemain memilih "Main online", membuat **Ruang privat** dengan **Nama panggilan**, lalu masuk ke lobi minimal dan menekan Mulai. Tiga kursi lain diisi **Bot**. Game dimainkan sampai hasil akhir, dengan meja, animasi, dan suara yang sama seperti mode offline. Bedanya, semua keputusan dibuat di server.

Tiket ini juga menyiapkan kerangka:
- **paket ruang**: TypeScript murni tanpa jaringan, timer, jam sistem, atau `Math.random`, bergantung pada paket aturan (spec, Modul 1);
- **aplikasi server**: Node.js + Colyseus. Pada tiket ini ruang masih disimpan di memori saja, tanpa Redis;
- **tabel durasi presentasi** dipindah dari aplikasi web ke paket ruang. Mode offline meng-import tabel dari sana tanpa mengubah perilaku.

Perilaku yang dibangun dalam irisan ini:
- Paket ruang menyediakan `terapkan(state, perintah, sekarang)` dan `jalankanTenggat(state, sekarang)`. Keduanya menghasilkan state baru, pesan per penerima, dan tenggat terdekat. Sumber acak disuntikkan.
- Perintah yang diperlukan: masuk (token, nama, versi protokol), mulai game, dan pasang kartu. Token hanya dibuat sederhana di klien; perilaku kembali ke kursi dikerjakan di tiket 03.
- **Server memegang tempo.** Setiap transisi membuka jendela presentasi dari tabel durasi. Langkah manusia sebelum jendela selesai ditolak ("masih presentasi"). Langkah bot dijadwalkan di akhir jendela ditambah jeda berpikir bot. Ringkasan ronde tampil, lalu ronde berikutnya dimulai otomatis. Tidak ada ack dari klien.
- **Pesan tersensor per penerima.** Event kartu dibagikan hanya berisi tangan si penerima ditambah jumlah kartu kursi lain. Event lain bersifat publik. `GameState` utuh tidak pernah dikirim. Saat bergabung, klien menerima snapshot pandangan kursi ditambah sisa jendela presentasi.
- **Schema Colyseus** hanya berisi proyeksi lobi publik: fase, empat kursi, host, konfigurasi. Kartu tidak pernah ada di Schema.
- Seed setiap pembagian kartu diambil dari `crypto.getRandomValues`.
- **Pengendali game online di klien** menerima snapshot dan event, mengantrekan presentasi dengan durasi bersama, membuka input hanya pada gilirannya setelah jendela selesai, lalu mengirim niat pasang kartu. Presentasi meja tidak bergantung pada pengendali offline maupun online.
- **Penyusulan:** jika antrean presentasi klien tertinggal (tab di latar belakang, jaringan lambat, snapshot baru masuk), klien mempercepat atau melompati antrean untuk langsung menampilkan keadaan terbaru. Server tidak pernah menunggu klien.
- Konfigurasi masih bawaan (target 100, balak ganda mati). Kontrol host dikerjakan di tiket 02.

## Acceptance criteria

- [x] Paket ruang dan aplikasi server ada di monorepo. Paket ruang lolos typecheck tanpa dependensi jaringan, timer, atau jam.
- [x] Mode offline tetap berjalan seperti sebelumnya dengan tabel durasi dari paket ruang. Tes offline yang ada tetap hijau.
- [x] Dari menu, pemain bisa membuat ruang, menekan Mulai, dan memainkan game online melawan tiga bot sampai hasil akhir tampil.
- [x] Langkah bot dan ronde berikutnya tidak pernah mendahului jendela presentasi. Langkah manusia sebelum jendela selesai ditolak tanpa merusak tampilan.
- [x] Langkah tidak sah (bukan giliran, kartu tidak di tangan, tidak cocok) ditolak server dan hanya pengirimnya yang diberi tahu.
- [x] Tes paket ruang (vitest + fast-check): properti bahwa tidak ada pesan ke kursi mana pun yang memuat kartu tangan kursi lain sebelum ronde berakhir; properti tempo (tidak ada langkah diterima atau dijadwalkan sebelum jendela selesai); game dengan bot selalu selesai tanpa macet.
- [x] Tes integrasi server dengan klien Colyseus sungguhan: buat ruang, mulai, main sampai selesai; Schema tidak pernah berisi kartu.
- [x] Verifikasi agent-browser: satu game online melawan bot dimainkan sampai hasil akhir. Tab yang disembunyikan sebentar lalu dibuka lagi langsung menyusul keadaan terbaru.

## Blocked by

None - can start immediately
