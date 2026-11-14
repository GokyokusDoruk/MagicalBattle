import { describe, expect, it } from 'vitest';
import type { DamageBreakdown } from './calculate';
import { explainDamage, spellEffect } from './explain';

const base: DamageBreakdown = {
  powerFactor: { size: 1, effort: 1, total: 1 },
  power: 100,
  defendedRatio: 0,
  unblockedRatio: 1,
  headShare: 0,
  weightedUnblockedRatio: 1,
  afterRegion: 100,
  elementRelation: 'advantage',
  elementMultiplier: 1.5,
  afterElement: 150,
  skillMultiplier: 1,
  afterSkills: 150,
  critical: false,
  critMultiplier: 1,
  afterCrit: 150,
  armorReduction: 0,
  afterArmor: 150,
  finalDamage: 150,
};

describe('hasar açıklaması', () => {
  it('100 gücün üstün elementle 150 olduğunu gösterir', () => {
    const rows = explainDamage(base, 'earth', false);
    expect(rows.find((r) => r.element)).toMatchObject({ label: 'Toprak üstün', factor: '×1.5', value: 150 });
    expect(rows[0]).toMatchObject({ label: 'Büyü gücü', value: 100 });
  });

  it('etkisiz adımları atlar, zırhı ve zayıf elementi yazar', () => {
    const rows = explainDamage({ ...base, elementMultiplier: 0.5, afterElement: 50, afterSkills: 50, armorReduction: 0.2, afterArmor: 40, finalDamage: 40 }, 'water', true);
    expect(rows.map((r) => r.label)).toEqual(['Büyü gücü', 'Su zayıf', 'Zırh']);
    expect(rows.at(-1)).toMatchObject({ factor: '−%20', value: 40 });
  });

  it('savunmayı geçen oranı ve baş vuruşunu gösterir', () => {
    const rows = explainDamage({ ...base, unblockedRatio: 0.5, weightedUnblockedRatio: 0.75, headShare: 1, afterRegion: 75, elementMultiplier: 1, afterElement: 75 }, 'fire', false);
    expect(rows.map((r) => r.label)).toEqual(['Büyü gücü', 'Savunmayı geçen', 'Baş vuruşu']);
    expect(rows[1]).toMatchObject({ factor: '%50', value: 50 });
    expect(rows[2]).toMatchObject({ factor: '×1.5', value: 75 });
  });
});

describe('büyü etkisi', () => {
  it('savunmayı çok geçen etkili, yarı yarıya orta, iyi bloklanan etkisiz', () => {
    expect(spellEffect({ unblockedRatio: 0.9 }, false)).toBe('effective');
    expect(spellEffect({ unblockedRatio: 0.45 }, false)).toBe('medium');
    expect(spellEffect({ unblockedRatio: 0.1 }, false)).toBe('weak');
  });

  it('savunma yapılamadıysa her zaman etkilidir', () => {
    expect(spellEffect({ unblockedRatio: 0 }, true)).toBe('effective');
  });
});
