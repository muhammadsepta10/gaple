# Spec: Gaple tahap 2 — Mode online dengan ruang privat

Status: ready-for-agent

Sumber: `docs/visi-produk.md`, `docs/aturan-permainan.md`, `CONTEXT.md`, `docs/adr/0001-react-pixi-dengan-modul-aturan-bersama.md`, `docs/adr/0002-sinkronisasi-hibrida-dan-tempo-di-server.md`, `docs/adr/0003-redis-snapshot-ruang-dengan-tenggat-digeser.md`, spec tahap 1 di `.scratch/mode-offline/spec.md`, dan sesi grilling arsitektur server (2026-09-28). Istilah mengikuti glosarium di `CONTEXT.md`.

## Problem Statement

Pengguna dan tiga temannya dulu rutin bermain gaple selepas kerja. Sejak WFH, mereka tidak bisa lagi bermain berempat. Tahap 1 menghasilkan **Mode offline** dengan **Aturan kelompok** yang benar, **Bot**, dan meja beranimasi, tetapi pengguna tetap bermain sendirian melawan bot. Kebutuhan utama yang melatarbelakangi proyek ini belum terpenuhi: bermain bersama teman dari jarak jauh.

Mereka butuh cara berkumpul di satu meja tanpa ribet mendaftar akun, dan permainan harus tetap berjalan wajar ketika kenyataan sehari-hari mengganggu. Contohnya: HP seseorang putus koneksi, seseorang pindah ke WhatsApp sebentar, seseorang tertidur di tengah game, atau server di-deploy ulang.

## Solution

Pemain membuat **Ruang privat** cukup dengan **Nama panggilan**, lalu membagikan tautan atau **Kode undangan** 6 karakter lewat WhatsApp atau Discord. Teman yang membuka tautan memilih **Kursi** kosong. **Host** mengatur **Target poin** dan **Balak ganda**, lalu memulai game. Kursi yang masih kosong otomatis diisi **Bot**. Meja, animasi, dan suara sama persis dengan mode offline.

Server Node.js dengan Colyseus menjadi satu-satunya pemegang kebenaran. Server menjalankan mesin aturan yang sama dengan mode offline, menjalankan bot, mengatur tempo permainan, dan hanya mengirim ke setiap orang informasi yang boleh ia lihat. Pemain yang **Terputus** kembali ke kursi dan kartunya cukup dengan membuka ulang tautan dari browser yang sama. Kalau pemain terlalu lama tidak bertindak di gilirannya, bot mengambil alih kursinya sampai ia kembali. Keadaan ruang disimpan di Redis, sehingga restart atau deploy server hanya terasa sebagai jeda "menyambung ulang…" beberapa detik, dan game tetap utuh.

## User Stories

### Membuat dan bergabung ke ruang

1. Sebagai pemain, saya ingin memilih "Main online" dari menu utama, agar saya bisa bermain bersama teman.
2. Sebagai pemain, saya ingin membuat **Ruang privat** hanya dengan mengisi **Nama panggilan**, agar saya tidak perlu mendaftar akun.
3. Sebagai pembuat ruang, saya ingin otomatis menjadi **Host**, agar saya bisa mengatur dan memulai game.
4. Sebagai host, saya ingin melihat **Kode undangan** 6 karakter yang mudah didiktekan, agar saya bisa menyebutkannya lewat panggilan suara.
5. Sebagai host, saya ingin menyalin atau membagikan tautan ruang dengan sekali ketuk, agar teman-teman bisa langsung bergabung dari WhatsApp atau Discord.
6. Sebagai teman, saya ingin membuka tautan ruang dan langsung sampai di ruang tersebut, agar saya tidak perlu mengetik apa pun selain nama.
7. Sebagai teman, saya ingin memasukkan kode undangan secara manual tanpa peduli huruf besar-kecil, agar saya tetap bisa bergabung walaupun hanya mendengar kodenya.
8. Sebagai pemain, saya ingin nama panggilan terakhir saya terisi otomatis saat masuk ruang baru, agar saya tidak mengetik ulang setiap malam.
9. Sebagai pemain, saya ingin diberi tahu jika nama panggilan saya sudah dipakai orang lain di ruang itu, agar tanda seperti "Budi pass" tidak ambigu.
10. Sebagai pemain, saya ingin nama panggilan dibatasi 1–12 karakter (emoji dihitung satu), agar nama muat di pil info kursi di HP.
11. Sebagai pemain, saya ingin mendapat pesan jelas saat kode tidak ditemukan atau ruang sudah dihapus, agar saya tahu harus meminta tautan baru.
12. Sebagai pemain, saya ingin kode ruang lama tidak pernah membawa saya ke ruang orang lain, agar tautan lama di riwayat chat tidak menyesatkan.
13. Sebagai pemain tanpa koneksi internet, saya ingin diberi tahu bahwa mode online butuh internet dan tetap bisa masuk mode offline, agar saya tidak terjebak di layar kosong.

### Lobi dan kursi

14. Sebagai pemain di lobi, saya ingin melihat keempat kursi beserta nama panggilan dan status setiap kursi (kosong, manusia tersambung, **Terputus**), agar saya tahu siapa saja yang sudah datang.
15. Sebagai pemain, saya ingin bebas memilih kursi kosong saat masuk ruang, agar saya bisa duduk di posisi favorit.
16. Sebagai pemain di lobi, saya ingin bisa pindah ke kursi kosong lain sebelum game dimulai, agar saya bisa mengatur posisi duduk bersama teman.
17. Sebagai host, saya ingin memindahkan pemain ke kursi lain sebelum game dimulai, agar urutan giliran sesuai keinginan kelompok.
18. Sebagai host, saya ingin mengosongkan kursi pemain yang **Terputus** sebelum game dimulai, agar game bisa dimulai tanpa menunggu orang yang tidak kembali.
19. Sebagai host, saya ingin mengatur **Target poin** (awal 100) dan **Balak ganda** (bawaan mati) di lobi, agar aturan sesuai kesepakatan malam itu.
20. Sebagai pemain bukan host, saya ingin melihat target poin dan opsi balak ganda yang sedang dipilih host, agar saya tahu aturan sebelum game dimulai.
21. Sebagai host, saya ingin memulai game tanpa menunggu tombol siap dari setiap pemain, agar game cepat dimulai.
22. Sebagai host, saya ingin bisa memulai game walaupun pemain manusia kurang dari empat, dengan kursi kosong otomatis diisi bot, agar kami tetap bisa bermain bertiga atau berdua.
23. Sebagai pemain di lobi, saya ingin kursi saya tetap milik saya ketika koneksi HP putus sebentar, agar saya tidak terlempar jadi penonton hanya karena membalas chat.
24. Sebagai pemain di lobi, saya ingin tombol "Keluar ruang" yang langsung mengosongkan kursi saya, agar teman tahu saya tidak ikut.
25. Sebagai pemain yang **Terputus** di lobi ketika host memulai game, saya ingin tetap ikut sebagai pemain di kursi saya, agar saya bisa langsung bermain begitu kembali.
26. Sebagai pemain di lobi, saya ingin peran host berpindah ke pemain tersambung berikutnya searah jarum jam jika host **Terputus** lebih dari 2 menit, agar ruang tidak macet ketika HP host mati.
27. Sebagai host lama yang kembali setelah perannya berpindah, saya ingin kembali sebagai pemain biasa, agar tidak ada dua host.

### Bermain

28. Sebagai pemain online, saya ingin meja, animasi, suara, dan cara memasang kartu sama persis dengan mode offline, agar tidak perlu belajar ulang.
29. Sebagai pemain, saya ingin hanya melihat kartu di tangan sendiri, sedangkan kartu lawan tampil sebagai punggung kartu sesuai jumlah sisanya, agar permainan adil.
30. Sebagai pemain, saya ingin setiap kursi menampilkan nama panggilan, total poin, sisa kartu, penanda bot, penanda giliran, dan penanda **Terputus**, agar saya tahu keadaan meja.
31. Sebagai pemain, saya ingin melihat langkah pemain lain dan bot dengan urutan dan animasi yang sama seperti kejadiannya (kartu dipasang, pass berantai, balak, gaplek), agar alur permainan terbaca.
32. Sebagai pemain, saya ingin langkah bot dan ronde berikutnya tidak mendahului animasi di layar, agar saya tidak ketinggalan kejadian.
33. Sebagai pemain dengan HP lambat atau tab yang sempat di latar belakang, saya ingin tampilan saya menyusul keadaan terbaru dengan cepat, agar saya tidak tertinggal permainan.
34. Sebagai pemain lain, saya ingin permainan tidak pernah menunggu HP paling lambat selesai beranimasi, agar tempo tetap nyaman.
35. Sebagai pemain, saya ingin kartu yang bisa dipasang ditandai terang hanya pada giliran saya dan setelah animasi sebelumnya selesai, agar saya tidak mengirim langkah terlalu cepat.
36. Sebagai pemain, saya ingin langkah yang tidak sah ditolak server tanpa merusak tampilan, agar klien lama atau klik ganda tidak menimbulkan kekacauan.
37. Sebagai pemain, saya ingin ringkasan ronde tampil beberapa detik lalu ronde berikutnya dimulai otomatis, agar alur sama dengan mode offline.
38. Sebagai pemain, saya ingin hasil akhir game tampil untuk semua orang sekaligus saat game berakhir, agar kami merayakan juara 1 bersama.
39. Sebagai pemain setelah game berakhir, saya ingin tetap di ruang dan kursi yang sama, agar host bisa langsung memulai game baru.
40. Sebagai host setelah game berakhir, saya ingin mengubah target poin dan balak ganda lalu memulai game baru, agar kami bisa lanjut bermain.
41. Sebagai pemain, saya ingin pembagian kartu benar-benar acak dan tidak bisa ditebak, agar tidak ada yang curiga.

### Terputus, kembali, dan bot pengganti

42. Sebagai pemain yang refresh, menutup tab, atau koneksinya putus, saya ingin kembali ke kursi, kartu, dan total poin yang sama hanya dengan membuka ulang tautan dari browser yang sama, tanpa mengisi nama lagi.
43. Sebagai pemain yang koneksinya putus sesaat, saya ingin klien menyambung ulang sendiri dengan indikator "menyambung ulang…", agar saya tidak perlu melakukan apa pun.
44. Sebagai pemain lain, saya ingin permainan menunggu giliran pemain yang **Terputus**, agar dia tidak dirugikan karena gangguan sebentar.
45. Sebagai pemain lain, saya ingin bot mengambil alih kursi pemain yang tidak bertindak selama 5 menit sejak gilirannya dimulai, agar game tidak macet semalaman.
46. Sebagai pemain yang kursinya diambil alih bot, saya ingin langsung memegang kendali lagi begitu membuka tautan ruang, dengan kartu dan total poin saat itu.
47. Sebagai pemain yang kembali tepat saat bot sedang "berpikir" di giliran saya, saya ingin langkah bot dibatalkan dan saya yang memilih, agar kendali benar-benar kembali ke saya.
48. Sebagai pemain, saya ingin hasil permainan bot selama saya pergi tetap dihitung atas nama saya, agar skor tetap utuh.
49. Sebagai pemain lain, saya ingin peran host berpindah ke pemain manusia tersambung berikutnya searah jarum jam saat host diambil alih bot di tengah game, agar selalu ada yang bisa memulai game berikutnya.
50. Sebagai pemain, saya ingin membuka ruang di tab kedua browser yang sama memindahkan saya ke tab baru dan menutup tab lama, agar tidak ada dua layar yang mengendalikan kursi yang sama.
51. Sebagai pemain, saya ingin game tetap berjalan selama masih ada pemain manusia lain di ruang, agar teman yang tersisa bisa menyelesaikan game.
52. Sebagai kelompok yang sudah selesai bermain, saya ingin ruang dihapus otomatis 10 menit setelah semua pemain manusia pergi, agar tidak ada ruang terlantar.

### Penonton

53. Sebagai orang yang membuka tautan saat game berjalan, saya ingin masuk sebagai **Penonton** yang melihat meja, susunan kartu, dan skor, agar saya bisa ikut menonton.
54. Sebagai penonton, saya ingin tidak melihat kartu di tangan pemain mana pun, agar tidak bisa membocorkan kartu lewat panggilan suara.
55. Sebagai penonton, saya ingin bisa menempati kursi kosong atau kursi bot setelah game selesai, agar saya bisa ikut game berikutnya.
56. Sebagai pemain, saya ingin kursi bot yang mengisi kursi kosong sejak awal game tetap dimainkan bot sampai game selesai, dan kursi bot pengganti hanya bisa diambil pemain aslinya, agar game tidak dirusak orang yang baru datang.
57. Sebagai host, saya ingin jumlah penonton dibatasi, agar ruang tidak disalahgunakan.

### Keandalan dan pembaruan

58. Sebagai pemain, saya ingin game tetap utuh ketika server di-restart atau di-deploy, dan saya kembali otomatis ke kursi dan kartu saya, agar malam bermain tidak rusak.
59. Sebagai pemain, saya ingin waktu server mati tidak ikut dihitung dalam batas 5 menit giliran, agar saya tidak diambil alih bot karena kesalahan server.
60. Sebagai pemain dengan versi aplikasi lama di cache, saya ingin aplikasi memperbarui diri lalu memuat ulang sendiri saat server meminta versi baru, lalu kembali ke kursi saya.
61. Sebagai pemain di Indonesia, saya ingin respons langkah terasa cepat, agar giliran tidak terasa tertunda.

### Pengembang dan operator

62. Sebagai pengembang, saya ingin seluruh aturan ruang bisa diuji tanpa jaringan dan tanpa menunggu waktu sungguhan, agar skenario seperti ambil alih bot 5 menit bisa dites dalam milidetik.
63. Sebagai operator, saya ingin server menolak pembuatan ruang, tebakan kode, dan pesan yang berlebihan dari satu sumber, agar VPS kecil tidak kewalahan.
64. Sebagai operator, saya ingin melihat jumlah ruang aktif, agar saya tahu kapan aman melakukan perawatan.
65. Sebagai operator, saya ingin server, Redis, dan aplikasi web berjalan di satu VPS dengan satu perintah, agar perawatan murah dan sederhana.

## Implementation Decisions

### Struktur proyek

- Monorepo pnpm yang ada ditambah dua unit:
  - **Paket ruang**: modul TypeScript murni, tanpa jaringan, timer, Colyseus, Redis, `Math.random`, atau jam sistem. Paket ini bergantung pada paket aturan.
  - **Aplikasi server**: Node.js + Colyseus + klien Redis. Aplikasi ini hanya adaptor tipis di atas paket ruang.
- **Paket aturan** tetap seperti sekarang. Paket ruang memakai operasi publiknya: mulai game, ronde berikutnya, terapkan langkah, langkah legal, pandangan kursi, pandangan publik, dan bot.
- **Tabel durasi presentasi** pindah dari aplikasi web ke paket ruang, supaya server dan klien memakai angka yang sama. Aplikasi web meng-import tabel ini dari paket ruang untuk mode offline dan online.
- **Versi Colyseus**: pakai versi stabil terbaru saat implementasi. `StateView`/`@view` tidak dibutuhkan, karena informasi rahasia tidak pernah lewat Schema.

### Modul 1: Paket ruang (seam utama)

Modul dalam dengan interface kecil. Semua aturan **Ruang privat** tersimpan di sini.

- **State ruang immutable dan bisa diserialisasi.** Isinya data biasa tanpa kelas atau fungsi:
  - kode undangan;
  - fase: lobi, bermain, atau hasil akhir;
  - konfigurasi game;
  - daftar orang di ruang, dikunci token pemain, dengan nama panggilan, kursi atau status penonton, dan tersambung atau **Terputus**;
  - pemilik tiap kursi;
  - kursi yang diisi bot sejak awal game;
  - kursi yang sedang diambil alih bot;
  - host;
  - `GameState` dari paket aturan, atau kosong di luar game;
  - tenggat yang sedang berjalan.
  Snapshot Redis adalah state ini apa adanya.
- **Waktu masuk sebagai argumen, tenggat keluar sebagai data.** Operasi publik (nama final ditentukan saat implementasi):
  - `terapkan(state, perintah, sekarang)` menghasilkan state baru, daftar pesan keluar per penerima, dan tenggat terdekat berikutnya. Perintah yang tidak sah ditolak dengan alasan jelas, dan state tidak berubah.
  - `jalankanTenggat(state, sekarang)` memproses semua tenggat yang sudah lewat dan menghasilkan bentuk hasil yang sama.
  - `pulihkan(snapshot, disimpanPada, sekarang)` menggeser semua tenggat sebesar lama waktu henti dan menandai semua pemain manusia **Terputus**. Inilah yang membuat waktu henti tidak dihitung.
  - Proyeksi state lobi publik untuk Schema, lewat satu fungsi murni.
- **Sumber acak disuntikkan** ke setiap perintah yang memicu pembagian kartu. Paket ruang tidak membuat seed sendiri.
- **Perintah dari orang** (identitas pengirim selalu berupa token yang diberikan adaptor, tidak pernah kursi kiriman klien):
  - masuk (token, nama panggilan, versi protokol);
  - tersambung / terputus (dari adaptor);
  - pilih kursi;
  - pindahkan pemain (host);
  - kosongkan kursi (host);
  - atur konfigurasi (host);
  - mulai game (host);
  - pasang kartu (id kartu, ujung);
  - keluar ruang.
- **Aturan masuk:**
  - Token yang dikenal ruang selalu kembali ke tempatnya (kursi atau penonton), tanpa nama panggilan.
  - Token baru wajib membawa nama panggilan yang valid: dipangkas, 1–12 grafem, unik tanpa membedakan huruf besar-kecil di antara semua orang di ruang, termasuk yang **Terputus**.
  - Token baru saat game berjalan menjadi penonton. Penonton maksimal 8; lebih dari itu ditolak dengan alasan "ruang penuh".
  - Versi protokol berbeda ditolak dengan alasan "perlu pembaruan".
- **Aturan kursi di luar game:**
  - Kursi bot dianggap kosong.
  - Pemain yang **Terputus** tetap memegang kursinya.
  - Keluar ruang mengosongkan kursi dan melepas nama panggilan.
  - Host boleh memindahkan pemain atau mengosongkan kursi mana pun.
- **Mulai game:** kursi kosong diisi bot dan dicatat sebagai "bot sejak awal". Pemain yang **Terputus** tetap ikut di kursinya.
- **Aturan kursi saat game berjalan:**
  - Kursi "bot sejak awal" dimainkan bot sampai game selesai.
  - Kursi yang diambil alih bot hanya bisa kembali ke pemilik token aslinya.
  - Tidak ada yang bisa duduk atau keluar dari kursi. Keluar sama dengan **Terputus**.
- **Tempo (server memegang tempo):**
  - Setiap transisi mesin membuka **jendela presentasi**, dengan panjang = jumlah durasi event yang dihasilkan. Contohnya kartu terbang + balak + pass × n + menang/gaplek + juara, ditambah ringkasan ronde jika ronde berakhir, atau pembagian kartu jika ronde baru dimulai. Semua angka diambil dari tabel durasi.
  - Langkah manusia yang tiba sebelum jendela selesai ditolak dengan alasan "masih presentasi".
  - Langkah bot dijadwalkan pada akhir jendela ditambah jeda berpikir bot.
  - Ronde berikutnya dimulai otomatis pada akhir ringkasan.
  - Tidak ada ack dari klien.
- **Tenggat:**
  - **Ambil alih bot**: 5 menit sejak giliran seorang pemain manusia dimulai, yaitu sejak jendela presentasi sebelumnya selesai. Tenggat ini berlaku baik saat pemain tersambung maupun **Terputus**, dan tidak berlaku lagi setelah pemain bertindak.
  - **Pindah host di lobi**: 2 menit sejak host **Terputus** saat game tidak berjalan.
  - **Akhir jendela presentasi**: menjalankan langkah bot atau ronde berikutnya.
  - **Hapus ruang**: 10 menit sejak tidak ada satu pun pemain manusia yang tersambung. Tenggat ini batal jika ada yang tersambung lagi.
- **Kembali dari ambil alih bot:** pemilik token yang tersambung lagi langsung memegang kursinya, dan langkah bot yang masih terjadwal dibatalkan. Jika saat itu gilirannya, tenggat 5 menit dimulai lagi dari awal. Dikonfirmasi pengguna.
- **Host:**
  - Berpindah ke pemain manusia tersambung berikutnya searah jarum jam jika host diambil alih bot saat game berjalan, atau **Terputus** 2 menit saat game tidak berjalan.
  - Jika saat itu tidak ada pemain manusia yang tersambung, ruang sementara tanpa host. Pemain manusia pertama yang tersambung lagi menjadi host.
  - Host lama yang kembali menjadi pemain biasa.
- **Pesan keluar disensor per penerima:**
  - Setiap `GameEvent` diterjemahkan untuk setiap penerima. Pada event kartu dibagikan, pemain hanya menerima tangannya sendiri ditambah jumlah kartu kursi lain; penonton hanya menerima jumlahnya.
  - Event lain (kartu dipasang, pass, ronde berakhir beserta sisa kartu semua kursi, game berakhir) bersifat publik.
  - Setiap penolakan dikirim hanya ke pengirimnya.
  - Saat masuk atau tersambung lagi, orang itu menerima **snapshot**: pandangan kursi untuk pemain, atau pandangan publik untuk penonton, ditambah sisa jendela presentasi, supaya klien tahu kapan input dibuka.
  - `GameState` utuh tidak pernah keluar dari paket ruang.
- **Versi protokol**: satu konstanta bilangan bulat di paket ruang. Naikkan hanya ketika bentuk perintah, pesan, atau event berubah.

### Modul 2: Aplikasi server (adaptor Colyseus + Redis, seam kedua)

- **Satu tipe room Colyseus** untuk ruang privat. `roomId` = kode undangan, ditetapkan saat room dibuat.
- **Schema hanya berisi proyeksi lobi publik**: fase, empat kursi (nama panggilan, jenis kosong/manusia/bot, tersambung, penanda diambil alih bot), host, konfigurasi, dan daftar penonton. Schema tidak pernah berisi kartu atau `GameState`. Jalannya game dikirim lewat pesan Colyseus.
- **Identitas = token pemain milik aplikasi**, dikirim di opsi join. `sessionId` Colyseus hanya alamat koneksi. `allowReconnection` tidak dipakai. Koneksi baru dengan token yang sedang tersambung memutus koneksi lama.
- **Kode undangan:**
  - 6 karakter dari huruf besar dan angka, tanpa `0 O 1 I L`.
  - Dibuat acak dengan pengecekan bentrok di Redis terhadap ruang aktif dan penanda "bekas".
  - Penanda "bekas" disimpan 30 hari setelah ruang dihapus, supaya kode tidak dipakai ulang.
  - Input kode dinormalisasi ke huruf besar.
- **Redis sebagai penyimpanan:**
  - Satu key JSON per ruang (snapshot state ruang + waktu simpan), ditulis ulang setelah setiap perintah atau tenggat yang mengubah state.
  - Key ruang diberi TTL panjang (misal 24 jam) sebagai jaring pengaman saja. Penghapusan sebenarnya digerakkan tenggat "hapus ruang", karena TTL Redis tetap berjalan saat server mati.
  - Redis wajib `appendonly yes` + `appendfsync everysec`. Risiko yang diterima: kehilangan paling banyak sekitar 1 detik perubahan terakhir.
- **Pemulihan eager saat boot:** sebelum menerima koneksi, server membaca semua key ruang, memanggil `pulihkan`, lalu membuat ulang room Colyseus dengan kode yang sama.
- **Satu timer per room** untuk tenggat terdekat. Saat timer menyala, adaptor memanggil `jalankanTenggat`, menyimpan snapshot, mengirim pesan, lalu menjadwalkan timer untuk tenggat berikutnya.
- **Keacakan**: seed setiap pembagian kartu diambil dari `crypto.getRandomValues`, lalu diteruskan sebagai sumber acak ke paket ruang.
- **Batas penyalahgunaan** (angka awal, bisa diatur lewat konfigurasi):
  - buat ruang maksimal 5 per IP per jam;
  - join ke kode yang tidak dikenal maksimal 20 per IP per menit;
  - maksimal sekitar 10 pesan per detik per koneksi; koneksi yang melanggar diputus;
  - penonton maksimal 8 (ditegakkan paket ruang).
- **Endpoint kesehatan** yang melaporkan jumlah ruang aktif.
- **Aplikasi web statis disajikan dari server yang sama** (satu origin, tanpa CORS). Rute `/r/<kode>` membuka aplikasi.
- **Proses tunggal.** Tidak ada `RedisPresence` atau multi-proses, tetapi jalurnya tetap terbuka karena Redis sudah tersedia.

### Modul 3: Aplikasi web (klien online)

- **Menu utama** punya pilihan "Main online" di samping mode offline. Menu dan lobi bisa dipakai dalam posisi portrait; meja memakai landscape seperti tahap 1.
- **Token pemain** dibuat sekali per browser dan disimpan di `localStorage`. Nama panggilan terakhir juga disimpan untuk diisi otomatis. Semua akses storage dibungkus try/catch; tanpa storage, token hanya hidup selama tab terbuka.
- **Alur masuk:**
  - Tautan `/r/<kode>` atau input kode mencoba masuk dengan token.
  - Jika ruang mengenali token, pemain langsung kembali ke tempatnya.
  - Jika tidak, pemain diminta nama panggilan.
  - Penolakan ditampilkan dengan pesan jelas: nama dipakai, kode tidak ada, ruang penuh, atau batas terlampaui.
- **Layar lobi:**
  - empat kursi dengan status;
  - kode undangan besar + tombol salin/bagikan (Web Share API bila tersedia);
  - kontrol host: target poin, balak ganda, pindahkan/kosongkan kursi, mulai;
  - tombol keluar ruang;
  - untuk non-host, konfigurasi hanya bisa dilihat.
- **Pengendali game online** menggantikan pengendali offline untuk presentasi meja:
  - menerima snapshot dan event tersensor;
  - mengantrekan presentasi dengan durasi dari tabel bersama;
  - membuka input hanya pada gilirannya setelah jendela presentasi selesai;
  - mengirim niat pasang kartu.
  Presentasi meja tidak bergantung pada pengendali mana pun, sesuai keputusan tahap 1.
- **Penyusulan:** jika antrean presentasi klien tertinggal dari server (tab di latar belakang, jaringan lambat, atau snapshot baru masuk), klien mempercepat atau melompati antrean untuk langsung menampilkan keadaan terbaru. Klien tidak pernah memutar ulang riwayat saat tersambung lagi; snapshot langsung ditampilkan.
- **Tampilan penonton**: meja tanpa kipas tangan, dengan label penonton.
- **Penanda Terputus** pada pil info kursi, di samping penanda bot dan penanda giliran.
- **Menyambung ulang otomatis** dengan backoff dan indikator "menyambung ulang…", memakai token yang sama.
- **Penolakan versi protokol:** klien memaksa service worker memperbarui diri, memuat ulang halaman, lalu kembali masuk ke ruang yang sama dengan token.
- **PWA:** mode offline tetap berjalan dari cache dengan versi apa pun. Masuk ke mode online tanpa koneksi menampilkan pesan butuh internet.

### Hosting

- **Satu VPS kecil** (sekitar 1 vCPU / 1 GB) di region Singapura atau Jakarta.
- Docker Compose berisi server Node (yang juga menyajikan aplikasi web) dan Redis dengan volume persisten serta AOF. Caddy menangani TLS dan WebSocket.
- Deploy tidak perlu menunggu ruang kosong, karena ruang pulih dari Redis. Endpoint jumlah ruang aktif tetap tersedia untuk perawatan.

## Testing Decisions

- **Tes yang baik menguji perilaku eksternal lewat seam.** Tes mengirim perintah dan waktu ke paket ruang lalu memeriksa state publik, pesan per penerima, dan tenggat. Tes tidak memeriksa struktur internal atau fungsi pembantu. Waktu dan keacakan selalu disuntikkan, jadi tidak ada `sleep` dan tidak ada tes yang flaky.
- **Seam 1: paket ruang.** vitest + fast-check, menguji hampir semua perilaku:
  - skenario contoh untuk setiap user story lobi, bermain, **Terputus**, bot pengganti, host, penonton, nama panggilan, dan tempo;
  - properti: tidak ada pesan ke pemain mana pun yang pernah memuat kartu tangan kursi lain, dan tidak ada pesan ke penonton yang memuat kartu tangan siapa pun, sebelum ronde berakhir;
  - properti: token yang sama selalu kembali ke kursi, kartu, dan total poin yang sama;
  - properti: selama ada pemain manusia tersambung dan game tidak berjalan, dalam waktu 2 menit selalu ada host yang tersambung;
  - properti: urutan perintah acak dengan snapshot → `pulihkan` di titik acak menghasilkan permainan yang sama dengan tanpa restart (selain penanda **Terputus** dan geseran waktu);
  - properti: tidak ada langkah manusia yang diterima sebelum jendela presentasi selesai, dan tidak ada langkah bot yang dijadwalkan sebelumnya;
  - game berjalan sampai selesai dengan campuran pemain manusia acak dan bot, tanpa macet.
- **Seam 2: aplikasi server.** Tes integrasi dengan klien Colyseus sungguhan (paket testing Colyseus) dan Redis sungguhan di Docker. Hanya menguji hal yang tidak bisa diuji di seam 1:
  - buat ruang lalu 4 klien join lewat kode;
  - restart proses server di tengah ronde, lalu semua klien kembali ke kursi dan game berlanjut;
  - token yang sama di koneksi kedua memutus koneksi pertama;
  - versi protokol berbeda ditolak;
  - batas buat ruang, tebakan kode, dan pesan;
  - kode yang sudah dihapus tidak dipakai ulang dan ditolak;
  - Schema tidak pernah berisi kartu.
- **Tidak ada seam baru di aplikasi web.** Pengendali online dan penyusulan presentasi diverifikasi lewat skenario **agent-browser** (bukan Playwright). Skenario ditulis sebagai dokumen verifikasi di folder fitur ini dan dijalankan agen saat menutup issue online:
  - dua sesi browser (host + teman) + dua bot bermain satu ronde sampai ringkasan;
  - refresh tab lalu kembali ke kursi dan kartu yang sama;
  - penonton masuk saat game berjalan dan tidak melihat tangan;
  - server di-restart saat game berjalan.
  Tes Playwright mode offline yang sudah ada tetap dipertahankan.
- **Prior art:**
  - tes paket aturan: skenario contoh aturan kelompok, akhir game, ronde;
  - properti bot dengan fast-check;
  - tes pandangan yang memastikan tangan lawan tidak bocor, sebagai pola untuk properti sensor pesan.

## Out of Scope

- Akun, login, atau identitas lintas browser/perangkat. Membuka ruang dari browser lain berarti orang baru.
- Komunikasi di dalam game (chat, suara). Pemain memakai WhatsApp atau Discord.
- Riwayat game, statistik, papan peringkat, dan penyimpanan hasil setelah ruang dihapus. Postgres baru dipertimbangkan jika fitur ini diinginkan.
- Ruang publik atau matchmaking dengan orang asing.
- Server multi-proses atau multi-region.
- Tingkat kesulitan bot.
- Batas waktu giliran selain ambil alih bot 5 menit.
- Penonton melihat kartu tangan.
- Menyimpan game offline.
- Aplikasi native.

## Further Notes

- **ADR terkait:** `docs/adr/0002-sinkronisasi-hibrida-dan-tempo-di-server.md` dan `docs/adr/0003-redis-snapshot-ruang-dengan-tenggat-digeser.md`.
- `docs/visi-produk.md` dan glosarium `CONTEXT.md` sudah memuat aturan baru yang terlihat pemain (kursi pemain **Terputus** di lobi, nama panggilan unik, format **Kode undangan**, host pindah setelah 2 menit **Terputus** di lobi, penyimpanan Redis).
- Angka batas penyalahgunaan, TTL jaring pengaman, dan masa penanda kode "bekas" adalah angka awal yang boleh diubah tanpa mengubah desain.
