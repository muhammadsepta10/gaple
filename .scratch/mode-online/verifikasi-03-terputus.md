# Verifikasi agent-browser — tiket 03 (terputus, kembali, bot pengganti)

Dijalankan agen dengan `/agent-browser`, bukan Playwright. Setiap orang memakai sesi browser terpisah (`--session <nama>`), sehingga token di `localStorage` berbeda. Menutup sesi (`close`) membuang profilnya, jadi sesi yang dibuka lagi adalah orang baru; untuk "kembali" pakai `reload` atau tab baru di sesi yang sama.

## Persiapan

```bash
pnpm dev:server   # Colyseus di :2567
pnpm dev          # Vite; klien dev tersambung ke <host>:2567
```

## Skenario A — penanda Terputus di lobi

1. **Host** membuat ruang, **teman** bergabung lewat tautan.
2. Tutup browser teman (`close`). Lobi host menampilkan "Terputus" di kursi Agus, dan kursinya tetap milik Agus.

## Skenario B — refresh di tengah ronde

1. Host memulai game (dua bot). Host memasang satu kartu.
2. Screenshot meja teman, lalu `reload` tab teman.
3. Yang diharapkan: tanpa form nama, teman langsung kembali ke meja dengan kursi, kartu tangan, susunan, dan total poin yang sama.

## Skenario C — tab kedua

1. Teman membuka `/r/<kode>` di tab baru pada sesi yang sama.
2. Tab baru memegang kendali (langkah legal tersedia pada gilirannya). Tab lama menampilkan "Ruang ini dibuka di tab atau jendela lain…" dengan tombol **Pakai di tab ini** dan **Ke menu**.

## Skenario D — ambil alih bot dan ambil kendali

1. Pada giliran teman, jangan bertindak selama 5 menit.
2. Yang diharapkan: tab teman menampilkan "Bot memainkan kursimu" dengan tombol **Ambil kendali**, pil kursi teman di meja host bertanda BOT, dan bot memasang kartu atas nama teman.
3. Teman menekan **Ambil kendali**: banner hilang dan pada gilirannya langkah legal tersedia lagi.

## Hasil

Dijalankan 2026-09-28 (Chromium via agent-browser, viewport 1280×720).

- **Skenario A: lulus.** Setelah browser teman ditutup, lobi host menampilkan "Agus Terputus" dan kursi 2 tetap milik Agus. Catatan: `open about:blank` di agent-browser tidak menutup WebSocket, jadi pakai `close`.
- **Skenario B: lulus.** Setelah `reload`, teman langsung kembali ke meja tanpa form nama. Screenshot sebelum dan sesudah identik: kursi kiri bawah, tujuh kartu yang sama, kartu di susunan, dan total poin.
- **Skenario C: lulus.** Tab baru memegang kendali (4 langkah legal pada gilirannya), tab lama menampilkan pemberitahuan dengan **Pakai di tab ini** / **Ke menu**.
- **Skenario D: lulus.** Setelah 5 menit, tab teman menampilkan "Bot memainkan kursimu · Ambil kendali", meja host menandai Agus BOT, dan bot memasang kartu atas nama Agus (7 → 6 kartu). **Ambil kendali** menghilangkan banner. Setelah browser teman ditutup, pil Agus di meja host bertanda PUTUS.
- **Belum diverifikasi di browser:** indikator "menyambung ulang…" saat jaringan putus sesaat (hanya lewat kode dan tes integrasi server, karena menutup socket dari sisi server tanpa kehilangan ruang baru tersedia di tiket 05).
