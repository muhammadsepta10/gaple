# 06 — Deploy ke VPS dan uji bersama teman di HP asli

Status: ready-for-human
Blocked by: 04, 05

## Parent

`.scratch/mode-online/spec.md`

## What to build

Mode online dipasang di VPS lalu dicoba oleh kelompok aslinya.

- **Hosting:** satu VPS kecil (sekitar 1 vCPU / 1 GB) di region Singapura atau Jakarta. Docker Compose berisi server Node (yang juga menyajikan aplikasi web statis, satu origin, rute `/r/<kode>`) dan Redis dengan volume persisten serta AOF. Caddy menangani TLS dan WebSocket.
- Agen bisa menyiapkan Docker Compose, Caddyfile, dan petunjuk deploy. **Manusia** menyediakan VPS dan domain, lalu menjalankan deploy pertama.
- **Uji bersama teman:** pengguna dan tiga temannya bermain minimal satu game penuh dari HP dan laptop masing-masing lewat jaringan rumah. Selama sesi, sengaja lakukan: refresh, pindah ke WhatsApp, putus Wi-Fi, satu orang diam sampai diambil bot, satu penonton masuk, dan satu kali deploy ulang server. Catat temuan (latensi terasa, animasi tertinggal, kebingungan UI) untuk dijadikan issue lanjutan.

## Acceptance criteria

- [ ] Situs online dapat diakses lewat HTTPS di domain pengguna, dan mode offline tetap dapat dipasang sebagai PWA.
- [ ] Redis berjalan dengan AOF dan volume persisten. Restart container Redis tidak menghapus ruang.
- [ ] Endpoint jumlah ruang aktif dapat dicek sebelum perawatan.
- [ ] Satu game penuh dimainkan empat orang sungguhan dengan semua gangguan di atas, tanpa game rusak.
- [ ] Temuan uji dicatat di bagian Comments tiket ini, dan temuan yang perlu diperbaiki dibuat sebagai issue baru.

## Blocked by

- `04-penonton-batas-penyalahgunaan.md`
- `05-keandalan-redis-versi-protokol.md`
