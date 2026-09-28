# 02 — Main bersama teman: gabung, kursi, host

Status: done
Blocked by: 01

## Parent

`.scratch/mode-online/spec.md`

## What to build

Teman bisa bergabung ke **Ruang privat** lewat tautan atau **Kode undangan**, memilih **Kursi**, lalu bermain bersama. **Host** mengatur game dari lobi, dan setelah game selesai bisa memulai game baru.

- **Kode undangan** berupa 6 karakter huruf besar dan angka, tanpa `0 O 1 I L`, dan dipakai sebagai `roomId`. Input manual tidak peka huruf besar-kecil. Tautan `/r/<kode>` membuka aplikasi langsung ke ruang itu. Pada tiket ini pengecekan bentrok cukup terhadap ruang aktif di memori.
- **Layar lobi** menampilkan empat kursi dengan nama dan status (kosong, manusia, bot), kode undangan yang besar, tombol salin/bagikan (Web Share API bila tersedia), serta konfigurasi yang terlihat oleh semua orang.
- **Nama panggilan** dipangkas, 1–12 grafem, dan unik tanpa membedakan huruf besar-kecil di dalam ruang. Kalau bentrok, pemain diminta nama lain. Nama terakhir disimpan di browser dan diisi otomatis (akses storage dibungkus try/catch).
- Pemain bebas memilih atau pindah ke kursi kosong sebelum game dimulai. Kursi bot di luar game dianggap kosong.
- **Kontrol host:** mengatur **Target poin** dan **Balak ganda**, memindahkan pemain ke kursi lain, mengosongkan kursi, dan memulai game tanpa tombol siap. Kursi kosong diisi bot dan dicatat sebagai "bot sejak awal". Konfigurasi terkunci selama game berjalan.
- Pesan kode tidak ditemukan tampil dengan jelas.
- Setelah hasil akhir, semua pemain tetap di ruang dan kursi yang sama. Host bisa mengubah konfigurasi lalu memulai game baru.
- Selama game berjalan, token baru ditolak dulu dengan pesan "game sedang berjalan". Perilaku penonton dikerjakan di tiket 04.

## Acceptance criteria

- [x] Dua sampai empat pemain dari browser berbeda bisa bergabung lewat tautan dan lewat kode manual, memilih kursi, lalu bermain satu game bersama. Kursi sisa diisi bot.
- [x] Nama yang bentrok (termasuk beda huruf besar-kecil) atau di luar 1–12 grafem ditolak dengan pesan yang jelas.
- [x] Hanya host yang bisa mengubah konfigurasi, memindahkan atau mengosongkan kursi, dan memulai game. Perintah host dari non-host ditolak.
- [x] Setelah game selesai, host bisa mengubah target dan memulai game baru dengan kursi yang sama.
- [x] Tes paket ruang untuk aturan kursi, nama panggilan, kontrol host, dan game baru.
- [x] Verifikasi agent-browser: dua sesi browser (host + teman) + dua bot bermain satu ronde sampai ringkasan.

## Blocked by

- `01-tracer-game-online-lawan-bot.md`

## Comments

- (dari tiket 01) Tata letak `Meja` masih mengandaikan kursi sendiri = 0 di bawah. Di tiket 01 pembuat ruang selalu kursi 0, jadi aman. Begitu teman bisa duduk di kursi 1–3, pengendali online perlu memutar kursi (kursi relatif = (kursi − kursiSaya + 4) mod 4) untuk tangan, susunan, giliran, skor, event, dan info kursi sebelum diteruskan ke `Meja`.
- (tiket 02 selesai) Verifikasi: `.scratch/mode-online/verifikasi-02-main-bersama-teman.md`. Keputusan yang perlu diketahui tiket berikutnya:
  - `VERSI_PROTOKOL` naik ke 2 (perintah baru `pilihKursi`, `pindahkan`, `kosongkan`, `aturKonfigurasi`). Kode undangan kini disimpan di `StateRuang.kode`.
  - Host yang memindahkan pemain ke kursi berisi manusia menukar keduanya. Host tidak bisa mengosongkan kursinya sendiri (`kursi-host`), supaya host selalu duduk.
  - Pemain yang kursinya dikosongkan host tetap di ruang tanpa kursi dan tetap memegang nama panggilan; ia bisa duduk lagi. Jika game dimulai saat itu, ia belum menerima apa pun. Tiket 04 perlu menjadikannya penonton (termasuk batas 8).
  - Keluar ruang masih hanya memutus koneksi (kursi tetap). Perintah "keluar ruang" yang melepas kursi dan nama dikerjakan di tiket 03.
  - Pengecekan bentrok kode hanya terhadap ruang aktif di memori proses (`kodeAktif` di `apps/server/src/server.ts`). Tiket 05 memindahkannya ke Redis + penanda "bekas".
  - Rotasi kursi dikerjakan di `Meja` lewat `posisiKursi` (bukan di pengendali online), jadi state dan event tetap memakai nomor kursi asli.
  - Snapshot di luar fase `bermain` tidak membawa pandangan; perubahan kursi setelah hasil akhir memindahkan pemain yang terdampak dari layar skor akhir ke lobi.
