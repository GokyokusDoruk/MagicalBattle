import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../economy/items';
import { getWand } from '../../wands/catalog';
import { heroGearFrom } from './heroGear';

describe('heroGearFrom', () => {
  it('kuşanılan hiçbir şey yoksa boş görünüm', () => {
    expect(heroGearFrom({}, null)).toEqual({});
  });

  it('elementli kıyafet ve asa görünüme geçer', () => {
    const robe = ITEMS.find((i) => i.slot === 'robe' && i.element && i.rarity);
    const wand = getWand('wand-water-defense-5-3')!;
    expect(robe).toBeDefined();
    const gear = heroGearFrom({ robe: robe!.id }, 'wand-water-defense-5-3');
    expect(gear.robe).toEqual({ element: robe!.element, rarity: robe!.rarity });
    expect(gear.wand).toEqual({ element: wand.element, rarity: wand.rarity });
    expect(gear.hat).toBeUndefined();
  });

  it('bilinmeyen kimlikler yok sayılır', () => {
    expect(heroGearFrom({ hat: 'yok-boyle-bir-sey' }, 'yok-asa')).toEqual({});
  });
});
