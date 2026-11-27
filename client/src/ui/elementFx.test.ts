import { describe, expect, it } from 'vitest';
import { ElementParticles, QUADRANTS } from './elementFx';

describe('element görselleri (Faz 4)', () => {
  it('seçim ekranı dörde bölünür: ateş, su, toprak, hava (her element bir kez)', () => {
    expect(QUADRANTS).toEqual(['fire', 'water', 'earth', 'air']);
  });

  it('parçacık sayısı sınırı aşmaz (telefon yavaşlamasın)', () => {
    const fx = new ElementParticles(50);
    for (const el of QUADRANTS) fx.emit(el, 10, 10, 40);
    expect(fx.count).toBe(50);
  });
});
