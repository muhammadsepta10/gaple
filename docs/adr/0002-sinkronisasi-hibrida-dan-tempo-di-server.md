# Sinkronisasi hibrida dan tempo dipegang server

Di mode online, Schema Colyseus hanya dipakai untuk data lobi yang tidak rahasia: fase, kursi, host, konfigurasi, dan penonton. Jalannya game dikirim sebagai pesan berisi `GameEvent` yang disensor per penerima, ditambah snapshot pandangan kursi atau pandangan publik saat pemain bergabung atau tersambung lagi. `GameState` utuh tidak pernah meninggalkan server. Alasannya, presentasi meja bergantung pada *urutan* kejadian (kartu dipasang → pass → pass → gaplek), sedangkan patch Schema hanya membawa hasil akhir. Selain itu, menyaring kartu tangan lewat `StateView` berarti menduplikasi `GameState` menjadi kelas Schema.

Server juga memegang tempo. Setiap transisi membuka jendela presentasi yang panjangnya dihitung dari tabel durasi bersama. Langkah bot dan ronde berikutnya baru dijadwalkan setelah jendela selesai, dan langkah manusia sebelum itu ditolak. Klien tidak mengirim ack "animasi selesai". Klien yang tertinggal mempercepat atau melompati antreannya sendiri untuk menyusul.

## Considered Options

- **Full Schema dengan `StateView`**: sinkronisasi otomatis, tetapi urutan event hilang, pass berantai tergabung dalam satu patch, dan aturan harus ditulis ulang sebagai kelas Schema.
- **Full pesan tanpa Schema**: lobi harus disinkronkan manual, padahal Schema cocok untuk data lobi yang kecil dan publik.
- **Ack dari klien sebelum langkah berikutnya**: animasi dijamin selesai di semua layar, tetapi satu HP lambat atau tab di latar belakang menahan seluruh meja.

## Consequences

- Tabel durasi presentasi tinggal di modul bersama (paket ruang). Mengubah durasi animasi berarti mengubah tempo server juga.
- Klien boleh menampilkan animasi lebih cepat atau melewatinya, tetapi tidak boleh mengandalkan server menunggu animasinya.
