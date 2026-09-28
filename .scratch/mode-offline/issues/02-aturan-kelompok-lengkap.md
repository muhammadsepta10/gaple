# 02 — Aturan kelompok lengkap per sesi

Status: ready-for-agent
Blocked by: 01

## Parent

`.scratch/mode-offline/spec.md`

## What to build

Melengkapi mesin aturan dan alur di browser sehingga seluruh **Aturan kelompok** untuk satu sesi dan sesi lanjutan berlaku.

- **Pengaturan game di menu** (menu bisa dipakai dalam posisi portrait):
  - **Target poin**, bawaan 100;
  - opsi **Balak ganda**, bawaan mati;
  - keduanya terkunci selama game.
- **Pembagian ulang:** jika ada kursi yang mendapat 5 balak atau lebih, kartu diacak dan dibagikan ulang, lalu pemain diberi tahu.
- **Gaplek:** terdeteksi segera setelah kartu dipasang, tanpa menunggu empat pass. Kartu habis diperiksa lebih dulu, sehingga kartu terakhir yang sekaligus membuat buntu tetap dihitung menang sesi.
- **Poin sesi:**
  - jumlah nilai kedua bagian kartu yang masih dipegang;
  - dengan balak ganda aktif, balak 1–6 dihitung ×2;
  - **Balak 0 mati** bernilai 25;
  - pemenang sesi mendapat 0.
- **Total poin** terakumulasi dan tampil di kursi masing-masing.
- **Ringkasan sesi** (sisa kartu, poin sesi, total poin) tampil 5 detik, lalu sesi berikutnya dimulai otomatis.
- **Pembuka sesi lanjutan:**
  - setelah kartu habis, pemenang sesi bebas memilih kartu apa pun;
  - setelah gaplek n, pemegang balak n wajib membuka dengan balak n.

## Acceptance criteria

- [ ] Menu bisa mengatur target poin (bawaan 100) dan balak ganda (bawaan mati). Keduanya tidak bisa diubah selama game.
- [ ] Pembagian dengan ≥5 balak di satu kursi selalu diulang (diuji dengan sumber acak yang diatur), dan pemain melihat pemberitahuan.
- [ ] Gaplek terdeteksi tepat ketika tidak ada kursi yang punya langkah legal. Event gaplek membawa angka n, dan kedua ujung bernilai n.
- [ ] Kartu terakhir yang sekaligus membuat buntu menghasilkan menang sesi, bukan gaplek.
- [ ] Perhitungan poin lulus contoh di `docs/aturan-permainan.md`: balak 6 = 12 atau 24, 4–4 ganda = 16, contoh Budi 0–0 dengan 0–4 = 4, dan 0–0 dengan 3–5 = 33.
- [ ] Balak 0 mati berlaku, baik sesi berakhir karena kartu habis maupun gaplek. Balak ganda tidak memengaruhi balak 0.
- [ ] Ringkasan sesi tampil sekitar 5 detik, lalu sesi berikutnya dimulai tanpa aksi pemain.
- [ ] Pemenang sesi bisa membuka dengan kartu bukan balak. Setelah gaplek n, hanya balak n yang legal untuk pemegangnya.

## Blocked by

- 01
