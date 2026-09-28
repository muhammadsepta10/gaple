# Redis untuk snapshot ruang, dengan tenggat digeser saat pulih

Ruang privat harus selamat dari restart dan deploy server. Setiap ruang disimpan sebagai satu key JSON di Redis berisi snapshot state ruang (termasuk `GameState`) dan waktu simpan, ditulis ulang setiap kali state berubah. Redis wajib berjalan dengan AOF (`appendfsync everysec`). Saat boot, server memulihkan semua ruang secara eager. Semua tenggat (ambil alih bot 5 menit, pindah host 2 menit, hapus ruang 10 menit, jendela presentasi) digeser sebesar lama waktu henti, supaya kesalahan server tidak membuat pemain diambil alih bot.

Redis dipilih karena datanya sementara dan berbentuk satu dokumen per ruang, tanpa query, relasi, atau riwayat. Redis juga menjadi jalur ke `RedisPresence`/`RedisDriver` Colyseus jika suatu hari butuh multi-proses.

## Considered Options

- **Semua ruang di memori saja**: paling sederhana, tetapi restart atau deploy menghapus semua game yang sedang berjalan.
- **PostgreSQL**: kekuatannya (relasi, query, riwayat) tidak terpakai, dan ruang kedaluwarsa butuh job pembersih. Baru layak jika nanti ada akun atau riwayat game.
- **MongoDB**: tidak menawarkan apa pun yang tidak dimiliki Redis untuk kebutuhan ini.

## Consequences

- TTL Redis tetap berjalan saat server mati, jadi TTL tidak bisa menjadi penghapus utama ruang. Penghapusan digerakkan tenggat ruang, dan TTL panjang (sekitar 24 jam) hanya jaring pengaman.
- Tenggat harus disimpan di state ruang dan waktu harus menjadi input, bukan dibaca dari jam sistem di dalam logika ruang. Inilah alasan logika ruang dibuat sebagai modul murni.
- Kehilangan paling banyak sekitar 1 detik perubahan terakhir saat crash dianggap dapat diterima.
