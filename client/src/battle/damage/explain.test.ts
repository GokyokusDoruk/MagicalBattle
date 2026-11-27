import { describe, expect, it } from 'vitest';
import type { DamageBreakdown } from './calculate';
import { EFFECT_LABELS, blockedPercent, damageRatio, explainDamage, spellEffect } from './explain';

const base: DamageBreakdown = {
  powerFactor: { size: 1, effort: 1, total: 1 },
  power: 100,
  defendedRatio: 0,
  defenseBypass: 0,
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
  multiplierParts: [],
  attackQuality: 1,
  powerBeforeQuality: 100,
  defenseStrength: 1,
};

describe('hasar açıklaması', () => {
  it('100 gücün üstün elementle 150 olduğunu gösterir', () => {
    const rows = explainDamage(base, 'earth', false);
    expect(rows.find((r) => r.element)).toMatchObject({ label: 'Toprak üstün', factor: '×1.5', value: 150 });
    expect(rows[0]).toMatchObject({ label: 'Büyü gücü (alan ve süre)', value: 100 });
  });

  it('etkisiz adımları atlar, zırhı ve zayıf elementi yazar', () => {
    const rows = explainDamage({ ...base, elementMultiplier: 0.5, afterElement: 50, afterSkills: 50, armorReduction: 0.2, afterArmor: 40, finalDamage: 40 }, 'water', true);
    expect(rows.map((r) => r.label)).toEqual(['Büyü gücü (alan ve süre)', 'Su zayıf', 'Zırh']);
    expect(rows.at(-1)).toMatchObject({ factor: '−%20', value: 40 });
  });

  it('savunmayı geçen oranı ve baş vuruşunu gösterir', () => {
    const rows = explainDamage({ ...base, unblockedRatio: 0.5, weightedUnblockedRatio: 0.75, headShare: 1, afterRegion: 75, elementMultiplier: 1, afterElement: 75 }, 'fire', false);
    expect(rows.map((r) => r.label)).toEqual(['Büyü gücü (alan ve süre)', 'Savunmayı geçen', 'Baş vuruşu']);
    expect(rows[1]).toMatchObject({ factor: '%50', value: 50 });
    expect(rows[2]).toMatchObject({ factor: '×1.5', value: 75 });
  });
});

describe('büyü etkisi', () => {
  const hit = (finalDamage: number, basePower = 100) => ({ finalDamage, powerBeforeQuality: basePower * 0.8, powerFactor: { size: 1, effort: 0.8, total: 0.8 } });

  it('verilen hasara göre 5 kademe: çok etkisiz, etkisiz, normal, etkili, çok etkili (Faz 1)', () => {
    expect(spellEffect(hit(95))).toBe('veryEffective');
    expect(spellEffect(hit(60))).toBe('effective');
    expect(spellEffect(hit(40))).toBe('normal');
    expect(spellEffect(hit(20))).toBe('weak');
    expect(spellEffect(hit(5))).toBe('veryWeak');
    expect(spellEffect(hit(0))).toBe('veryWeak');
    expect(EFFECT_LABELS.veryWeak).toBe('ÇOK ETKİSİZ SALDIRI');
    expect(EFFECT_LABELS.normal).toBe('NORMAL SALDIRI');
    expect(EFFECT_LABELS.veryEffective).toBe('ÇOK ETKİLİ SALDIRI');
  });

  it('oran saldıranın taban gücüne göredir: güçlü asayla aynı hasar daha az etkilidir', () => {
    expect(spellEffect(hit(60, 100))).toBe('effective');
    expect(spellEffect(hit(60, 200))).toBe('normal');
    expect(damageRatio(hit(50, 200))).toBeCloseTo(0.25);
  });

  it('çizim kalitesi ve inceltilmiş savunma ayrı satır olarak görünür', () => {
    const rows = explainDamage({ ...base, power: 80, powerBeforeQuality: 100, attackQuality: 0.8, defenseStrength: 0.6, unblockedRatio: 0.5 }, 'fire', false);
    expect(rows.map((r) => r.label)).toEqual(['Büyü gücü (alan ve süre)', 'Çizim kalitesi (karalama / dağılım)', 'Savunma inceldi (karalama / fazla kaplama)', 'Savunmayı geçen', 'Ateş üstün']);
    expect(rows[1]).toMatchObject({ factor: '×0.8', value: 80 });
    expect(rows[2]).toMatchObject({ factor: '×0.6' });
  });

  it('kademeler eşiklerde değişir', () => {
    expect(spellEffect(hit(75))).toBe('veryEffective');
    expect(spellEffect(hit(74))).toBe('effective');
    expect(spellEffect(hit(50))).toBe('effective');
    expect(spellEffect(hit(30))).toBe('normal');
    expect(spellEffect(hit(12))).toBe('weak');
    expect(spellEffect(hit(11))).toBe('veryWeak');
  });

  it('bloklanan yüzdeyi verir; savunma yoksa %0', () => {
    expect(blockedPercent({ unblockedRatio: 0.35 }, false)).toBe(65);
    expect(blockedPercent({ unblockedRatio: 0 }, true)).toBe(0);
  });

  it('detayda çarpan kaynakları ayrı satırlar olarak art arda çarpılır', () => {
    const rows = explainDamage(
      {
        ...base,
        elementMultiplier: 1,
        afterElement: 100,
        multiplierParts: [
          { label: 'Ekipman çarpanı', value: 1.1 },
          { label: 'Saldırı yetenekleri', value: 1.2 },
        ],
      },
      'fire',
      true,
    );
    expect(rows.map((r) => r.label)).toEqual(['Büyü gücü (alan ve süre)', 'Ekipman çarpanı', 'Saldırı yetenekleri']);
    expect(rows[1]).toMatchObject({ factor: '×1.1', value: 110 });
    expect(rows[2]).toMatchObject({ factor: '×1.2', value: 132 });
  });
});
