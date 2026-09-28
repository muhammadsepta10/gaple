# 05 — Keandalan: Redis, pulih setelah restart, versi protokol

Status: ready-for-agent
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

- [ ] Server di-restart di tengah ronde. Semua klien menyambung ulang otomatis ke kursi dan kartu yang sama, lalu game berlanjut.
- [ ] Waktu henti tidak mengurangi sisa tenggat ambil alih bot 5 menit, pindah host 2 menit, maupun hapus ruang 10 menit.
- [ ] Ruang tanpa pemain manusia tersambung dihapus setelah 10 menit. Kodenya tidak pernah dipakai lagi dan ditolak dengan pesan yang jelas.
- [ ] Klien dengan versi protokol berbeda memperbarui dirinya lalu kembali ke kursinya tanpa aksi pemain.
- [ ] Tes paket ruang: properti bahwa urutan perintah acak dengan snapshot → `pulihkan` di titik acak menghasilkan permainan yang sama dengan tanpa restart (kecuali penanda Terputus dan geseran waktu).
- [ ] Tes integrasi server dengan Redis sungguhan di Docker: restart proses di tengah ronde; kode yang sudah dihapus tidak dipakai ulang; versi protokol berbeda ditolak.
- [ ] Verifikasi agent-browser: server di-restart saat game berjalan, lalu kedua sesi browser kembali dan game berlanjut.

## Blocked by

- `03-terputus-bot-pengganti-host.md`
