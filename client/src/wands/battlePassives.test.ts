import { describe, expect, it } from 'vitest';
import { WAND_PASSIVE_LEVEL_STEPS, passiveTierForWandLevel } from '../skills/catalog';
import { WandInventory } from './inventory';
import { makeWand } from './catalog';
import { wandBattlePassives, wandPassiveSteps } from './passives';
import { SkillTree } from '../skills/tree';

const invWith = (playerLevel: number, element: 'fire' | 'air' | 'water' | 'earth', wandLevel: number): WandInventory => {
  const inv = new WandInventory();
  inv.setLevelProvider(() => playerLevel);
  const w = makeWand({ element, role: 'attack', rarity: 2, level: wandLevel });
  inv.add(w.id, 1);
  inv.equip(w.id);
  return inv;
};

describe('asa seviyesine bağlı savaş pasifleri', () => {
  it('kademe asa seviyesinden gelir: 1-9 → 1, 10-19 → 2, 20+ → 3', () => {
    expect(WAND_PASSIVE_LEVEL_STEPS).toEqual([1, 10, 20]);
    expect([1, 5, 9].map(passiveTierForWandLevel)).toEqual([1, 1, 1]);
    expect([10, 15, 19].map(passiveTierForWandLevel)).toEqual([2, 2, 2]);
    expect([20, 25, 30].map(passiveTierForWandLevel)).toEqual([3, 3, 3]);
    expect(wandPassiveSteps().map((s) => s.tier)).toEqual([1, 2, 3]);
    expect(wandPassiveSteps()[0]).toMatchObject({ from: 1, to: 9 });
    expect(wandPassiveSteps()[2]).toMatchObject({ from: 20, to: null });
  });

  it('ateş asası Yanık İzi, hava asası Sarsıntılı Rüzgâr verir; asa seviyesi arttıkça şiddet artar', () => {
    expect(wandBattlePassives(invWith(30, 'fire', 3))).toEqual({ scars: 1, shake: 0 });
    expect(wandBattlePassives(invWith(30, 'fire', 12))).toEqual({ scars: 2, shake: 0 });
    expect(wandBattlePassives(invWith(30, 'fire', 25))).toEqual({ scars: 3, shake: 0 });
    expect(wandBattlePassives(invWith(30, 'air', 10))).toEqual({ scars: 0, shake: 2 });
    expect(wandBattlePassives(invWith(30, 'air', 20))).toEqual({ scars: 0, shake: 3 });
  });

  it('su ve toprak asası savaş pasifi vermez; asa yoksa ya da seviye yetmiyorsa pasif yok', () => {
    expect(wandBattlePassives(invWith(30, 'water', 20))).toEqual({ scars: 0, shake: 0 });
    expect(wandBattlePassives(invWith(30, 'earth', 20))).toEqual({ scars: 0, shake: 0 });
    expect(wandBattlePassives(new WandInventory())).toEqual({ scars: 0, shake: 0 });
    const inv = invWith(1, 'fire', 15); // oyuncu 1. seviye, asa 15: kuşanılamaz
    expect(wandBattlePassives(inv)).toEqual({ scars: 0, shake: 0 });
  });

  it('yetenek ağacı bu pasifleri vermez ve puan harcatmaz', () => {
    const tree = new SkillTree(() => 30);
    expect(tree.learn('fire-scars')).toBe(false);
    expect(tree.learn('air-tremor')).toBe(false);
    expect(tree.pointsSpent).toBe(0);
    expect(tree.passives).toEqual({ scars: 0, shake: 0 });
    // eski kayıttaki seviyeler yok sayılır, puan iade olur
    tree.restore(['fire-scars-3', 'air-tremor-2', 'fire-burn-1']);
    expect(tree.snapshot()).toEqual(['fire-burn-1']);
    expect(tree.pointsSpent).toBe(1);
  });
});
