import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BigEffect } from '../src/meja/efek';

vi.mock('@pixi/react', () => ({ useTick: vi.fn() }));

describe('teks efek kemenangan', () => {
  it.each([
    [0, 'Kamu Menang!'],
    [1, 'Budi Menang!'],
  ])('menampilkan nama pemain kursi %i yang menghabiskan kartu', (seat, expected) => {
    const markup = renderToStaticMarkup(
      <BigEffect event={{ kind: 'win', key: 1, at: 0, seat }} seatNames={['Kamu', 'Budi', 'Agus', 'Joko']} w={844} h={390} />,
    );

    expect(markup).toContain(`text="${expected}"`);
  });
});
