# 02 — Main bersama teman: gabung, kursi, host

Status: ready-for-agent
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

- [ ] Dua sampai empat pemain dari browser berbeda bisa bergabung lewat tautan dan lewat kode manual, memilih kursi, lalu bermain satu game bersama. Kursi sisa diisi bot.
- [ ] Nama yang bentrok (termasuk beda huruf besar-kecil) atau di luar 1–12 grafem ditolak dengan pesan yang jelas.
- [ ] Hanya host yang bisa mengubah konfigurasi, memindahkan atau mengosongkan kursi, dan memulai game. Perintah host dari non-host ditolak.
- [ ] Setelah game selesai, host bisa mengubah target dan memulai game baru dengan kursi yang sama.
- [ ] Tes paket ruang untuk aturan kursi, nama panggilan, kontrol host, dan game baru.
- [ ] Verifikasi agent-browser: dua sesi browser (host + teman) + dua bot bermain satu ronde sampai ringkasan.

## Blocked by

- `01-tracer-game-online-lawan-bot.md`
