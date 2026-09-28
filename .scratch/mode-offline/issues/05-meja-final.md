# 05 — Meja final: rantai melipat dan tata letak responsif

Status: done
Blocked by: 01

## Parent

`.scratch/mode-offline/spec.md`

## What to build

- **Layout rantai sebagai fungsi murni** tanpa Pixi (lihat spec, Modul 3). Input: urutan kartu rantai beserta ujung tempat dipasang, dan ukuran area. Output: posisi, rotasi, dan ukuran setiap kartu, beserta posisi kedua ujung terbuka.
- **Lima aturan pelipatan** dari prototype:
  1. kartu pertama di tengah;
  2. ujung kanan tumbuh ke kanan, ujung kiri tumbuh ke kiri;
  3. di dekat tepi, kartu berikutnya menjadi penghubung tegak (ujung kanan turun, ujung kiri naik), lalu rantai berbalik arah dengan jarak baris 2× lebar kartu;
  4. balak dipasang melintang dan tidak pernah menjadi penghubung; jika balak datang tepat setelah belokan, posisinya digeser setengah lebar kartu;
  5. rantai dipusatkan, dan ukuran kartu dikecilkan sampai seluruh rantai muat.
- **Tata letak varian D, responsif dari HP landscape 844×390 sampai laptop 1440×900:**
  - area kursi samping sekitar 11% lebar layar, pita kursi atas sekitar 13% tinggi layar;
  - tangan pemain berupa kipas melengkung dengan kartu sekitar 34% tinggi layar, sebagian terpotong tepi bawah;
  - kartu legal sedikit terangkat, kartu lain alpha 0,42.
- **Kartu digambar sebagai vektor** (Pixi `Graphics` diskalakan). Teks Pixi memakai resolusi 2.
- **Petunjuk putar HP** tampil jika meja dibuka dalam posisi portrait.

Referensi visual: `.scratch/prototype-meja/shots/D-hp.png` dan `D-hp-rantai28.png`.

## Acceptance criteria

- [ ] Uji properti layout untuk rantai acak sampai 28 kartu, di area HP dan laptop: semua kartu berada di dalam area, tidak ada yang bertumpuk, setiap kartu bersebelahan dengan pasangannya, balak melintang, dan balak tidak pernah menjadi penghubung.
- [ ] Ada uji contoh untuk belokan pertama dan untuk balak yang datang tepat setelah belokan.
- [ ] Kartu rantai sekitar 24 px lebar untuk 28 kartu di 844×390.
- [ ] Target ketuk ujung rantai mengikuti posisi ujung dari layout.
- [ ] Tata letak meja cocok dengan screenshot varian D di HP, dan tetap rapi di laptop.
- [ ] Kartu dan teks tetap tajam di layar HP resolusi tinggi.
- [ ] Posisi portrait di HP menampilkan petunjuk putar.

## Blocked by

- 01
