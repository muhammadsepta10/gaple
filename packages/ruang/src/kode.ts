/** Huruf besar dan angka tanpa 0 O 1 I L agar mudah didiktekan. */
const ABJAD = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PANJANG = 6;

/**
 * Kode undangan acak yang belum `dipakai`. `acak` menghasilkan angka di [0, 1);
 * adaptor menyuntikkan sumber acak dan pengecekan bentrok.
 */
export function buatKodeUndangan(acak: () => number, dipakai: (kode: string) => boolean): string {
  for (;;) {
    const kode = Array.from({ length: PANJANG }, () => ABJAD[Math.floor(acak() * ABJAD.length)]).join('');
    if (!dipakai(kode)) return kode;
  }
}

/** Input manual tidak peka huruf besar-kecil; spasi dan tanda hubung diabaikan. `null` jika bentuknya salah. */
export function normalisasiKode(input: string): string | null {
  const kode = input.replace(/[\s-]/g, '').toUpperCase();
  return kode.length === PANJANG && [...kode].every((c) => ABJAD.includes(c)) ? kode : null;
}
