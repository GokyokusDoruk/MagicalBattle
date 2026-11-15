import { describe, expect, it } from 'vitest';
import { defenseOverfill, calculateDamage, sizeFactor } from '../damage/calculate';
import { SHAPE_NAMES, buildShape } from '../flow/shapes';
import { mulberry32 } from '../../world/rng';
import { matchDefense } from '../match/defense';
import { analyzeStrokes } from './analyze';
import { QUALITY, filledRegions, scribbleFactor, spreadFactor } from './quality';
import type { Stroke } from './types';

/** Küçük bir kutunun içinde, aynı yerlerin üstünden defalarca geçen insan karalaması (tohumlu). */
function scribble(seed: number, box = 110, ms = 2800, points = 340): Stroke[] {
  const rand = mulberry32(seed);
  const s: Stroke = [];
  let x = 128;
  let y = 128;
  for (let i = 0; i < points; i++) {
    x = Math.min(128 + box / 2, Math.max(128 - box / 2, x + (rand() - 0.5) * 70));
    y = Math.min(128 + box / 2, Math.max(128 - box / 2, y + (rand() - 0.5) * 70));
    s.push({ x, y, t: (i / points) * ms });
  }
  return [s];
}

describe('çizim kalitesi: karalama', () => {
  it('temiz şekiller (daire, yıldız, spiral, dalga, zikzak) her boyutta ceza almaz', () => {
    for (const name of SHAPE_NAMES) {
      for (const r of [58, 75, 92]) {
        const q = analyzeStrokes(buildShape(name, 128, 128, r, 2400)).quality;
        expect(q.scribble, `${name} r${r}`).toBe(1);
      }
    }
  });

  it('üst üste karalama ceza alır ve çarpan sınırın altına inmez', () => {
    for (const seed of [1, 2, 3, 4]) {
      const r = analyzeStrokes(scribble(seed));
      expect(r.quality.efficiency).toBeLessThan(QUALITY.efficiencyFull);
      expect(r.quality.scribble).toBeLessThan(0.9);
      expect(r.quality.scribble).toBeGreaterThanOrEqual(QUALITY.scribbleFloor);
    }
  });

  it('karalama çarpanı verimle monoton artar ve uçlarda sabitlenir', () => {
    expect(scribbleFactor(0)).toBe(QUALITY.scribbleFloor);
    expect(scribbleFactor(QUALITY.efficiencyFloor)).toBe(QUALITY.scribbleFloor);
    expect(scribbleFactor(QUALITY.efficiencyFull)).toBe(1);
    expect(scribbleFactor(2)).toBe(1);
    expect(scribbleFactor(0.4)).toBeGreaterThan(scribbleFactor(0.3));
  });

  it('karalama aynı alanı kaplayan temiz çizimden daha az hasar verir', () => {
    const messy = analyzeStrokes(scribble(7, 130, 2800, 360));
    const clean = analyzeStrokes(buildShape('spiral', 128, 128, 80, 2800));
    const dmg = (a: ReturnType<typeof analyzeStrokes>) =>
      calculateDamage({ basePower: 100, attack: a, defense: null, attackerElement: 'fire', defenderElement: 'fire', attackQuality: a.quality.total }).power;
    // alanları yaklaşık eşitle: kalite çarpanı karalamayı keser
    expect(messy.quality.total).toBeLessThan(clean.quality.total);
    expect(dmg(messy) / Math.max(1e-9, calculateDamage({ basePower: 100, attack: messy, defense: null, attackerElement: 'fire', defenderElement: 'fire' }).power)).toBeLessThan(0.95);
  });
});

describe('çizim kalitesi: dağılım', () => {
  it('geniş yayılan büyü tam, tek köşeye yığılan daha az dağılım çarpanı alır', () => {
    const wide = analyzeStrokes(buildShape('circle', 128, 128, 80, 2400)).quality;
    const corner = analyzeStrokes(buildShape('circle', 40, 40, 32, 2400)).quality;
    expect(wide.spread).toBe(1);
    expect(corner.spread).toBeLessThan(1);
    expect(corner.spread).toBeGreaterThanOrEqual(QUALITY.spreadFloor);
    expect(spreadFactor(1)).toBe(QUALITY.spreadFloor);
    expect(spreadFactor(QUALITY.spreadFullRegions)).toBe(1);
  });

  it('dolu bölgeler sayılır', () => {
    const d = analyzeStrokes(buildShape('circle', 128, 128, 80, 2400)).density;
    expect(filledRegions(d)).toBeGreaterThanOrEqual(6);
    expect(filledRegions(analyzeStrokes([]).density)).toBe(0);
  });
});

describe('güç eğrisi', () => {
  it('küçük büyü doğrusaldan sert düşer, orta ve büyük tam güç, tuvali dolduran hafif kesilir', () => {
    expect(sizeFactor(0)).toBe(0);
    expect(sizeFactor(0.072)).toBeLessThan(0.5); // tam alanın yarısı yarıdan az güç
    expect(sizeFactor(0.145)).toBe(1);
    expect(sizeFactor(0.2)).toBe(1);
    expect(sizeFactor(0.9)).toBeLessThan(1);
    expect(sizeFactor(0.9)).toBeGreaterThanOrEqual(0.85);
    // monoton: tam alana kadar artar
    for (let c = 0.02; c < 0.12; c += 0.02) expect(sizeFactor(c + 0.02)).toBeGreaterThan(sizeFactor(c));
  });
});

describe('savunma bütçesi', () => {
  it('tuvalin %35\'ine kadar tam, daha fazlası kalkanı inceltir (en az ×0.45)', () => {
    const size = 32;
    const cells = size * size;
    expect(defenseOverfill(Math.round(cells * 0.2), size)).toBe(1);
    expect(defenseOverfill(Math.round(cells * 0.5), size)).toBeLessThan(1);
    expect(defenseOverfill(cells, size)).toBeCloseTo(0.45, 6);
  });

  it('tuvali karalayarak dolduran savunma, saldırıyı tam kapatan ölçülü savunmadan az bloklar', () => {
    const attack = analyzeStrokes(buildShape('circle', 128, 128, 75, 2400));
    const exact = analyzeStrokes(buildShape('circle', 128, 128, 75, 2400)); // saldırıyı birebir kapatır
    const blanket = analyzeStrokes([
      // her yeri kaplayan sık zikzak
      Array.from({ length: 400 }, (_, i) => ({ x: (i % 2 ? 250 : 6), y: 6 + (i / 400) * 244, t: i * 7 })),
      ...Array.from({ length: 12 }, (_, r) => Array.from({ length: 30 }, (_, i) => ({ x: 6 + i * 8.4, y: 12 + r * 20, t: i * 20 }))),
    ]);
    const input = { basePower: 100, attack, attackerElement: 'fire', defenderElement: 'fire' } as const;
    const withExact = calculateDamage({ ...input, defense: exact.density, defenseQuality: exact.quality.scribble });
    const withBlanket = calculateDamage({ ...input, defense: blanket.density, defenseQuality: blanket.quality.scribble });
    expect(withBlanket.defenseStrength).toBeLessThan(0.7);
    expect(withExact.defenseStrength).toBe(1);
    expect(withBlanket.defendedRatio).toBeLessThan(0.7);
    expect(withExact.defendedRatio).toBeGreaterThan(withBlanket.defendedRatio);
  });

  it('savunma yoksa güç 1 sayılır', () => {
    const attack = analyzeStrokes(buildShape('circle', 128, 128, 75, 2400));
    expect(calculateDamage({ basePower: 100, attack, defense: null, attackerElement: 'fire', defenderElement: 'fire' }).defenseStrength).toBe(1);
  });
});

describe('ağırlık sınırı', () => {
  it('bir noktada beklemeyle biriken fazla ağırlık sayılmaz', () => {
    // aynı çizim, ama bir noktada uzun bekleme: sınırlı ağırlıkta bekleyen büyü de aynı hızla bloklanır
    const base = buildShape('circle', 128, 128, 75, 2400);
    const waiting: Stroke[] = base.map((s) => s.map((p) => ({ ...p })));
    for (let i = 0; i < 20; i++) waiting[0].splice(10, 0, { ...waiting[0][10], t: waiting[0][10].t + i * 30 });
    const a = analyzeStrokes(base);
    const b = analyzeStrokes(waiting);
    const capped = matchDefense(b.density, null, 1, 3);
    const raw = matchDefense(b.density, null, 1, Infinity);
    expect(capped.totalAttackWeight).toBeLessThan(raw.totalAttackWeight);
    expect(matchDefense(a.density, null, 1, 3).totalAttackWeight).toBeGreaterThan(0);
  });
});
