# 06 — Animasi, efek besar, dan audio

Status: ready-for-agent
Blocked by: 03, 05

## Parent

`.scratch/mode-offline/spec.md`

## What to build

Pengendali offline (lihat spec, Modul 4) menjadwalkan event dari mesin ke presentasi dengan jeda yang benar, dan input pemain dikunci selama animasi berjalan. Animasi dan suara mengikuti tabel di spec (preset "dramatis ×1,4"). Semua durasi disimpan sebagai konstanta di satu tempat.

- **Animasi dasar:**
  - pembagian kartu dari tengah meja ke tiap kursi;
  - kartu terbang ke ujung rantai; kartu lawan terbalik selama terbang;
  - gelembung "Nama pass";
  - jeda berpikir bot 770 ms, ditambah durasi efek besar sebelumnya.
- **Efek besar:** balak, menang sesi, gaplek, dan juara 1, termasuk getar layar.
- **Teknik** (temuan prototype):
  - tween berjalan di `useTick` dan menulis langsung ke objek Pixi lewat ref;
  - satu kartu = satu komponen dengan key tetap.
- **Audio** (lihat spec, Modul 6):
  - aset Kenney .m4a yang terpilih (beserta lisensinya) dipindahkan dari `.scratch/prototype-meja/public/sfx/`;
  - suara sintetis dibuat dengan Web Audio;
  - `AudioContext` dibuka setelah ketukan pertama;
  - suara diputar saat kartu mendarat atau efek dimulai;
  - mute disimpan di `localStorage` (dibungkus try/catch);
  - tidak ada musik latar.

## Acceptance criteria

- [ ] Durasi dan gaya setiap kejadian sesuai tabel animasi di spec.
- [ ] Kartu berpindah dari tangan atau kursi lawan ke rantai sebagai objek yang sama, tanpa kedipan.
- [ ] Input pemain diabaikan selama animasi dan saat bukan gilirannya.
- [ ] Efek besar muncul untuk balak dipasang, kartu terakhir menang sesi, gaplek, dan juara 1.
- [ ] Setiap momen memutar suara sesuai pemetaan di spec, tepat saat kartu mendarat atau efek dimulai.
- [ ] Tidak ada error audio sebelum interaksi pertama.
- [ ] Mute bertahan setelah reload, dan aplikasi tetap berjalan jika `localStorage` tidak tersedia.
- [ ] Animasi mulus di laptop, sekitar 60 fps.

## Blocked by

- 03
- 05
