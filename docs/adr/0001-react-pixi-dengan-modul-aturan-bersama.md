# React + @pixi/react dengan modul aturan TypeScript bersama

Game harus berjalan di browser (laptop sampai HP), punya animasi ala Yu-Gi-Oh, tetap terasa cepat dengan loading minimal, bisa dimainkan offline, dan nantinya online. Kami memilih TypeScript di seluruh bagian: aturan permainan dan bot sebagai modul murni tanpa UI yang dipakai bersama oleh browser (mode offline) dan server Node.js + Colyseus (mode online), UI dengan React, serta meja dan animasi dengan PixiJS melalui @pixi/react, dikemas sebagai PWA.

## Considered Options

- **React + PixiJS terpisah**: efek kuat, tetapi ada dua cara menggambar UI. @pixi/react menyatukannya dalam komponen React.
- **Phaser**: satu framework untuk semua, tetapi form (nama panggilan, kode undangan) tetap butuh HTML dan layout responsif harus diatur manual.
- **Godot (export web)**: animasi paling mudah, tetapi ukuran awal puluhan MB bertentangan dengan kebutuhan loading minimal, dan GDScript membuat modul aturan tidak bisa dipakai bersama server Node.
- **React + animasi CSS/GSAP saja**: paling sederhana, tetapi efek besar (kilau, getar layar) lebih terbatas.

## Catatan implementasi

- `<Application>` dari @pixi/react disiapkan secara async. Perubahan state sebelum kanvas siap tidak ikut tergambar, jadi state meja baru diisi setelah `onInit`. Temuan prototype: `.scratch/prototype-meja/HASIL.md`.
