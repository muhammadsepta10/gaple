# Spec: Gaple tahap 1 — Mode offline

Status: ready-for-agent

Sumber: `docs/visi-produk.md`, `docs/aturan-permainan.md`, `CONTEXT.md`, `docs/adr/0001-react-pixi-dengan-modul-aturan-bersama.md`, `.scratch/prototype-meja/HASIL.md`. Istilah mengikuti glosarium di `CONTEXT.md`.

## Problem Statement

Pengguna dan tiga temannya dulu rutin bermain gaple selepas kerja. Sejak WFH, momen itu hilang. Game gaple yang ada di internet memakai aturan yang berbeda dari **Aturan kelompok** mereka (pembagian ulang jika dapat 5 balak, pembuka sesi berdasarkan pemenang sesi atau angka gaplek, **Balak 0 mati** bernilai 25, opsi **Balak ganda**, **Target poin** dengan kemungkinan juara 1 bersama atau semua kalah).

Kebutuhan utamanya adalah bermain online bersama. Namun sebelum itu, pengguna butuh game yang aturannya benar, bot yang layak dilawan, dan meja yang terasa hidup, sehingga ia bisa berlatih atau bermain ketika teman tidak tersedia, termasuk tanpa internet. Semua bagian ini juga menjadi fondasi mode online.

## Solution

Sebuah PWA berbasis web yang bisa dimainkan di laptop maupun HP. Satu pemain manusia melawan tiga **Bot** dalam **Mode offline**, dengan **Aturan kelompok** yang lengkap. Pemain mengatur **Target poin** (awal 100) dan opsi **Balak ganda** (bawaan mati), lalu bermain sesi demi sesi sampai **Game** berakhir. Meja 2D bergaya flat dengan animasi dramatis dan efek suara, sesuai hasil prototype. Setelah situs pernah dibuka sekali, game dapat dimainkan tanpa koneksi internet. Aturan dan bot dibuat sebagai modul TypeScript murni, sehingga server tahap 2 bisa memakai modul yang sama tanpa perubahan.

## User Stories

### Memulai game

1. Sebagai pemain, saya ingin membuka situs dan langsung melihat menu yang bisa dipakai dalam posisi portrait, agar saya bisa memulai tanpa memutar HP.
2. Sebagai pemain, saya ingin memulai game offline melawan tiga bot, agar saya bisa bermain walaupun teman tidak ada.
3. Sebagai pemain, saya ingin mengatur **Target poin** sebelum game dimulai dengan nilai awal 100, agar panjang game sesuai waktu yang saya punya.
4. Sebagai pemain, saya ingin mengaktifkan atau mematikan opsi **Balak ganda** sebelum game dimulai, dengan bawaan mati, agar aturan sama dengan yang dipakai kelompok saat itu.
5. Sebagai pemain, saya ingin target poin dan opsi balak ganda terkunci selama game berjalan, agar aturan tidak berubah di tengah permainan.
6. Sebagai pemain HP, saya ingin diberi petunjuk memutar HP ke landscape saat masuk ke meja dalam posisi portrait, agar meja tampil sebagaimana mestinya.
7. Sebagai pemain, saya ingin game tetap berisi tepat empat **Pemain** (saya + tiga bot), agar sesuai aturan gaple.

### Pembagian kartu

8. Sebagai pemain, saya ingin 28 kartu diacak dan dibagikan habis, tujuh kartu per pemain, di awal setiap **Sesi**, agar setiap sesi dimulai dengan adil.
9. Sebagai pemain, saya ingin melihat animasi kartu dibagikan dari tengah meja ke setiap kursi secara bergiliran beserta klik pendek per kartu, agar pembagian terasa nyata.
10. Sebagai pemain, saya ingin kartu dibagikan ulang secara otomatis jika ada pemain yang mendapat 5 balak atau lebih, agar aturan kelompok ditegakkan.
11. Sebagai pemain, saya ingin tahu ketika terjadi pembagian ulang, agar saya tidak bingung kartu saya berubah.

### Pembuka sesi

12. Sebagai pemain, saya ingin sesi pertama setiap game dibuka oleh pemegang balak 0 dengan kartu 0–0, agar sesuai aturan kelompok.
13. Sebagai pemegang balak 0 di sesi pertama, saya ingin hanya kartu 0–0 yang bisa saya pasang, agar saya tidak salah membuka.
14. Sebagai **Pemenang sesi**, saya ingin membuka sesi berikutnya dengan kartu apa pun pilihan saya, agar kemenangan saya memberi keuntungan.
15. Sebagai pemain, saya ingin sesi setelah **Gaplek** angka n dibuka oleh pemegang balak n pada pembagian baru, dengan kartu balak n, agar sesuai aturan kelompok.
16. Sebagai pemain, saya ingin aturan pembuka kembali ke balak 0 setiap kali game baru dimulai, apa pun hasil game sebelumnya.

### Giliran dan pemasangan kartu

17. Sebagai pemain, saya ingin **Giliran** berjalan searah jarum jam (saya di bawah, lalu kiri, atas, kanan), agar urutannya sama seperti di meja sungguhan.
18. Sebagai pemain, saya ingin kartu yang bisa dipasang tampil terang dan sedikit terangkat, sementara kartu lainnya diredupkan, agar saya cepat tahu pilihan saya.
19. Sebagai pemain, saya ingin memasang kartu cukup dengan mengetuk atau mengklik kartu itu, agar bermain terasa cepat di HP maupun laptop.
20. Sebagai pemain, saya ingin kartu yang hanya cocok di satu **Ujung susunan** langsung terpasang begitu saya ketuk.
21. Sebagai pemain, saya ingin kartu yang cocok di kedua ujung diberi garis emas, lalu kedua ujung rantai menyala sehingga saya bisa mengetuk ujung pilihan saya.
22. Sebagai pemain, saya ingin bisa membatalkan pilihan ujung dengan mengetuk kartu lain atau kartu yang sama, agar salah ketuk tidak memaksa saya memasang.
23. Sebagai pemain, saya ingin kartu yang tidak cocok tidak bisa dipasang, agar saya tidak melanggar aturan.
24. Sebagai pemain, saya ingin kartu saya terbang ke ujung rantai dalam sekitar 0,5 detik dengan bunyi kartu diletakkan saat mendarat, agar setiap langkah terasa hidup.
25. Sebagai pemain, saya ingin tidak bisa bertindak di luar giliran saya, agar urutan permainan terjaga.
26. Sebagai pemain, saya ingin tidak ada batas waktu giliran di mode offline, agar saya bisa berpikir dengan santai.

### Pass

27. Sebagai pemain, saya ingin **Pass** terjadi otomatis ketika saya tidak punya kartu yang cocok, agar saya tidak perlu menekan tombol.
28. Sebagai pemain, saya ingin melihat gelembung "Nama pass" di dekat kursi pemain yang pass, disertai nada tanya, agar saya tahu siapa yang lewat.
29. Sebagai pemain, saya ingin pass tidak menambah penalti poin.

### Rantai kartu

30. Sebagai pemain, saya ingin rantai tumbuh ke kiri dan kanan dari kartu pertama di tengah meja.
31. Sebagai pemain, saya ingin balak dipasang melintang, agar mudah dikenali seperti di meja sungguhan.
32. Sebagai pemain, saya ingin rantai melipat seperti ular di dekat tepi area (ujung kanan turun, ujung kiri naik) lewat kartu penghubung tegak, agar rantai panjang tetap rapi.
33. Sebagai pemain, saya ingin seluruh rantai sampai 28 kartu selalu muat di layar tanpa perlu digeser, dengan ukuran kartu mengecil otomatis.
34. Sebagai pemain, saya ingin kartu di rantai tidak pernah bertumpuk atau terputus secara visual, agar saya bisa membaca kedua ujung dengan jelas.

### Lawan (bot)

35. Sebagai pemain, saya ingin setiap kursi lawan menampilkan **Nama panggilan**, **Total poin**, sisa kartu, penanda bot, dan penanda giliran yang berdenyut.
36. Sebagai pemain, saya ingin kartu lawan hanya tampil sebagai punggung kartu dengan jumlah sesuai sisa kartu, agar nilainya tetap rahasia.
37. Sebagai pemain, saya ingin bot memberi jeda "berpikir" sebelum bertindak, agar saya bisa mengikuti jalannya permainan.
38. Sebagai pemain, saya ingin kartu bot terbalik saat terbang dari kursinya ke rantai, agar saya melihat kartu apa yang dipasang.
39. Sebagai pemain, saya ingin bot selalu mematuhi aturan yang sama dengan saya, termasuk aturan pembuka dan pass.
40. Sebagai pemain, saya ingin bot punya strategi yang masuk akal (membuang kartu bernilai besar dan mempertahankan angka yang masih banyak dipegang), agar permainan tidak terlalu mudah.
41. Sebagai pemain, saya ingin bot tidak "curang" dengan melihat kartu tangan pemain lain, agar persaingannya jujur.

### Akhir sesi

42. Sebagai pemain, saya ingin sesi langsung berakhir ketika seorang pemain menghabiskan kartunya, dan pemain itu menjadi satu-satunya **Pemenang sesi**.
43. Sebagai pemain, saya ingin kartu habis tetap dihitung sebagai menang sesi walaupun kartu terakhir itu sekaligus membuat susunan buntu.
44. Sebagai pemain, saya ingin sesi berakhir dengan **Gaplek** ketika tidak ada pemain yang bisa melanjutkan susunan, dan angka gapleknya ditampilkan.
45. Sebagai pemain, saya ingin efek besar untuk balak dipasang (cincin emas, percikan, teks "BALAK n!", getar layar, bunyi hantaman + kilau kaca).
46. Sebagai pemain, saya ingin efek besar untuk kartu terakhir yang memenangkan sesi (kilat, pita, teks besar, fanfare).
47. Sebagai pemain, saya ingin efek besar untuk gaplek (pita dengan teks merah, getar layar kuat, tiga nada rendah).

### Poin

48. Sebagai pemain, saya ingin **Poin sesi** dihitung dari jumlah nilai kedua bagian semua kartu yang masih dipegang.
49. Sebagai pemain, saya ingin balak 1–6 dihitung dua kali lipat saat opsi balak ganda aktif, sedangkan balak 0 tidak terpengaruh.
50. Sebagai pemain, saya ingin balak 0 bernilai 25 ketika menjadi **Balak 0 mati** (tidak ada pemain, termasuk pemegangnya, yang masih memegang kartu berangka 0 lainnya), dan 0 dalam kondisi lain.
51. Sebagai pemenang sesi, saya ingin mendapat nol poin sesi.
52. Sebagai pemain, saya ingin poin sesi setiap pemain ditambahkan ke total poinnya, baik sesi berakhir karena kartu habis maupun gaplek.
53. Sebagai pemain, saya ingin melihat ringkasan sesi (sisa kartu setiap pemain, poin sesi, total poin) selama beberapa detik, lalu sesi berikutnya dimulai otomatis.
54. Sebagai pemain, saya ingin total poin setiap pemain terlihat di kursinya selama sesi berlangsung.

### Akhir game

55. Sebagai pemain, saya ingin game berakhir setelah poin sesi dihitung dan ada pemain yang total poinnya mencapai atau melewati target.
56. Sebagai pemain, saya ingin semua pemain yang mencapai atau melewati target pada sesi itu dinyatakan **Kalah**.
57. Sebagai pemain, saya ingin pemain dengan total poin terendah di bawah target menjadi **Juara 1**, termasuk juara 1 bersama jika totalnya sama.
58. Sebagai pemain, saya ingin tidak ada juara 1 jika keempat pemain kalah pada sesi yang sama.
59. Sebagai pemain, saya ingin layar hasil akhir game langsung muncul setelah sesi penutup, dengan efek juara 1 (dua power-up disusul bunyi chip bertumpuk).
60. Sebagai pemain, saya ingin bisa memulai game baru dari layar hasil akhir, dengan target dan opsi balak ganda yang bisa diubah, dan total poin kembali nol.
61. Sebagai pemain, saya ingin bisa kembali ke menu dari layar hasil akhir.

### Keluar dan persistensi

62. Sebagai pemain, saya ingin bisa keluar dari game yang sedang berjalan ke menu setelah konfirmasi, agar tidak keluar tanpa sengaja.
63. Sebagai pemain, saya paham bahwa menutup tab atau browser menghapus game offline yang sedang berjalan, dan tidak ada fitur lanjutkan.

### Tampilan, suara, dan preferensi

64. Sebagai pemain, saya ingin memilih **Gambar meja** dari koleksi yang disediakan, dan pilihan itu diingat browser untuk kunjungan berikutnya.
65. Sebagai pemain, saya ingin hanya gambar meja yang saya pilih yang dimuat, agar loading tetap ringan.
66. Sebagai pemain, saya ingin tombol mute yang diingat browser, agar saya bisa bermain diam-diam.
67. Sebagai pemain, saya ingin suara efek diputar tepat saat kartu mendarat atau efek dimulai, bukan saat kartu mulai bergerak.
68. Sebagai pemain, saya ingin tidak ada musik latar.
69. Sebagai pemain, saya ingin kartu dan teks tetap tajam di layar HP beresolusi tinggi maupun di laptop.
70. Sebagai pemain, saya ingin tampilan meja menyesuaikan ukuran layar dari HP landscape (misalnya 844×390) sampai laptop (misalnya 1440×900).
71. Sebagai pemain, saya ingin kipas kartu tangan saya besar dan mudah diketuk di HP.

### Offline dan performa

72. Sebagai pemain, saya ingin game bisa dibuka dan dimainkan tanpa internet setelah situs pernah dibuka sekali.
73. Sebagai pemain, saya ingin memasang game ke layar utama HP sebagai PWA, agar bisa dibuka seperti aplikasi.
74. Sebagai pemain, saya ingin game terasa cepat dan responsif, dengan animasi yang mulus dan loading minimal.
75. Sebagai pemain, saya ingin audio aktif setelah ketukan pertama saya tanpa ada error, sesuai aturan browser.

### Fondasi tahap 2

76. Sebagai pengembang tahap 2, saya ingin memakai modul aturan dan bot di server Node.js tanpa perubahan, agar aturan offline dan online selalu sama.
77. Sebagai pengembang tahap 2, saya ingin modul aturan bisa menghasilkan pandangan per kursi yang menyembunyikan tangan pemain lain, agar server bisa mengirim state yang aman ke setiap klien dan **Penonton**.
78. Sebagai pengembang, saya ingin pengacakan kartu bisa disuntikkan (seed), agar game bisa diputar ulang secara deterministik dalam pengujian.

## Implementation Decisions

### Struktur proyek

- Monorepo pnpm dengan TypeScript di seluruh bagian. Build web memakai Vite. Minimal ada dua unit:
  - **Paket aturan** (termasuk bot): tanpa dependensi DOM, React, Pixi, timer, atau `Math.random`. Harus bisa di-import apa adanya oleh server Node.js di tahap 2.
  - **Aplikasi web**: React, @pixi/react v8 (pixi.js 8, React 19), PWA.
- Kode prototype di `.scratch/prototype-meja/` tidak dipakai sebagai fondasi. Yang dipakai hanya keputusannya (lihat `HASIL.md`). File suara Kenney di `.scratch/prototype-meja/public/sfx/` dipindahkan ke aset produksi, tetapi hanya file yang terpilih beserta lisensinya.

### Modul 1: Mesin aturan (seam utama)

Modul yang dalam, dengan interface kecil. Semua **Aturan kelompok** tersimpan di dalamnya.

- **Konfigurasi game**: target poin (bilangan bulat positif, bawaan 100), balak ganda (boolean, bawaan mati), dan empat kursi dengan urutan searah jarum jam.
- **Sumber acak disuntikkan**, berupa fungsi atau seed. Pengacakan dan pembagian ulang (≥5 balak) berlangsung di dalam modul, dengan hasil deterministik untuk seed yang sama.
- **State tidak berubah (immutable) dan bisa diserialisasi.** State berupa data biasa tanpa kelas atau fungsi, sehingga server tahap 2 dapat menyimpan atau mengirimnya.
- **Operasi publik** (nama final ditentukan saat implementasi):
  - mulai game dari konfigurasi dan sumber acak;
  - daftar langkah legal untuk kursi yang sedang giliran (pasangan kartu dan ujung). Pada pembuka sesi, langkah legal dibatasi sesuai aturan pembuka: 0–0 di sesi pertama, balak n setelah gaplek n, atau kartu apa pun untuk pemenang sesi;
  - terapkan aksi (pasang kartu di ujung tertentu). Aksi ilegal ditolak dengan alasan yang jelas, dan state tidak berubah;
  - pandangan per kursi: tangan sendiri, rantai, kedua ujung, jumlah sisa kartu lawan, total poin, dan riwayat publik. Tangan lawan tidak ikut. Ada juga pandangan penonton tanpa tangan siapa pun, untuk tahap 2.
- **Pass dan transisi otomatis terjadi di dalam mesin.** Setelah aksi diterapkan, mesin terus maju melewati kursi yang tidak punya langkah legal (mencatat event pass), sampai ada kursi yang harus memilih atau sesi berakhir. Pemanggil tidak pernah mengirim aksi "pass".
- **Gaplek dideteksi segera setelah kartu dipasang**, yaitu ketika tidak ada pemain yang punya langkah legal dan belum ada yang kartunya habis. Mesin tidak menunggu empat pass berturut-turut. Secara matematis, gaplek selalu terjadi dengan kedua ujung bernilai sama (n), karena ketujuh kartu berangka n sudah di meja. Angka n ini disimpan untuk menentukan pembuka sesi berikutnya.
- **Kartu habis diperiksa sebelum gaplek.**
- **Akhir sesi** menghasilkan poin sesi setiap kursi (termasuk balak ganda dan balak 0 mati), total baru, dan status game (lanjut, atau berakhir dengan daftar juara 1 dan kalah).
- **Sesi berikutnya dimulai lewat operasi eksplisit** (misalnya "lanjut ke sesi berikutnya"), bukan otomatis di dalam mesin. Jeda ringkasan sesi menjadi urusan pengendali.
- **Setiap aksi mengembalikan state baru dan daftar event berurutan.** Event menjadi kontrak antara mesin dan presentasi (dan nanti jaringan). Event minimal:
  - kartu dibagikan (per sesi, dengan tanda jika terjadi pembagian ulang);
  - kartu dipasang (kursi, kartu, ujung, apakah balak);
  - pass (kursi);
  - sesi berakhir (sebab: kartu habis dengan kursi pemenang, atau gaplek dengan angka n; disertai sisa kartu dan poin sesi per kursi);
  - game berakhir (juara 1 dan kalah; bisa tanpa juara 1).
- **Kartu direpresentasikan secara kanonik** (nilai kecil lebih dulu) dengan identitas stabil, sehingga setiap kartu bisa menjadi key tetap di presentasi.

### Modul 2: Bot

- **Fungsi murni** yang menerima pandangan kursi (bukan state penuh) dan mengembalikan satu langkah legal. Bot tidak bisa melihat tangan lawan.
- **Strategi tingkat tunggal:**
  1. Utamakan membuang kartu dengan nilai terbesar. Balak sedikit diprioritaskan karena berisiko tinggi di akhir sesi, terutama saat balak ganda aktif.
  2. Pertahankan angka yang masih banyak dipegang, dengan memilih kartu dan ujung yang menyisakan ujung rantai bernilai angka yang paling banyak ada di tangan sendiri, agar tidak mudah pass.
  3. Jika kartu cocok di dua ujung, pilih ujung berdasarkan kriteria nomor 2.
  4. Tie-break deterministik, sehingga uji bisa memastikan pilihannya.
- **Jeda berpikir bot** (770 ms ditambah durasi efek besar sebelumnya) adalah urusan pengendali, bukan bot.

### Modul 3: Layout rantai (seam kedua)

- **Fungsi murni:** (urutan kartu rantai dengan ujung tempat masing-masing kartu dipasang, ukuran area rantai) → posisi, rotasi, dan ukuran setiap kartu, beserta posisi kedua ujung terbuka (untuk target ketuk).
- **Aturan pelipatan** dari prototype (`HASIL.md` bagian 1):
  1. Kartu pertama di tengah. Balak dipasang melintang.
  2. Ujung kanan tumbuh ke kanan, ujung kiri tumbuh ke kiri.
  3. Jika kartu berikutnya akan melewati batas area (dengan cadangan satu lebar kartu), kartu itu menjadi **penghubung tegak** di tepi: ujung kanan turun, ujung kiri naik. Rantai lalu berbalik arah di baris berikutnya dengan jarak baris 2× lebar kartu.
  4. Balak tidak pernah menjadi penghubung. Jika balak datang tepat setelah belokan, posisinya digeser setengah lebar kartu.
  5. Rantai dipusatkan pada batas luarnya. Jika tidak muat, ukuran kartu dikurangi bertahap sampai muat.
- **Ukuran referensi di HP landscape 844×390:** kartu rantai sekitar 24 px lebar untuk 28 kartu.
- Modul ini tidak tahu Pixi, sehingga bisa diuji tanpa kanvas.

### Modul 4: Pengendali game offline

- **Menjalankan loop offline:** memegang state mesin, meneruskan aksi pemain manusia, memanggil bot untuk kursi bot, lalu menjadwalkan event ke presentasi dengan jeda yang benar (animasi, jeda bot, dan ringkasan sesi beberapa detik sebelum sesi berikutnya dimulai otomatis).
- **Menahan input manusia** selama animasi berjalan atau saat bukan gilirannya.
- **Hanya hidup di memori.** Tidak ada penyimpanan game ke storage.
- **Tahap 2** akan punya pengendali online sendiri yang menerima event dari server lewat kontrak event yang sama. Karena itu, presentasi tidak boleh bergantung pada pengendali offline secara langsung.

### Modul 5: Presentasi meja (React + @pixi/react)

- **Tata letak varian D** dari prototype:
  - lawan duduk di kiri, atas, dan kanan; setiap kursi punya pil info (nama panggilan, total poin, sisa kartu, label BOT, penanda giliran berupa garis emas berdenyut) dan deret punggung kartu (tegak di samping, mendatar di atas);
  - tangan pemain berupa kipas melengkung di bawah, dengan tinggi kartu sekitar 34% tinggi layar dan sebagian terpotong tepi bawah;
  - rantai kartu di tengah.
- **Ukuran relatif di HP landscape:** area kursi samping sekitar 11% lebar layar, pita kursi atas sekitar 13% tinggi layar.
- **Penyorotan kartu:** kartu legal terang dan sedikit terangkat, kartu lainnya alpha 0,42. Kartu yang cocok di dua ujung diberi garis emas, lalu kedua ujung menampilkan kotak emas berdenyut yang bisa diketuk. Seret (drag) tidak dipakai.
- **Temuan teknis prototype yang wajib diikuti:**
  - state meja baru diisi setelah `<Application>` siap (`onInit`); lihat catatan di ADR 0001;
  - tween berjalan di `useTick` dan menulis langsung ke objek Pixi lewat ref; React hanya mengirim posisi tujuan, tanpa render ulang per frame;
  - satu kartu = satu komponen dengan key tetap, sehingga kartu bisa terbang dari tangan atau kursi lawan ke rantai tanpa logika perpindahan khusus;
  - teks Pixi memakai resolusi 2.
- **Kartu digambar sebagai vektor.** Formatnya tidak dikunci ke SVG; prototype menggambar dengan Pixi `Graphics` pada satu ukuran dasar lalu diskalakan, dan hasilnya tetap tajam. Ini menggantikan penyebutan "(SVG)" di `docs/visi-produk.md`.
- **Durasi dan gaya animasi** mengikuti preset "dramatis ×1,4" dari prototype, dan menggantikan batas "di bawah 1 detik / 1–2 detik" dari rancangan awal:

  | Kejadian | Durasi | Gaya |
  |---|---|---|
  | Kartu tangan → ujung rantai | 476 ms | ease-out cubic; kartu lawan terbalik (flip skala-X) selama terbang |
  | Bagi kartu | jeda 28 ms per kartu, terbang 476 ms (≈ 1,26 dtk total) | bergiliran ke tiap kursi dari tengah meja |
  | Pass | 1,26 dtk | gelembung "Nama pass" di dekat kursi, muncul membal lalu memudar |
  | Balak | 1,82 dtk | cincin emas mengembang, 18 percikan, teks "BALAK n!", getar layar 308 ms (amplitudo 5 px) |
  | Menang sesi | 2,52 dtk | kilat putih, pita gelap menyapu masuk, teks besar menghentak (skala 2,4 → 1), kilau diagonal |
  | Gaplek | 2,38 dtk | pita dengan teks merah, getar layar 630 ms (amplitudo 10 px) |
  | Juara 1 | 2,77 dtk | seperti menang sesi |
  | Jeda berpikir bot | 770 ms | ditambah durasi efek besar sebelumnya |

  Semua durasi disimpan di satu tempat sebagai konstanta, agar mudah disetel.

### Modul 6: Audio

- **Pemetaan suara:**
  - bagi kartu: klik sintetis (derau bandpass) per kartu, mengikuti jeda bagi;
  - kartu dipasang: Kenney `card-place-1..4` dipilih acak, dengan variasi nada ±6%;
  - pass: `question_001`;
  - balak: `impactPunch_heavy_001` + `glass_002` dua kali;
  - menang sesi: fanfare sintetis C–E–G–C (gelombang square);
  - gaplek: `lowThreeTone`;
  - juara 1: `powerUp9` + `powerUp12` + `chips-stack-1`.
- **Format dan pemutaran:** file .m4a (AAC) agar didukung Safari. Suara sintetis dibuat dengan Web Audio tanpa file. `AudioContext` dibuka setelah interaksi pertama. Suara diputar saat kartu mendarat atau efek dimulai.
- **Mute** disimpan di `localStorage`, dibungkus try/catch, dan tetap berfungsi walaupun storage tidak tersedia.

### Modul 7: Shell aplikasi dan PWA

- **Layar:**
  - menu (bisa dipakai portrait): mulai game offline, pengaturan target poin dan balak ganda, pilih gambar meja, dan mute;
  - meja (landscape): menampilkan petunjuk putar HP jika dibuka dalam posisi portrait;
  - ringkasan sesi (overlay beberapa detik, bawaan 5 detik);
  - hasil akhir game: juara 1 dan kalah, main lagi (target dan opsi bisa diubah), serta kembali ke menu.
- **Nama panggilan di mode offline:** pemain manusia memakai nama bawaan "Kamu", dan bot memakai nama tetap yang berbeda-beda dengan label BOT. Input nama panggilan baru dibutuhkan di tahap 2 untuk **Ruang privat**.
- **Gambar meja:**
  - koleksi disiapkan pengembang di folder aset;
  - pilihan disimpan di `localStorage`;
  - hanya gambar yang dipilih yang dimuat. Gambar lain tidak ikut di-precache; hanya gambar bawaan yang tersedia offline sejak kunjungan pertama, sedangkan gambar lain di-cache saat pertama kali dipilih.
- **PWA:**
  - service worker mem-precache shell aplikasi, kode, suara, dan gambar meja bawaan;
  - punya manifest agar bisa dipasang ke layar utama;
  - orientasi tidak dikunci di manifest; petunjuk putar HP ditangani oleh aplikasi.

## Testing Decisions

- **Prinsip:** uji hanya perilaku eksternal lewat interface publik modul. Jangan menguji fungsi internal, struktur data privat, atau urutan pemanggilan. Uji yang baik tetap lulus ketika implementasi internal ditulis ulang.
- **Test runner:** Vitest. Paket aturan dikembangkan test-first (`/tdd`), dan menjadi tiket paling awal karena UI dan tahap 2 bergantung padanya.
- **Seam 1 — mesin aturan + bot** (lewat operasi publik: mulai game dengan seed, langkah legal, terapkan aksi, pandangan kursi, event):
  - pembagian: 28 kartu habis, 7 per kursi, tanpa duplikat; pembagian ulang terjadi jika ada kursi dengan ≥5 balak (dibuat dengan sumber acak yang diatur);
  - pembuka: 0–0 wajib di sesi pertama; pemenang sesi bebas memilih kartu; balak n wajib setelah gaplek n; kembali ke 0–0 saat game baru;
  - pemasangan: kecocokan ujung, pilihan dua ujung, dan penolakan aksi ilegal (salah giliran, kartu tidak cocok, kartu bukan milik kursi) tanpa mengubah state;
  - pass otomatis beserta event-nya;
  - akhir sesi: kartu habis, gaplek, kartu habis sekaligus buntu (dihitung menang sesi), dan angka gaplek;
  - poin: penjumlahan biasa, balak ganda aktif dan mati, balak 0 mati (termasuk contoh Budi di `docs/aturan-permainan.md`), dan nol poin untuk pemenang sesi;
  - akhir game: melewati target tanpa harus tepat, kalah bersama, juara 1 bersama (contoh Anwar/Agus/Joko/Budi), semua kalah tanpa juara 1, dan total kembali nol di game baru;
  - pandangan kursi tidak membocorkan tangan lawan;
  - determinisme: seed yang sama menghasilkan urutan event yang sama;
  - properti (disarankan `fast-check`): game acak yang dimainkan bot sampai selesai selalu berakhir, jumlah kartu selalu 28, bot selalu memilih langkah legal, dan total poin tidak pernah turun;
  - bot: pada situasi yang disusun, bot membuang kartu bernilai terbesar dan memilih ujung yang mempertahankan angka terbanyak di tangannya.
- **Seam 2 — layout rantai:**
  - uji properti untuk rantai acak sampai 28 kartu di beberapa ukuran area (HP 844×390, laptop 1440×900): semua kartu berada di dalam area, tidak ada yang bertumpuk, setiap kartu bersebelahan dengan pasangannya, balak melintang, dan balak tidak pernah menjadi penghubung;
  - uji contoh untuk kasus belokan pertama dan balak tepat setelah belokan.
- **Presentasi, audio, shell:** tanpa uji unit. Diverifikasi manual di browser, dengan tata letak dibandingkan ke screenshot prototype di `.scratch/prototype-meja/shots/` (`D-hp.png`, `D-hp-rantai28.png`). Ditambah satu smoke test Playwright:
  - memulai game offline, memainkan setidaknya satu sesi sampai ringkasan sesi muncul;
  - memuat ulang aplikasi dalam mode offline (network dimatikan) setelah kunjungan pertama.
- **Prior art:** belum ada. Proyek ini greenfield, dan uji pertama di paket aturan akan menjadi pola bagi uji lainnya.

## Out of Scope

- Mode online: **Ruang privat**, **Host**, **Penonton**, input **Nama panggilan**, tautan dan kode undangan, pengambilalihan kursi oleh bot setelah 5 menit, reconnect, server Node.js + Colyseus. Modul aturan hanya dirancang agar bisa dipakai di sana.
- Menyimpan atau melanjutkan game offline setelah tab ditutup.
- Beberapa tingkat kesulitan bot.
- Komunikasi di dalam game (chat, suara).
- Musik latar.
- Akun, login, statistik, dan riwayat game.
- Tampilan meja dalam posisi portrait.
- Drag untuk memasang kartu.
- Batas waktu giliran di mode offline.

## Further Notes

- **Kontradiksi dokumen yang diselesaikan:** durasi animasi hasil prototype menggantikan batas "animasi cepat di bawah 1 detik, efek besar 1–2 detik", dan kartu cukup berupa "vektor" tanpa mengunci format SVG. Kalimat terkait di `docs/visi-produk.md` sudah dirapikan agar sesuai.
- **Target performa** belum berupa angka terukur. Usulan untuk diverifikasi saat implementasi: animasi 60 fps di laptop dan setidaknya 50 fps di HP Android kelas menengah, serta kunjungan ulang (dari cache PWA) siap bermain di bawah 2 detik. Prototype baru terbukti 60 fps di laptop (Chromium headless) dan belum diuji di HP asli. Uji di HP asli sebaiknya menjadi bagian tiket presentasi meja.
- **Asumsi yang perlu dikonfirmasi saat review tiket:**
  - gaplek diumumkan segera tanpa menampilkan empat gelembung pass;
  - ringkasan sesi tampil 5 detik;
  - nama "Kamu" dipakai untuk pemain manusia, dan bot diberi nama tetap.
- **Istilah baru dari prototype:** "penghubung tegak" (kartu pada belokan rantai). Istilah ini bersifat presentasi, bukan domain aturan, sehingga tidak dimasukkan ke `CONTEXT.md`.
- Urutan tiket yang disarankan untuk `/to-tickets`:
  1. paket aturan (tracer bullet: satu sesi sampai poin);
  2. bot;
  3. layout rantai;
  4. meja statis;
  5. pengendali + animasi;
  6. audio;
  7. shell + PWA.
