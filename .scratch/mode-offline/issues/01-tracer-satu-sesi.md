# 01 — Tracer: satu sesi bisa dimainkan

Status: ready-for-agent
Blocked by: None

## Parent

`.scratch/mode-offline/spec.md`

## What to build

Irisan tipis pertama dari ujung ke ujung. Pemain membuka aplikasi web, memulai game offline, lalu memainkan satu **Sesi** melawan tiga **Bot** sampai ada pemain yang menghabiskan kartunya.

Tiket ini juga menyiapkan kerangka proyek:
- monorepo pnpm berisi paket aturan (TypeScript murni, tanpa DOM, React, Pixi, timer, atau `Math.random`) dan aplikasi web (Vite, React 19, @pixi/react v8);
- Vitest.

Mesin aturan (lihat spec, Modul 1):
- menerima sumber acak yang disuntikkan;
- membagikan 28 kartu, 7 per kursi;
- pembuka sesi pertama wajib 0–0 oleh pemegangnya;
- menyediakan daftar langkah legal, termasuk pilihan ujung jika kartu cocok di dua ujung;
- menolak aksi ilegal tanpa mengubah state;
- menjalankan pass otomatis di dalam mesin;
- mengakhiri sesi saat kartu habis;
- mengembalikan state baru dan daftar event setiap kali aksi diterapkan.

Meja masih statis tanpa animasi:
- tiga kursi lawan di kiri, atas, dan kanan dengan pil info (nama, total poin, sisa kartu, label BOT, penanda giliran) dan punggung kartu;
- tangan pemain di bawah;
- rantai lurus sederhana di tengah.

Interaksi pemain:
- kartu legal tampil terang, kartu lain redup;
- mengetuk kartu memasangnya;
- jika kartu cocok di dua ujung, kedua ujung menyala untuk diketuk, dan pilihan bisa dibatalkan.

Bot sementara memilih langkah legal pertama. State meja baru diisi setelah `onInit` (lihat ADR 0001).

## Acceptance criteria

- [ ] Paket aturan bisa di-import tanpa dependensi browser. Uji Vitest berjalan lewat interface publik.
- [ ] Seed yang sama menghasilkan pembagian dan urutan event yang sama.
- [ ] Pembagian menghasilkan 28 kartu unik, 7 per kursi.
- [ ] Sesi pertama hanya bisa dibuka dengan 0–0 oleh pemegangnya.
- [ ] Aksi ilegal (salah giliran, kartu tidak cocok, kartu bukan milik kursi) ditolak dengan alasan, dan state tidak berubah.
- [ ] Kursi tanpa langkah legal otomatis pass dan menghasilkan event pass.
- [ ] Sesi berakhir saat seorang pemain menghabiskan kartunya, dan event menyebut pemenang sesi.
- [ ] Di browser, pemain bisa memainkan satu sesi penuh melawan tiga bot. Giliran berjalan searah jarum jam: bawah, kiri, atas, kanan.
- [ ] Kartu yang cocok di dua ujung meminta pilihan ujung, dan pilihan itu bisa dibatalkan.
- [ ] Pemain tidak bisa bertindak di luar gilirannya.

## Blocked by

None - can start immediately

## Comments

**2026-09-28 — keputusan setelah implementasi (commit b512bc0):**

- Jika kedua ujung susunan bernilai sama (misalnya setelah 0–0), kartu yang cocok tetap meminta pilihan ujung. Perilaku ini dipertahankan.
- Kartu tangan hanya diredupkan saat giliran pemain. Di giliran bot, semua kartu tampil terang.
- Nama tipe di kode tetap berbahasa Inggris, dengan pemetaan ke glosarium: `Card` = Kartu, `Seat` = Kursi, `End` = Ujung susunan, `Chain` = susunan/rantai. Istilah khas aturan (`balak`, `gaplek`) tetap dalam bahasa Indonesia.
