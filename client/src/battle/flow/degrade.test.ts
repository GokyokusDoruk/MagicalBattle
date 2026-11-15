import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../world/rng';
import { analyzeStrokes } from '../gesture/analyze';
import { shapeDistance } from '../gesture/shapeMatch';
import { DEGRADE_MAX, attackDegrade, defenseDegrade, degradeDrawing } from './degrade';
import { buildShape } from './shapes';

const circle = () => analyzeStrokes(buildShape('circle', 128, 128, 75, 2400));

describe('botun çizimini bozma', () => {
  it('şiddet 0 ise çizim aynen döner; geçersiz büyü bozulmaz', () => {
    const c = circle();
    expect(degradeDrawing(c, 0, mulberry32(1))).toBe(c);
    const empty = analyzeStrokes([]);
    expect(degradeDrawing(empty, 0.4, mulberry32(1))).toBe(empty);
  });

  it('şiddet arttıkça çizim şablondan uzaklaşır; her çizgi tuval içinde kalır', () => {
    const c = circle();
    const base = c.strokes;
    let prev = 0;
    for (const sev of [0.1, 0.25, 0.5]) {
      let sum = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const d = degradeDrawing(c, sev, mulberry32(seed));
        sum += shapeDistance(d.strokes, base);
        for (const s of d.strokes) for (const p of s) expect(p.x >= 0 && p.x <= 256 && p.y >= 0 && p.y <= 256).toBe(true);
      }
      const mean = sum / 12;
      expect(mean).toBeGreaterThan(prev);
      prev = mean;
    }
  });

  it('çizgilerde boşluk kalır (çizgi ikiye bölünür) ve sonuç aynı tohumla aynıdır', () => {
    const c = circle();
    const a = degradeDrawing(c, 0.4, mulberry32(5));
    const b = degradeDrawing(c, 0.4, mulberry32(5));
    expect(a.strokes).toEqual(b.strokes);
    expect(a.strokes.length).toBeGreaterThan(c.strokes.length);
  });

  it('pasiflerden şiddet: yara izi ve sarsıntı saldırıyı, sis ve çamur savunmayı bozar; en çok 0.5', () => {
    expect(attackDegrade({ scars: 0, shake: 0 })).toBe(0);
    expect(attackDegrade({ scars: 3, shake: 0 })).toBeCloseTo(0.15, 6);
    expect(attackDegrade({ scars: 3, shake: 3 })).toBeGreaterThan(attackDegrade({ scars: 3, shake: 0 }));
    expect(defenseDegrade({ fog: 3, mud: 0 })).toBeCloseTo(0.15, 6);
    expect(defenseDegrade({ fog: 3, mud: 3 })).toBeGreaterThan(defenseDegrade({ fog: 3, mud: 0 }));
    expect(attackDegrade({ scars: 100, shake: 100 })).toBe(DEGRADE_MAX);
    expect(defenseDegrade({ fog: 100, mud: 100 })).toBe(DEGRADE_MAX);
  });
});
