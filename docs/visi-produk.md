# Visi produk Gaple

## Latar belakang

Pengguna dahulu bekerja di kantor dan rutin bermain gaple selepas bekerja bersama tiga teman. Setelah beralih ke WFH, mereka merindukan momen bermain berempat tersebut. Pengguna belum menemukan game gaple di internet yang sesuai dengan keinginannya, termasuk aturan permainan kelompoknya.

## Tujuan

Memungkinkan pengguna dan teman-temannya kembali bermain gaple bersama dari jarak jauh, dengan aturan yang sesuai kebiasaan kelompok mereka.

## Hal yang sudah disampaikan

- Setiap permainan harus memiliki tepat empat pemain.
- Setiap pemain bermain untuk dirinya sendiri, tanpa pasangan atau tim.
- Satu game terdiri dari beberapa ronde dengan poin sisa kartu yang terakumulasi. Game berakhir ketika ada pemain yang mencapai atau melewati target poin setelah perhitungan poin seluruh pemain pada akhir ronde; pemain dengan total poin terendah yang masih di bawah target menang.
- Target poin memiliki nilai awal 100 dan dapat diatur sebelum game dimulai.
- Beberapa pemain dapat kalah bersama jika mencapai atau melewati target pada ronde yang sama. Beberapa pemain dengan total poin terendah yang sama mendapat juara 1 bersama.
- Jika seluruh pemain mencapai atau melewati target, semuanya kalah dan tidak ada juara 1.
- Game diinginkan memiliki mode online dan offline.
- Mode offline dimainkan oleh satu pemain manusia melawan tiga bot, untuk latihan atau bermain ketika teman-teman tidak tersedia. Jumlah pemain tetap empat.
- Mode offline dapat dimainkan tanpa koneksi internet setelah situs pernah dibuka sekali. Seluruh permainan dan bot berjalan di browser tanpa server.
- Game offline tidak disimpan. Menutup tab atau browser menghapus game tersebut.
- Bermain online bersama teman dari jarak jauh merupakan kebutuhan utama yang melatarbelakangi proyek.
- Aturan kelompok berbeda dari aturan pada game gaple yang ditemukan pengguna di internet. Aturan yang sudah dikonfirmasi dicatat di [aturan permainan](aturan-permainan.md).
- Komunikasi di dalam game merupakan fitur masa depan. Untuk kebutuhan awal, pemain dapat menggunakan panggilan WhatsApp atau Discord.
- Game menggunakan tampilan 2D dengan gambar tajam/HD dan tampilan yang tidak terlalu kompleks.
- Gaya gambar flat, tetapi dengan animasi yang hidup seperti game kartu Yu-Gi-Oh (kartu bergerak, kilau, dan efek dramatis pada momen penting).
- Animasi dibagi dua tingkat. Animasi cepat untuk kejadian yang sering: pembagian kartu ke tiap kursi, kartu berpindah dari tangan ke ujung susunan, dan tanda pass. Efek besar (seperti kilau, getar layar, atau teks besar) hanya untuk balak dipasang, kartu terakhir yang memenangkan ronde, gaplek, dan pengumuman juara 1. Durasinya mengikuti hasil prototype di bawah.
- Meskipun beranimasi, game harus terasa cepat dan responsif dengan loading seminimal mungkin.
- Tata letak meja (hasil prototype): ketiga lawan duduk di sisi meja masing-masing (kiri, atas, kanan) sesuai urutan giliran searah jarum jam. Setiap kursi lawan menampilkan pil info (nama panggilan, total poin, sisa kartu, penanda bot, penanda giliran berdenyut) dan deret punggung kartu. Tangan pemain di bawah berbentuk kipas melengkung dengan kartu besar yang sebagian terpotong tepi layar. Rantai kartu mengisi tengah meja.
- Rantai kartu melipat seperti ular: tumbuh ke kiri dan kanan dari kartu pertama, berbelok lewat satu kartu penghubung tegak saat mendekati tepi area, lalu berbalik arah di baris berikutnya (ujung kanan melipat ke bawah, ujung kiri ke atas). Balak dipasang melintang. Ukuran kartu di rantai mengecil otomatis agar seluruh rantai (sampai 28 kartu) selalu muat tanpa digeser.
- Kecepatan animasi mengikuti preset "dramatis" di prototype: kartu pindah ke ujung susunan sekitar 0,5 detik, pembagian kartu sekitar 1,3 detik untuk 28 kartu, tanda pass sekitar 1,3 detik, balak sekitar 1,8 detik, kartu terakhir menang sekitar 2,5 detik, dan gaplek sekitar 2,4 detik. Preset ini dipilih walaupun pembagian kartu dan tanda pass melewati 1 detik, serta menang dan gaplek sedikit melewati 2 detik; durasi di sini menggantikan batas pada pembagian dua tingkat animasi.
- Suara efek (hasil prototype): pembagian kartu berupa klik pendek sintetis per kartu; kartu dipasang berupa bunyi kartu diletakkan (Kenney "card-place", nada sedikit divariasikan tiap kali); pass berupa nada tanya (Kenney "question_001"); balak berupa hantaman disusul kilau kaca (Kenney "impactPunch_heavy_001" + "glass_002"); menang ronde berupa fanfare sintetis C–E–G–C; gaplek berupa tiga nada rendah (Kenney "lowThreeTone"); juara 1 berupa dua power-up disusul bunyi chip bertumpuk (Kenney "powerUp9" + "powerUp12" + "chips-stack-1"). Suara diputar tepat saat kartu mendarat atau efek dimulai.
- Setiap momen beranimasi disertai efek suara pendek, termasuk momen efek besar seperti gaplek dan kemenangan. Tidak ada musik latar. Tersedia tombol mute yang diingat browser.
- Pemain memasang kartu dengan mengetuk/klik kartu di tangan; kartu yang dapat dipasang ditandai terang dan sisanya diredupkan. Kartu yang cocok di satu ujung langsung terpasang; jika cocok di kedua ujung, kedua ujung menyala dan pemain mengetuk ujung pilihannya. Seret (drag) tidak dipakai.
- Pass terjadi otomatis ketika pemain tidak memiliki kartu yang cocok, disertai tanda singkat (misal "Budi pass") di dekat kursinya.
- Selama ronde, setiap kursi menampilkan nama panggilan, total poin, penanda bot bila dipegang bot, dan penanda giliran. Kartu lawan hanya tampil sebagai punggung kartu dengan jumlah sesuai sisa kartu yang dipegang; nilainya tidak terlihat.
- Gambar meja dapat diganti dari koleksi yang disediakan game. Pengembang menyiapkan file gambar di folder aset, lalu pemain memilih tampilan meja dari koleksi tersebut. Pilihan gambar meja bersifat pribadi, hanya berlaku di layar pemain itu, diingat browser untuk kunjungan berikutnya, dan berlaku juga di mode offline.
- Game berbasis web dan diakses melalui browser, dengan tampilan responsif dari ukuran laptop sampai HP.
- Untuk versi awal di HP, menu dapat digunakan dalam posisi portrait, sedangkan meja permainan menggunakan landscape. Saat akan bermain dalam posisi portrait, pemain diberi petunjuk untuk memutar HP.
- Permainan online menggunakan ruang privat. Satu pemain membuat ruang dan membagikan tautan atau kode undangan kepada ketiga temannya agar mereka bergabung ke ruang yang sama.
- Untuk versi awal, pemain cukup memasukkan nama panggilan saat masuk ke ruang privat, tanpa perlu mendaftar akun.
- Kode undangan terdiri dari 6 karakter huruf besar dan angka tanpa karakter yang mirip (0, O, 1, I, L), agar mudah didiktekan lewat panggilan suara. Kode tidak peka huruf besar-kecil saat diketik, tidak berlaku lagi setelah ruang dihapus, dan tidak pernah dipakai untuk ruang lain.
- Nama panggilan harus unik dalam satu ruang tanpa membedakan huruf besar-kecil, panjangnya 1–12 karakter (emoji dihitung satu), dan tetap dipegang pemain yang terputus sampai dia keluar ruang. Nama terakhir diingat browser dan diisi otomatis untuk ruang berikutnya.
- Pembuat ruang privat menjadi host: berwenang mengatur target poin dan memulai game. Untuk hal lain, setara dengan pemain lain.
- Saat masuk ruang, pemain bebas memilih kursi kosong. Host dapat memindahkan pemain ke kursi lain atau mengosongkan kursi pemain lain sebelum game dimulai.
- Selama game tidak berjalan, pemain yang terputus (koneksi putus, menutup tab, atau pindah aplikasi) tetap memegang kursinya dan tampil sebagai terputus. Jika host memulai game tanpa mengosongkan kursinya, dia tetap ikut sebagai pemain dan gilirannya ditunggu seperti biasa. Tombol keluar ruang langsung mengosongkan kursi. Saat game berjalan, keluar sama dengan terputus.
- Host dapat memulai game tanpa tombol siap dari tiap pemain, meskipun kursi yang terisi pemain manusia kurang dari empat. Kursi kosong otomatis diisi bot sehingga tetap ada empat pemain.
- Setelah ronde selesai, ringkasan ronde (sisa kartu tiap pemain, poin ronde, dan total poin) ditampilkan beberapa detik, lalu ronde berikutnya dimulai otomatis tanpa aksi pemain. Jika ronde itu mengakhiri game, tampilan langsung beralih ke hasil akhir game.
- Game online tetap berjalan selama masih ada pemain manusia lain di ruang. Jika seluruh pemain manusia meninggalkan ruang dan tidak ada yang kembali dalam 10 menit, ruang dihapus dan tautannya tidak berlaku lagi. Jika pemain refresh, menutup tab/browser, atau koneksinya putus, membuka kembali tautan ruang dari browser yang sama mengembalikannya ke kursi dan kartu yang sama tanpa mengisi ulang nama panggilan. Selama terputus, permainan menunggu gilirannya.
- Jika pemain tidak bertindak selama 5 menit sejak gilirannya dimulai, kursinya otomatis diambil alih bot. Di luar itu tidak ada batas waktu giliran.
- Saat pemain tersebut kembali membuka tautan ruang, dia langsung mengambil alih kursinya lagi dengan kartu dan total poin saat itu. Hasil permainan bot selama dia pergi tetap dihitung atas nama pemain tersebut. Jika dia kembali saat bot sedang menimbang langkah di gilirannya, langkah bot dibatalkan dan dia sendiri yang memilih kartu, dengan batas 5 menit dihitung ulang dari awal.
- Jika host diambil alih bot, peran host berpindah ke pemain manusia berikutnya searah jarum jam yang masih terhubung. Hal yang sama terjadi jika host terputus selama 2 menit saat game tidak berjalan, agar ruang tidak macet ketika HP host mati. Host lama yang kembali menjadi pemain biasa.
- Selama game tidak berjalan, kursi yang dipegang bot dianggap kosong dan dapat ditempati pemain yang masuk lewat tautan. Di tengah game, pemain baru tidak dapat masuk: kursi yang diisi bot sejak awal game tetap dimainkan bot sampai game selesai, dan kursi bot yang menggantikan pemain hanya dapat diambil kembali oleh pemain aslinya.
- Orang yang membuka tautan saat game berjalan masuk sebagai penonton: dapat melihat meja, susunan kartu, dan skor, tetapi tidak melihat kartu di tangan pemain. Setelah game selesai, dia dapat menempati kursi kosong atau kursi bot untuk game berikutnya.
- Setelah game berakhir, hasil akhir ditampilkan. Pemain tetap di ruang dan kursi yang sama; host dapat mengubah target poin lalu memulai game baru.
- Versi awal memiliki satu tingkat bot dengan strategi sederhana: mengutamakan membuang kartu bernilai besar dan mempertahankan angka yang masih banyak dipegang agar tidak mudah pass. Pilihan tingkat kesulitan belum disediakan.
- Mode offline dibuat dan dirilis lebih dulu karena mencakup aturan permainan, bot, dan tampilan meja yang juga dibutuhkan mode online. Mode online dengan ruang privat menyusul di tahap kedua.

## Teknologi dan aset

- TypeScript di seluruh bagian.
- Aturan permainan dan bot berupa modul TypeScript murni tanpa UI, dipakai bersama oleh browser (offline) dan server (online).
- UI dengan React; meja dan animasi dengan PixiJS melalui @pixi/react.
- Mode offline sebagai PWA agar dapat berjalan tanpa internet dan dibuka cepat setelah kunjungan pertama.
- Mode online (tahap 2) memakai server Node.js dengan Colyseus. Server memegang seluruh jalannya game dan hanya mengirim kepada setiap orang informasi yang boleh dilihatnya.
- Keadaan ruang disimpan di Redis, sehingga restart atau pembaruan server hanya terasa sebagai jeda "menyambung ulang…" dan game tetap utuh. Waktu server mati tidak dihitung dalam batas 5 menit giliran.
- Server, Redis, dan situs web berjalan di satu VPS kecil di region Singapura atau Jakarta agar respons terasa cepat dari Indonesia.
- Suara efek memakai aset Kenney berlisensi CC0 (dikonversi ke .m4a agar dapat diputar di Safari, total di bawah 250 KB) dan suara sintetis yang dibuat dengan Web Audio tanpa file. Audio baru aktif setelah interaksi pertama pemain sesuai aturan browser.
- Kartu digambar sebagai vektor (formatnya tidak dikunci; prototype memakai Pixi Graphics yang diskalakan). Gambar meja berupa ilustrasi/foto resolusi tinggi; hanya gambar meja yang dipilih yang dimuat.
