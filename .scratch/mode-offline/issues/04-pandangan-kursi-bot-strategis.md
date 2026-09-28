# 04 — Pandangan kursi dan bot strategis

Status: done
Blocked by: 02

## Parent

`.scratch/mode-offline/spec.md`

## What to build

- **Pandangan per kursi:** mesin aturan menghasilkan pandangan untuk satu kursi (tangan sendiri, rantai, kedua ujung, jumlah sisa kartu lawan, total poin, riwayat publik), tanpa tangan lawan. Ada juga pandangan penonton tanpa tangan siapa pun, untuk tahap 2.
- **Bot:** fungsi murni yang hanya menerima pandangan kursi dan mengembalikan satu langkah legal.
- **Strategi bot** (lihat spec, Modul 2):
  - utamakan membuang kartu bernilai besar, dengan balak sedikit diprioritaskan;
  - pertahankan angka yang masih banyak dipegang, termasuk saat memilih ujung jika kartu cocok di dua ujung;
  - tie-break deterministik.
- Bot naif dari tiket 01 diganti dengan bot ini di game offline.

## Acceptance criteria

- [ ] Pandangan kursi tidak memuat kartu tangan kursi lain. Pandangan penonton tidak memuat tangan siapa pun.
- [ ] Bot tidak bisa mengakses state penuh; interface-nya hanya menerima pandangan.
- [ ] Pada situasi yang disusun, bot membuang kartu dengan nilai terbesar di antara langkah legal.
- [ ] Pada situasi yang disusun, bot memilih ujung yang menyisakan angka terbanyak di tangannya.
- [ ] Uji properti (disarankan `fast-check`): game acak yang dimainkan empat bot selalu berakhir, jumlah kartu selalu 28, bot selalu memilih langkah legal, dan total poin tidak pernah turun.
- [ ] Game offline di browser memakai bot strategis ini.

## Blocked by

- 02
