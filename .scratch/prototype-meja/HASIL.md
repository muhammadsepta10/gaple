# Hasil prototype meja Gaple (28 September 2026)

Kode di folder ini dibuang. Yang dipakai hanya jawaban di bawah. Keputusan produk sudah dicatat di `docs/visi-produk.md`.

Jalankan: `pnpm dev` di folder ini, lalu buka `http://localhost:5199/?variant=D`.

## 1. Tata letak (dipilih: varian D = A + tangan kipas)

- Lawan duduk di sisi masing-masing: kiri, atas, kanan (urutan giliran searah jarum jam dari pemain di bawah).
- Setiap kursi punya pil info (nama panggilan, total poin, sisa kartu, label BOT, penanda giliran berupa garis emas berdenyut) dan deret punggung kartu. Deret kursi kiri dan kanan tersusun tegak, kursi atas mendatar.
- Tangan pemain berupa kipas melengkung di bawah. Tinggi kartu sekitar 34% tinggi layar, dan sebagian terpotong tepi bawah.
- Rantai kartu mengisi tengah meja, di antara kursi samping, di bawah kursi atas, dan di atas kipas.
- Kartu yang bisa dipasang terang dan sedikit terangkat, sisanya redup (alpha 0,42). Kartu yang cocok di dua ujung diberi garis emas, lalu kedua ujung rantai menampilkan kotak emas berdenyut yang bisa diketuk.
- Ukuran relatif di HP landscape 844×390:
  - area kursi samping sekitar 11% lebar layar;
  - pita kursi atas sekitar 13% tinggi layar;
  - kartu rantai mengecil otomatis, sekitar 24 px lebar saat rantai 28 kartu.

### Aturan pelipatan rantai

1. Kartu pertama ada di tengah. Balak dipasang melintang.
2. Ujung kanan tumbuh ke kanan, ujung kiri tumbuh ke kiri.
3. Saat kartu berikutnya akan melewati batas area (dengan cadangan satu lebar kartu), kartu itu menjadi **penghubung tegak** di tepi. Ujung kanan turun, ujung kiri naik. Rantai lalu berbalik arah di baris berikutnya, dengan jarak baris 2 kali lebar kartu.
4. Balak tidak pernah menjadi penghubung. Jika balak datang tepat setelah belokan, posisinya digeser setengah lebar kartu agar tidak menabrak penghubung.
5. Rantai dipusatkan pada batas luarnya. Jika tidak muat, ukuran kartu dikurangi 1 px sampai muat. Sudah diuji 50 rantai acak 28 kartu: selalu tersambung dan tidak ada kartu yang bertumpuk.

### Screenshot (`shots/`)

- `D-hp.png`, `D-hp-rantai28.png`: tata letak pilihan.
- `A-*`, `B-*`, `C-*`: varian pembanding, di HP (`hp`) dan laptop 1440×900 (`laptop`).
- `B-hp-giliran.png`: penyorotan kartu yang bisa dipasang.
- `B-hp-dua-ujung.png`: pilihan saat kartu cocok di dua ujung.
- `A-hp-efek-*.png`, `C-hp-efek-Menang.png`: efek besar.
- `panel-suara.png`: papan uji suara.

## 2. Animasi (dipilih: preset dramatis ×1,4)

| Kejadian | Durasi | Gaya |
|---|---|---|
| Kartu tangan → ujung rantai | 476 ms | ease-out cubic; kartu lawan terbalik (flip skala-X) selama terbang |
| Bagi kartu | 28 kartu, jeda 28 ms per kartu, terbang 476 ms ≈ 1,26 dtk | bergiliran ke tiap kursi dari tengah meja |
| Pass | 1,26 dtk | gelembung "Nama pass" dekat kursi, muncul membal lalu memudar |
| Balak | 1,82 dtk | cincin emas mengembang, 18 percikan, teks "BALAK n!", getar layar 308 ms (amplitudo 5 px) |
| Menang sesi | 2,52 dtk | kilat putih, pita gelap menyapu masuk, teks besar menghentak (skala 2,4 → 1), kilau diagonal |
| Gaplek | 2,38 dtk | pita dengan teks merah, getar layar 630 ms (amplitudo 10 px) |
| Juara 1 | 2,77 dtk | seperti menang sesi |
| Jeda berpikir bot | 770 ms | ditambah durasi efek besar sebelumnya |

## 3. Suara (dipilih)

| Momen | Suara |
|---|---|
| Bagi kartu | sintetis: klik pendek per kartu (derau bandpass, mengikuti jeda bagi) |
| Kartu dipasang | Kenney `card-place-1..4` acak, nada ±6% |
| Pass | Kenney `question_001` |
| Balak | Kenney `impactPunch_heavy_001` + `glass_002` dua kali |
| Menang sesi | sintetis: fanfare C–E–G–C (gelombang square) |
| Gaplek | Kenney `lowThreeTone` |
| Juara 1 | Kenney `powerUp9` + `powerUp12` + `chips-stack-1` |

Semua aset Kenney berlisensi CC0 dan ada di `public/sfx/` (.m4a AAC 96 kbps). Semua kandidat, termasuk yang tidak dipilih, total 244 KB. Suara diputar saat kartu mendarat, bukan saat kartu mulai bergerak.

## 4. Temuan teknis @pixi/react v8 (pixi.js 8.21, React 19)

- **Perubahan data sebelum kanvas siap tidak tergambar.** `<Application>` disiapkan secara async. Perubahan state yang terjadi sebelum kanvas siap tidak ikut tergambar, jadi kanvas tetap menampilkan kondisi awal walaupun state React sudah berubah. Implementasi nyata harus menunggu kanvas siap (`onInit`) sebelum mengisi state meja.
- **Tween tanpa render ulang React.** Pola yang dipakai: React hanya mengirim posisi tujuan. Setiap kartu menjalankan tween di `useTick`, dan `useTick` menulis langsung ke objek Pixi lewat ref. Hasilnya 60 fps di laptop (Chromium headless). Belum diuji di HP asli.
- **Kartu vektor tetap tajam.** Kartu digambar dengan Graphics pada satu ukuran dasar lalu diskalakan, dan tetap tajam di semua ukuran. Ini mendukung keputusan kartu berupa vektor.
- **Teks Pixi perlu resolusi 2** agar tajam di layar HP.
- **Satu kartu = satu komponen dengan key tetap.** Karena itu kartu bisa terbang dari tangan atau kursi lawan ke rantai tanpa logika perpindahan khusus.
- **Audio:** `AudioContext` baru bisa dibuka setelah ketukan pertama pemain. Pilih `.m4a` daripada `.ogg` karena dukungan Safari.
- **ADR 0001 tidak perlu direvisi.** Cukup tambahkan catatan soal kanvas yang disiapkan secara async.
