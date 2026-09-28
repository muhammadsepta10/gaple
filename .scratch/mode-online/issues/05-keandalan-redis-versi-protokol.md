# 05 — Keandalan: Redis, pulih setelah restart, versi protokol

Status: done
Blocked by: 03

## Parent

`.scratch/mode-online/spec.md`

## What to build

Restart atau deploy server tidak merusak game, dan klien dengan versi lama memperbarui dirinya sendiri.

- **Redis sebagai penyimpanan:** satu key JSON per ruang berisi snapshot state ruang dan waktu simpan, ditulis ulang setiap kali state berubah. TTL panjang (misal 24 jam) hanya sebagai jaring pengaman. Konfigurasi Redis wajib `appendonly yes` + `appendfsync everysec`.
- **Pemulihan eager saat boot:** sebelum menerima koneksi, server membaca semua ruang, memanggil `pulihkan(snapshot, disimpanPada, sekarang)`, lalu membuat ulang room dengan kode yang sama. `pulihkan` menggeser semua tenggat sebesar lama waktu henti dan menandai semua pemain manusia **Terputus**, sehingga waktu server mati tidak ikut dihitung.
- **Hapus ruang:** tenggat 10 menit sejak tidak ada pemain manusia yang tersambung, dan batal jika ada yang tersambung lagi. Setelah dihapus, kode ditandai "bekas" selama 30 hari. Pembuatan kode baru menghindari kode aktif dan kode bekas. Membuka kode bekas menampilkan "ruang sudah dihapus".
- **Versi protokol:** satu konstanta di paket ruang, dikirim klien saat masuk. Jika berbeda, server menolak dengan "perlu pembaruan". Klien lalu memaksa service worker memperbarui diri, memuat ulang halaman, dan kembali ke ruang dengan tokennya.
- **Offline tanpa internet:** masuk ke mode online tanpa koneksi menampilkan pesan butuh internet. Mode offline tetap berjalan dari cache.

## Acceptance criteria

- [x] Server di-restart di tengah ronde. Semua klien menyambung ulang otomatis ke kursi dan kartu yang sama, lalu game berlanjut.
- [x] Waktu henti tidak mengurangi sisa tenggat ambil alih bot 5 menit, pindah host 2 menit, maupun hapus ruang 10 menit.
- [x] Ruang tanpa pemain manusia tersambung dihapus setelah 10 menit. Kodenya tidak pernah dipakai lagi dan ditolak dengan pesan yang jelas.
- [x] Klien dengan versi protokol berbeda memperbarui dirinya lalu kembali ke kursinya tanpa aksi pemain.
- [x] Tes paket ruang: properti bahwa urutan perintah acak dengan snapshot → `pulihkan` di titik acak menghasilkan permainan yang sama dengan tanpa restart (kecuali penanda Terputus dan geseran waktu).
- [x] Tes integrasi server dengan Redis sungguhan di Docker: restart proses di tengah ronde; kode yang sudah dihapus tidak dipakai ulang; versi protokol berbeda ditolak.
- [x] Verifikasi agent-browser: server di-restart saat game berjalan, lalu kedua sesi browser kembali dan game berlanjut.

## Blocked by

- `03-terputus-bot-pengganti-host.md`

## Comments

- (dari tiket 03) Tenggat hapus ruang 10 menit (`hapusPada`, `Hasil.hapus` → `disconnect()`) sudah ada di paket ruang dan adaptor, karena room tidak lagi `autoDispose`. Tiket ini tinggal menambah penanda "bekas" saat ruang dihapus dan menggeser `hapusPada` di `pulihkan`.
- (dari tiket 03) `SambunganRuang.sambungUlang` di `apps/web/src/online/sambungan.ts` berhenti dengan status `hilang` untuk setiap penolakan ruang, termasuk `perlu-pembaruan` dan "not found". Setelah Redis, cabang ini perlu memicu pembaruan service worker untuk `perlu-pembaruan`, dan terus mencoba selama server sedang restart.
- (implementasi) Tanpa `REDIS_URL`, server memakai penyimpanan memori dan mencetak peringatan (untuk pengembangan). Dengan Redis, server menolak boot jika `appendonly`/`appendfsync` terbaca tidak sesuai, dan hanya memperingatkan jika CONFIG tidak bisa dibaca. File Docker Compose dengan AOF menjadi bagian tiket 06.
- (implementasi) Snapshot hanya ditulis saat state berubah, jadi setelah crash waktu simpannya bisa jauh sebelum server mati. Server menulis tanda hidup (`<awalan>detak`) setiap 5 detik, dan `pulihkan` memakai `max(disimpanPada, detak terakhir)` sebagai awal waktu henti.
- (implementasi) Versi protokol 5 (alasan penolakan baru `ruang-dihapus`). Pembaruan paksa dijaga sekali per 60 detik per tab (`sessionStorage`), supaya server yang lebih lama dari klien tidak membuat halaman memuat ulang terus.
- (implementasi) Verifikasi browser di `verifikasi-05-keandalan.md`.
