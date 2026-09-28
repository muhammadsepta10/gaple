# 03 — Terputus, kembali ke kursi, bot ambil alih, pindah host

Status: ready-for-agent
Blocked by: 02

## Parent

`.scratch/mode-online/spec.md`

## What to build

Permainan tetap wajar ketika pemain **Terputus**.

- **Token pemain** dibuat sekali per browser dan disimpan di `localStorage`, lalu dikirim di opsi join. Server memetakan token ke tempatnya di ruang. `sessionId` Colyseus bukan identitas, dan `allowReconnection` tidak dipakai. Token yang dikenal ruang langsung kembali ke kursi, kartu, dan total poinnya tanpa mengisi nama, lalu menerima snapshot. Riwayat animasi tidak diputar ulang.
- Koneksi baru dengan token yang sedang tersambung memutus koneksi lama. Artinya tab kedua mengambil alih.
- **Menyambung ulang otomatis** dengan backoff dan indikator "menyambung ulang…".
- **Penanda Terputus** tampil di pil info kursi dan di lobi.
- **Lobi:** pemain Terputus tetap memegang kursi dan nama panggilannya. Host bisa mengosongkan kursinya. "Keluar ruang" mengosongkan kursi dan melepas nama. Pemain Terputus tetap ikut saat host memulai game.
- **Saat game berjalan:** keluar sama dengan Terputus, dan game menunggu gilirannya. Game tetap berjalan selama masih ada pemain manusia lain.
- **Ambil alih bot:** 5 menit sejak giliran pemain manusia dimulai (setelah jendela presentasi sebelumnya selesai), baik ia tersambung maupun Terputus. Bot bermain atas nama pemain itu dan hasilnya tetap dihitung untuknya.
- **Kembali dari ambil alih:** pemilik token langsung memegang kursinya lagi. Langkah bot yang sudah terjadwal dibatalkan. Jika saat itu gilirannya, tenggat 5 menit dimulai lagi dari awal.
- **Pindah host:** host berpindah ke pemain manusia tersambung berikutnya searah jarum jam saat host diambil alih bot di tengah game, atau Terputus 2 menit saat game tidak berjalan. Jika tidak ada yang tersambung, ruang sementara tanpa host, dan pemain manusia pertama yang tersambung lagi menjadi host. Host lama yang kembali menjadi pemain biasa.

## Acceptance criteria

- [ ] Refresh, tutup tab, atau putus jaringan lalu membuka tautan lagi dari browser yang sama mengembalikan pemain ke kursi, kartu, dan total poin yang sama tanpa mengisi nama.
- [ ] Membuka ruang di tab kedua memindahkan kendali ke tab baru, dan tab lama diberi tahu bahwa ia terputus.
- [ ] Pemain yang diam 5 menit di gilirannya diambil alih bot. Setelah ia kembali, kendali langsung pulih dan langkah bot yang tertunda batal.
- [ ] Host berpindah sesuai aturan di atas, baik di tengah game maupun di lobi.
- [ ] Tes paket ruang dengan waktu disuntikkan: properti bahwa token yang sama selalu kembali ke kursi, kartu, dan total poin yang sama; properti bahwa ruang di luar game tidak pernah lebih dari 2 menit tanpa host tersambung selama masih ada manusia tersambung; skenario ambil alih bot dan kembali.
- [ ] Tes integrasi server: token yang sama di koneksi kedua memutus koneksi pertama.
- [ ] Verifikasi agent-browser: refresh tab di tengah ronde lalu kembali ke kursi dan kartu yang sama.

## Blocked by

- `02-main-bersama-teman.md`
