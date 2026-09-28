# 03 — Akhir game

Status: ready-for-agent
Blocked by: 02

## Parent

`.scratch/mode-offline/spec.md`

## What to build

**Game** berakhir setelah poin sesi dihitung dan ada pemain yang total poinnya mencapai atau melewati **Target poin**.

- **Hasil game:**
  - semua pemain yang mencapai atau melewati target dinyatakan **Kalah**;
  - pemain dengan total terendah di bawah target menjadi **Juara 1**, termasuk juara 1 bersama;
  - jika semua pemain kalah, tidak ada juara 1.
- **Layar hasil akhir** muncul langsung setelah sesi penutup, tanpa ringkasan sesi lebih dulu.
- **Dari layar hasil**, pemain bisa:
  - main lagi dengan target dan balak ganda yang bisa diubah; total poin kembali nol dan sesi pertama dibuka lagi dengan 0–0;
  - kembali ke menu.
- **Keluar dari game** yang sedang berjalan ke menu, setelah konfirmasi.

## Acceptance criteria

- [ ] Game berakhir saat total pemain mencapai atau melewati target, tidak harus tepat. Contoh: 92 + 14 = 106 dengan target 100.
- [ ] Contoh Anwar 20, Agus 20, Joko 105, Budi 112 (target 100) menghasilkan Anwar dan Agus juara 1 bersama, serta Joko dan Budi kalah.
- [ ] Jika keempat pemain kalah di sesi yang sama, tidak ada juara 1.
- [ ] Game baru mengembalikan total poin ke nol dan kembali memakai pembuka 0–0.
- [ ] Layar hasil menampilkan juara 1 dan kalah, dengan tombol main lagi dan kembali ke menu.
- [ ] Keluar dari game di tengah permainan meminta konfirmasi.

## Blocked by

- 02

## Comments

**2026-09-28 — keputusan setelah implementasi:**

- "Main lagi" kembali ke layar menu dengan target poin dan balak ganda tetap terisi nilai game sebelumnya (bisa diubah); "Kembali ke menu" kembali dengan nilai bawaan (100, mati). Keduanya membuka game baru lewat `startGame`, jadi total poin selalu nol dan sesi pertama selalu dibuka 0–0.
- Konfirmasi keluar di tengah game memakai `confirm()` bawaan browser, konsisten dengan skala aplikasi ini (tanpa modal kustom).
