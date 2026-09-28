# 03 — Terputus, kembali ke kursi, bot ambil alih, pindah host

Status: done
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

- [x] Refresh, tutup tab, atau putus jaringan lalu membuka tautan lagi dari browser yang sama mengembalikan pemain ke kursi, kartu, dan total poin yang sama tanpa mengisi nama.
- [x] Membuka ruang di tab kedua memindahkan kendali ke tab baru, dan tab lama diberi tahu bahwa ia terputus.
- [x] Pemain yang diam 5 menit di gilirannya diambil alih bot. Setelah ia kembali, kendali langsung pulih dan langkah bot yang tertunda batal.
- [x] Host berpindah sesuai aturan di atas, baik di tengah game maupun di lobi.
- [x] Tes paket ruang dengan waktu disuntikkan: properti bahwa token yang sama selalu kembali ke kursi, kartu, dan total poin yang sama; properti bahwa ruang di luar game tidak pernah lebih dari 2 menit tanpa host tersambung selama masih ada manusia tersambung; skenario ambil alih bot dan kembali.
- [x] Tes integrasi server: token yang sama di koneksi kedua memutus koneksi pertama.
- [x] Verifikasi agent-browser: refresh tab di tengah ronde lalu kembali ke kursi dan kartu yang sama.

## Blocked by

- `02-main-bersama-teman.md`

## Comments

- (tiket 03 selesai) Verifikasi: `.scratch/mode-online/verifikasi-03-terputus.md`. Keputusan yang perlu diketahui tiket berikutnya:
  - `VERSI_PROTOKOL` naik ke 3 (perintah baru `keluar`, `ambilKendali`; perintah adaptor `terputus`; alasan tolak `diambil-alih`; `KursiLobi` punya `terputus` dan `diambilAlih`).
  - Pemain tersambung yang diambil alih bot (diam 5 menit) memegang kendali lagi lewat perintah `ambilKendali` (tombol **Ambil kendali**); pemain Terputus cukup tersambung lagi.
  - `StateRuang` kini punya `diambilAlih`, `ambilAlih`, `pindahHostPada`, dan `hapusPada`. Tenggat terdekat dipilih dari keempat sumber (`tenggatBerikutnya`). Aturan host dan tenggat yang bergantung pada siapa yang tersambung dijaga satu fungsi `rapikan` setelah setiap perubahan.
  - Tenggat **hapus ruang** 10 menit sudah dikerjakan di sini karena room tidak lagi `autoDispose` (kalau tidak, pemain yang refresh sendirian kehilangan ruangnya). `Hasil.hapus` membuat adaptor memanggil `disconnect()`. Tiket 05 tinggal menambah Redis, `pulihkan`, dan penanda "bekas".
  - Host hanya dipegang pemain yang duduk; pemain tanpa kursi (dikosongkan host) tidak pernah menjadi host.
  - Klien mematikan sambung ulang bawaan SDK (`room.reconnection.enabled = false`) dan bergabung lagi sendiri dengan token yang sama, dengan jeda 0,5 s berlipat sampai 10 s. Kode tutup `KODE_TUTUP_DIGANTIKAN` (4201) menandai tab yang digantikan.

