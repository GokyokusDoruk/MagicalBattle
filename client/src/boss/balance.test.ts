import { describe, expect, it } from 'vitest';
import { ELEMENTS } from '../battle/damage/elements';
import { TIERS, TIER_LEVEL } from '../enemies/catalog';
import { BOSSES } from './bosses';
import { simulateBoss, simulateEnemy, typicalKit } from './simulate';

/**
 * Denge turu (Task 46): yetenekli tipik oyuncu (beceri 0.6 vekili, seviyeye göre kit ve yetenek dağılımı) karşısında hedefler.
 * Aralıklar bilerek geniştir (tohumlu ama 30 koşuluk örnek); amaç dengenin kayıp gitmesini yakalamaktır.
 */
const SKILL = 0.6;

describe('denge turu: dünya düşmanları (yetenekli oyuncu, kademe seviyesinde)', () => {
  const RUNS = 25;
  // [en az kazanma, en çok kazanma, en az kayıp can, en çok kayıp can]
  const TARGET: Record<number, [number, number, number, number]> = {
    1: [0.88, 1, 0.08, 0.4],
    2: [0.85, 1, 0.2, 0.55],
    3: [0.72, 0.99, 0.4, 0.75],
    4: [0.6, 0.95, 0.5, 0.85],
  };

  for (const tier of TIERS) {
    it(`kademe ${tier}: kazanma ve can kaybı hedef aralıkta`, async () => {
      let wins = 0;
      let loss = 0;
      let n = 0;
      for (const el of ELEMENTS) {
        for (let i = 0; i < RUNS; i++) {
          const r = await simulateEnemy(el, tier, typicalKit(TIER_LEVEL[tier], { skills: true }), { playerSkill: SKILL, seed: 2000 + i * 11 });
          if (r.won) wins++;
          loss += (r.maxHp - r.hpLeft) / r.maxHp;
          n++;
        }
      }
      const [wMin, wMax, lMin, lMax] = TARGET[tier];
      expect(wins / n).toBeGreaterThanOrEqual(wMin);
      expect(wins / n).toBeLessThanOrEqual(wMax);
      expect(loss / n).toBeGreaterThanOrEqual(lMin);
      expect(loss / n).toBeLessThanOrEqual(lMax);
    }, 120000);
  }

  it('kademe yükseldikçe daha çok can kaybedilir', async () => {
    const losses: number[] = [];
    for (const tier of TIERS) {
      let loss = 0;
      for (let i = 0; i < 20; i++) {
        const r = await simulateEnemy('fire', tier, typicalKit(TIER_LEVEL[tier], { skills: true }), { playerSkill: SKILL, seed: 3000 + i * 13 });
        loss += (r.maxHp - r.hpLeft) / r.maxHp;
      }
      losses.push(loss / 20);
    }
    for (let i = 1; i < losses.length; i++) expect(losses[i]).toBeGreaterThan(losses[i - 1]);
  }, 120000);
});

describe('denge turu: bosslar (yetenekli oyuncu, hedef seviyede)', () => {
  const RUNS = 40;
  const TARGET: Record<number, [number, number]> = {
    1: [0.75, 0.99],
    2: [0.6, 0.95],
    3: [0.55, 0.95],
    4: [0.5, 0.9],
    5: [0.35, 0.8],
    6: [0.35, 0.9],
    7: [0.45, 0.9],
    8: [0.35, 0.8],
  };

  for (const boss of BOSSES) {
    it(`bölüm ${boss.chapter}: hedef seviyede yenilebilir ama kolay değil`, async () => {
      let wins = 0;
      for (let i = 0; i < RUNS; i++) {
        if ((await simulateBoss(boss.chapter, typicalKit(boss.targetLevel, { skills: true }), { playerSkill: SKILL, seed: 1000 + i * 7 })).won) wins++;
      }
      const [min, max] = TARGET[boss.chapter];
      expect(wins / RUNS).toBeGreaterThanOrEqual(min);
      expect(wins / RUNS).toBeLessThanOrEqual(max);
    }, 120000);
  }

  it('yetenekler gerçekten güç katar: yeteneksiz oyuncu hedef seviyede yetenekli olandan az kazanır (5-8. bölüm)', async () => {
    for (const ch of [5, 7, 8]) {
      const boss = BOSSES.find((b) => b.chapter === ch)!;
      let plain = 0;
      let skilled = 0;
      for (let i = 0; i < 30; i++) {
        const seed = 1000 + i * 7;
        if ((await simulateBoss(ch, typicalKit(boss.targetLevel), { playerSkill: SKILL, seed })).won) plain++;
        if ((await simulateBoss(ch, typicalKit(boss.targetLevel, { skills: true }), { playerSkill: SKILL, seed })).won) skilled++;
      }
      expect(skilled, `bölüm ${ch}`).toBeGreaterThan(plain);
    }
  }, 240000);
});
