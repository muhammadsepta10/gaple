# Verifikasi agent-browser — tiket 04 (penonton)

Dijalankan agen dengan `/agent-browser`, bukan Playwright. Setiap orang memakai sesi browser terpisah (`--session <nama>`), sehingga token di `localStorage` berbeda.

## Persiapan

```bash
pnpm dev:server   # Colyseus di :2567
pnpm dev          # Vite; klien dev tersambung ke <host>:2567
```

## Skenario — penonton masuk di tengah game

1. **Host** membuat ruang dan memulai game (tiga bot).
2. **Penonton** membuka `/r/<kode>`, mengisi nama, lalu menekan **Gabung**.
3. Yang diharapkan: penonton langsung melihat meja dengan label "Kamu menonton", susunan kartu dan skor yang sama dengan host, dan semua kursi (termasuk kursi bawah) sebagai punggung kartu. Tidak ada kipas tangan dan tidak ada langkah legal.
4. Host memasang kartu. Meja penonton mengikuti tanpa reload.

## Hasil

Dijalankan 2026-09-28 (Chromium via agent-browser, viewport 1280×720).

- **Lulus.** Penonton "Sari" masuk ke ruang yang sedang bermain dan melihat meja dengan label "Kamu menonton", susunan, pil skor keempat kursi, dan hanya punggung kartu (7 di bawah untuk Budi). Jumlah tombol langkah legal di halaman penonton 0, dan teks halaman hanya berisi "Kamu menonton", tombol suara, dan "Keluar".
- Setelah host memasang kartu, susunan dan jumlah kartu di layar penonton sama persis dengan layar host (Budi 5, Bot 2 4, Bot 3 4, Bot 4 3).
- Catatan: label pertama kali menabrak punggung kartu kursi atas, lalu digeser ke `top: 64`. Halaman yang terkena HMR saat file diedit berhenti menerima pesan sampai di-reload; ini artefak dev server, bukan perilaku produksi.
- **Tidak diverifikasi di browser** (sudah dites di paket ruang dan server): penonton ke-9 ditolak "ruang penuh", dan penonton duduk di kursi bot setelah game selesai.
