import { describe, expect, it } from 'vitest';
import { enemyStats } from './catalog';
import { CHEST_SPOTS } from './chests';
import { DROP_CHANCE, difficultyMultiplier, rollLoot } from './loot';
import { dropOdds, enemyLootHint, chestLootHint, mineLootHint } from './lootPreview';
import { mulberry32 } from '../world/rng';

describe('ganimet önizlemesi', () => {
  it('para ve XP, gerçek ganimetle aynı (zorluk çarpanı dahil)', () => {
    for (const tier of [1, 2, 3, 4] as const) {
      const o = dropOdds('fire', tier, 5, 1);
      const real = rollLoot('fire', tier, 5, 1, mulberry32(1));
      expect(o.money).toBe(real.money);
      expect(o.xp).toBe(real.xp);
    }
  });

  it('şanslar temel şans × zorluk × düşme oranı; %100 üstüne çıkmaz', () => {
    const s = enemyStats('water', 2);
    const diff = difficultyMultiplier(s.level, 5);
    const o = dropOdds('water', 2, 5, 1);
    expect(o.gear).toBeCloseTo(Math.min(1, DROP_CHANCE.gear * diff), 8);
    expect(o.wand).toBeCloseTo(Math.min(1, DROP_CHANCE.wand * diff), 8);
    expect(dropOdds('water', 2, 5, 100).goods).toBe(1);
    expect(dropOdds('water', 2, 5, 1, 1.5).gear).toBeGreaterThan(o.gear);
  });

  it('metinlerde para birimi ve yüzdeler yazar', () => {
    const t = enemyLootHint('earth', 3, 9, 1, 'Tunç');
    expect(t).toMatch(/^Kazanırsan: \d+ Tunç, \d+ XP · ticari mal %\d+ · ekipman %\d+ · asa %\d+$/);
    const mine = mineLootHint(
      [1, 2, 3].map((i) => ({ id: `m${i}`, element: 'fire' as const, tier: 2 as const, tileX: 0, tileY: 0 })),
      5,
      1,
      'Kor',
    );
    expect(mine).toContain('Üç zaferin toplamı');
    expect(mine).toContain('Kor');
    const chest = chestLootHint(CHEST_SPOTS[0], 1, 'Çiy');
    expect(chest).toContain('kesin 1 ekipman');
    expect(chest).toContain('asa %50');
  });
});
