import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HasilAkhir } from '../src/hasilAkhir';

const seats = [
  { name: 'Kamu', bot: false },
  { name: 'Budi', bot: true },
  { name: 'Agus', bot: true },
  { name: 'Joko', bot: true },
];

function rows(markup: string) {
  return [...markup.matchAll(/<li\b[^>]*data-seat="(\d)"[^>]*>(.*?)<\/li>/g)]
    .map((match) => ({ seat: Number(match[1]), html: match[2]! }));
}

describe('skor akhir', () => {
  it('mengurutkan dari juara sampai kalah dan menandai hanya juara yang tepat', () => {
    const markup = renderToStaticMarkup(<HasilAkhir
      result={{ champions: [2], losers: [1] }} totals={[55, 120, 25, 74]} seats={seats}
      onPlayAgain={() => {}} onBackToMenu={() => {}} />);
    const ranked = rows(markup);

    expect(ranked.map((row) => row.seat)).toEqual([2, 0, 3, 1]);
    expect(ranked[0]!.html).toContain('Juara 1');
    expect(ranked[0]!.html).toContain('25 poin');
    expect(ranked.slice(1).every((row) => !row.html.includes('Juara 1'))).toBe(true);
    expect(ranked[3]!.html).toContain('Kalah');
    expect(ranked[3]!.html).toContain('120 poin');
  });

  it('menampilkan seluruh juara bersama sebelum pemain kalah', () => {
    const markup = renderToStaticMarkup(<HasilAkhir
      result={{ champions: [0, 2], losers: [1, 3] }} totals={[20, 112, 20, 105]} seats={seats}
      onPlayAgain={() => {}} onBackToMenu={() => {}} />);
    const ranked = rows(markup);

    expect(ranked.map((row) => row.seat)).toEqual([0, 2, 3, 1]);
    expect(ranked.filter((row) => row.html.includes('Juara 1')).map((row) => row.seat)).toEqual([0, 2]);
  });

  it('tidak menampilkan juara jika semua pemain kalah', () => {
    const markup = renderToStaticMarkup(<HasilAkhir
      result={{ champions: [], losers: [0, 1, 2, 3] }} totals={[110, 100, 130, 120]} seats={seats}
      onPlayAgain={() => {}} onBackToMenu={() => {}} />);
    const ranked = rows(markup);

    expect(ranked.map((row) => row.seat)).toEqual([1, 0, 3, 2]);
    expect(ranked.every((row) => row.html.includes('Kalah') && !row.html.includes('Juara 1'))).toBe(true);
    expect(markup).toContain('Semua pemain kalah');
  });
});
