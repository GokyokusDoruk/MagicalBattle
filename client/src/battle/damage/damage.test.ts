import { describe, expect, it } from 'vitest';
import { buildDensity } from '../gesture/density';
import { computeMetrics } from '../gesture/metrics';
import type { Stroke } from '../gesture/types';
import { ARMOR_CAP, HEADSHOT_MULTIPLIER, MIN_EFFORT_FACTOR } from './config';
import { calculateDamage, powerFactor, type DamageInput } from './calculate';
import { ELEMENTS, elementMultiplier, elementRelation, type Element } from './elements';

const line = (x0: number, y0: number, x1: number, y1: number, ms: number, n = 60): Stroke =>
  Array.from({ length: n + 1 }, (_, i) => ({ x: x0 + (x1 - x0) * (i / n), y: y0 + (y1 - y0) * (i / n), t: (i / n) * ms }));

const circle = (cx: number, cy: number, r: number, ms: number, n = 80): Stroke =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), t: (i / n) * ms };
  });

const draw = (...strokes: Stroke[]) => {
  const density = buildDensity(strokes);
  return { density, metrics: computeMetrics(strokes, density) };
};

// Aynı uzunluk ve süre: biri tamamen baş bölgesinde (y≈20), biri tamamen gövdede (y≈180)
const headAttack = draw(line(20, 20, 236, 20, 2500));
const bodyAttack = draw(line(20, 180, 236, 180, 2500));

const base = (over: Partial<DamageInput> = {}): DamageInput => ({
  basePower: 100,
  attack: bodyAttack,
  defense: null,
  attackerElement: 'fire',
  defenderElement: 'fire',
  ...over,
});

describe('element döngüsü', () => {
  it('su ateşi, toprak suyu, hava toprağı, ateş havayı yener', () => {
    expect(elementRelation('water', 'fire')).toBe('advantage');
    expect(elementRelation('earth', 'water')).toBe('advantage');
    expect(elementRelation('air', 'earth')).toBe('advantage');
    expect(elementRelation('fire', 'air')).toBe('advantage');
  });

  it('tersi dezavantajdır', () => {
    expect(elementRelation('fire', 'water')).toBe('disadvantage');
    expect(elementRelation('water', 'earth')).toBe('disadvantage');
    expect(elementRelation('earth', 'air')).toBe('disadvantage');
    expect(elementRelation('air', 'fire')).toBe('disadvantage');
  });

  it('ateş–toprak, su–hava ve aynı element etkisizdir', () => {
    expect(elementRelation('fire', 'earth')).toBe('neutral');
    expect(elementRelation('earth', 'fire')).toBe('neutral');
    expect(elementRelation('water', 'air')).toBe('neutral');
    expect(elementRelation('air', 'water')).toBe('neutral');
    for (const e of ELEMENTS) expect(elementRelation(e, e)).toBe('neutral');
  });

  it('16 kombinasyonun çarpanları: dört üstünlük 1.25, dört dezavantaj 0.75, kalanı 1', () => {
    const counts = { 1.25: 0, 0.75: 0, 1: 0 } as Record<number, number>;
    for (const a of ELEMENTS) for (const d of ELEMENTS) counts[elementMultiplier(a, d)]++;
    expect(counts).toEqual({ 1.25: 4, 0.75: 4, 1: 8 });
  });

  it('her elementin tam bir yendiği ve tam bir kendini yenen elementi var (adil döngü)', () => {
    for (const e of ELEMENTS) {
      const beats = ELEMENTS.filter((o) => elementRelation(e, o) === 'advantage');
      const beatenBy = ELEMENTS.filter((o) => elementRelation(e, o) === 'disadvantage');
      expect(beats).toHaveLength(1);
      expect(beatenBy).toHaveLength(1);
    }
  });
});

describe('çizim gücü', () => {
  it('büyük çizim küçükten, tam süre kullanan aceleyle çizilenden güçlüdür', () => {
    const big = powerFactor(draw(circle(128, 128, 70, 2800)).metrics);
    const small = powerFactor(draw(circle(128, 128, 34, 2800)).metrics);
    const rushed = powerFactor(draw(circle(128, 128, 70, 150)).metrics);
    expect(big.total).toBeGreaterThan(small.total);
    expect(big.total).toBeGreaterThan(rushed.total);
  });

  it('en kötü acele bile taban gücün MIN_EFFORT_FACTOR kadarını korur, 0 ya da 1\'i aşmaz', () => {
    const f = powerFactor(draw(circle(128, 128, 90, 1)).metrics);
    expect(f.effort).toBeGreaterThanOrEqual(MIN_EFFORT_FACTOR - 1e-9);
    expect(f.total).toBeGreaterThan(0);
    expect(f.total).toBeLessThanOrEqual(1);
  });

  it('çok büyük alan fazladan güç vermez (üst sınır 1)', () => {
    const huge = draw(
      circle(128, 128, 110, 3000),
      circle(128, 128, 90, 0),
      circle(128, 128, 70, 0),
      circle(128, 128, 50, 0),
    );
    // Tuvali neredeyse dolduran çizim fazladan güç vermez; hafif kesilir (en çok %15)
    const size = powerFactor(huge.metrics).size;
    expect(size).toBeLessThanOrEqual(1);
    expect(size).toBeGreaterThanOrEqual(0.85);
  });
});

describe('calculateDamage', () => {
  it('savunma yoksa gövdeye düşen saldırı tam çizim gücü kadar vurur', () => {
    const r = calculateDamage(base());
    expect(r.defendedRatio).toBe(0);
    expect(r.headShare).toBe(0);
    expect(r.weightedUnblockedRatio).toBeCloseTo(1, 5);
    expect(r.finalDamage).toBe(Math.round(r.power));
    expect(r.power).toBeGreaterThan(0);
  });

  it('tamamen savunulursa hasar 0', () => {
    const r = calculateDamage(base({ defense: draw(line(0, 180, 256, 180, 1500)).density }));
    expect(r.defendedRatio).toBeGreaterThan(0.98);
    expect(r.finalDamage).toBeLessThanOrEqual(2);
  });

  it('savunma hasarı savunulan oranla orantılı azaltır', () => {
    const undefended = calculateDamage(base()).afterArmor;
    const half = calculateDamage(base({ defense: draw(line(20, 180, 128, 180, 1500)).density }));
    expect(half.defendedRatio).toBeGreaterThan(0.4);
    expect(half.defendedRatio).toBeLessThan(0.65);
    expect(half.afterArmor / undefended).toBeCloseTo(1 - half.defendedRatio, 5);
  });

  it('savunulmayan büyü başa düşerse ×1.5 vurur (aynı çizim gücüyle)', () => {
    const head = calculateDamage(base({ attack: headAttack }));
    const body = calculateDamage(base({ attack: bodyAttack }));
    expect(head.headShare).toBeGreaterThan(0.95);
    expect(body.headShare).toBe(0);
    expect(head.power).toBeCloseTo(body.power, 6); // gücü aynı, fark yalnızca bölgeden
    expect(head.afterRegion / body.afterRegion).toBeCloseTo(HEADSHOT_MULTIPLIER, 1);
  });

  it('başı savunulup gövdesi açıkta kalan saldırı gövde hasarı verir (baş çarpanı yok)', () => {
    const both = draw(line(20, 20, 236, 20, 1250), line(20, 180, 236, 180, 1250));
    const noDefense = calculateDamage(base({ attack: both }));
    const headCovered = calculateDamage(base({ attack: both, defense: draw(line(0, 20, 256, 20, 1500)).density }));
    expect(noDefense.headShare).toBeGreaterThan(0.4);
    expect(headCovered.headShare).toBeLessThan(0.1);
    expect(headCovered.weightedUnblockedRatio).toBeLessThan(noDefense.weightedUnblockedRatio);
  });

  it('element üstünlüğü ×1.25, dezavantaj ×0.75, etkisiz ×1', () => {
    const neutral = calculateDamage(base({ attackerElement: 'fire', defenderElement: 'earth' }));
    const adv = calculateDamage(base({ attackerElement: 'water', defenderElement: 'fire' }));
    const dis = calculateDamage(base({ attackerElement: 'fire', defenderElement: 'water' }));
    expect(adv.afterElement / neutral.afterElement).toBeCloseTo(1.25, 5);
    expect(dis.afterElement / neutral.afterElement).toBeCloseTo(0.75, 5);
    expect(adv.elementRelation).toBe('advantage');
    expect(dis.elementRelation).toBe('disadvantage');
  });

  it('skill ve ekipman çarpanları genel olarak çarpılır', () => {
    const plain = calculateDamage(base());
    const mods = calculateDamage(base({ attackerDealtMultiplier: 1.2, defenderTakenMultiplier: 0.9 }));
    expect(mods.skillMultiplier).toBeCloseTo(1.08, 5);
    expect(mods.afterSkills / plain.afterSkills).toBeCloseTo(1.08, 5);
  });

  it('zırh toplam hasarı yüzdeyle azaltır, üst sınırı aşamaz, negatif olamaz', () => {
    const plain = calculateDamage(base()).afterArmor;
    const half = calculateDamage(base({ defenderArmor: 0.5 }));
    expect(half.afterArmor / plain).toBeCloseTo(0.5, 5);
    const capped = calculateDamage(base({ defenderArmor: 5 }));
    expect(capped.armorReduction).toBe(ARMOR_CAP);
    expect(capped.afterArmor / plain).toBeCloseTo(1 - ARMOR_CAP, 5);
    expect(calculateDamage(base({ defenderArmor: -1 })).armorReduction).toBe(0);
  });

  it('adımların sırası sonucu bozmaz: çarpanlar tek tek uygulandığında tutarlı', () => {
    const r = calculateDamage(
      base({
        attack: headAttack,
        attackerElement: 'air',
        defenderElement: 'earth',
        attackerDealtMultiplier: 1.25,
        defenderTakenMultiplier: 0.8,
        defenderArmor: 0.4,
      }),
    );
    expect(r.afterRegion).toBeCloseTo(r.power * r.weightedUnblockedRatio, 6);
    expect(r.afterElement).toBeCloseTo(r.afterRegion * 1.25, 6);
    expect(r.afterSkills).toBeCloseTo(r.afterElement * 1.25 * 0.8, 6);
    expect(r.afterArmor).toBeCloseTo(r.afterSkills * 0.6, 6);
    expect(r.finalDamage).toBe(Math.round(r.afterArmor));
  });

  it('sonuç her zaman geçerli, tam sayı ve negatif olmayan bir hasar', () => {
    const inputs: DamageInput[] = [
      base({ basePower: 0 }),
      base({ basePower: -50 }),
      base({ attack: draw() }),
      base({ attackerDealtMultiplier: Number.NaN, defenderTakenMultiplier: -3, defenderArmor: Number.NaN }),
    ];
    for (const i of inputs) {
      const r = calculateDamage(i);
      expect(Number.isInteger(r.finalDamage)).toBe(true);
      expect(r.finalDamage).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(r.afterArmor)).toBe(true);
    }
  });

  it('daha güçlü asa (taban güç) orantılı hasar verir', () => {
    const weak = calculateDamage(base({ basePower: 50 }));
    const strong = calculateDamage(base({ basePower: 100 }));
    expect(strong.afterArmor / weak.afterArmor).toBeCloseTo(2, 5);
  });

  it('tüm element çiftlerinde sonuç, ancak çarpan kadar değişir', () => {
    const reference = calculateDamage(base({ attackerElement: 'fire', defenderElement: 'earth' })).afterElement;
    for (const a of ELEMENTS as readonly Element[]) {
      for (const d of ELEMENTS as readonly Element[]) {
        const r = calculateDamage(base({ attackerElement: a, defenderElement: d }));
        expect(r.afterElement / reference).toBeCloseTo(elementMultiplier(a, d), 5);
      }
    }
  });
});
