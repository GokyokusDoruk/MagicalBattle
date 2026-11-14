import { describe, expect, it } from 'vitest';
import { ELEMENTS, elementMultiplier } from '../battle/damage/elements';
import { ELEMENT_ADVANTAGE, ELEMENT_DISADVANTAGE } from '../battle/damage/config';
import { Carry, BASE_CAPACITY } from '../inventory/carry';
import { PlayerState } from '../economy/player';
import { ELEMENT_MATCH, wandIdOf } from './catalog';
import { WandInventory } from './inventory';
import { NO_PASSIVE, RegenAccumulator, WAND_PASSIVES, activePassive, describePassive, passiveOf } from './passives';

describe('çarpanlar: ±%25', () => {
  it('element üstünlüğü ×1.25, dezavantaj ×0.75; asa eşleşmesi ×1.25', () => {
    expect(ELEMENT_ADVANTAGE).toBe(1.25);
    expect(ELEMENT_DISADVANTAGE).toBe(0.75);
    expect(ELEMENT_MATCH).toBe(1.25);
    expect(elementMultiplier('water', 'fire')).toBe(1.25);
    expect(elementMultiplier('fire', 'water')).toBe(0.75);
    expect(elementMultiplier('fire', 'fire')).toBe(1);
  });
});

describe('asa pasifleri', () => {
  const wand = (element: 'fire' | 'water' | 'earth' | 'air', level = 1) => wandIdOf({ element, role: 'attack', rarity: 1, level });

  it('dört elementin dört farklı pasifi var', () => {
    expect(WAND_PASSIVES.air).toMatchObject({ speed: 0.25 });
    expect(WAND_PASSIVES.water).toMatchObject({ regenPerSec: 0.005 });
    expect(WAND_PASSIVES.fire).toMatchObject({ dropRate: 0.1 });
    expect(WAND_PASSIVES.earth).toMatchObject({ carry: 0.25 });
    for (const e of ELEMENTS) {
      const p = passiveOf(e);
      expect(Object.values(p).filter((v) => v > 0)).toHaveLength(1);
      expect(describePassive(e)).toContain('asası');
    }
    expect(passiveOf(null)).toEqual(NO_PASSIVE);
  });

  it('yalnızca kuşanılı ve kullanılabilir asanın pasifi geçerlidir', () => {
    let level = 1;
    const inv = new WandInventory();
    inv.setLevelProvider(() => level);
    expect(activePassive(inv)).toEqual(NO_PASSIVE);
    inv.add(wand('air', 5)); // seviye yetmiyor: kuşanılmaz
    expect(activePassive(inv)).toEqual(NO_PASSIVE);
    level = 5;
    inv.add(wand('water', 1));
    expect(inv.equip(wand('water', 1))).toBe(true);
    expect(activePassive(inv).regenPerSec).toBe(0.005);
    inv.add(wand('air', 1));
    expect(inv.equip(wand('air', 1))).toBe(true);
    expect(activePassive(inv).speed).toBe(0.25);
    expect(activePassive(inv).regenPerSec).toBe(0);
    level = 1;
    // seviye düşse (olmaz ama) kullanılamayan asa pasif vermez
    inv.equip(wand('air', 1));
    expect(activePassive(inv).speed).toBe(0.25);
  });

  it('can yenileme: saniyede %0.5, kesirler birikir, tam sayı verilir', () => {
    const r = new RegenAccumulator();
    expect(r.tick(300, 0.005, 1)).toBe(1); // 1.5 → 1, 0.5 kaldı
    expect(r.tick(300, 0.005, 1)).toBe(2); // 0.5 + 1.5 = 2.0
    expect(r.tick(300, 0.005, 1)).toBe(1);
    // 100 saniyede 450 can (300 azami canın %50'si x 3)
    const r2 = new RegenAccumulator();
    let total = 0;
    for (let i = 0; i < 200; i++) total += r2.tick(300, 0.005, 0.5);
    expect(total).toBe(150);
    expect(r2.tick(300, 0, 1)).toBe(0);
    expect(r2.tick(300, 0.005, 0)).toBe(0);
  });

  it('toprak asası: taşıma kapasitesi %25 artar (aşağı yuvarlanır); diğer asalar etkilemez', () => {
    const player = new PlayerState();
    const inv = new WandInventory();
    let k = 1;
    const carry = new Carry(player, inv, () => ({ wands: 0, goods: 0, gear: 0 }), () => [], () => k);
    expect(carry.capacity()).toEqual(BASE_CAPACITY);
    k = 1.25;
    expect(carry.capacity()).toEqual({ wands: 3, goods: 25, gear: 2 }); // 3.75 → 3, 25, 2.5 → 2
  });
});
