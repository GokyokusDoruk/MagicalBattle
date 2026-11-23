import { describe, expect, it } from 'vitest';
import { LOGICAL_SIZE } from '../gesture/config';
import { analyzeStrokes } from '../gesture/analyze';
import { matchShape } from '../gesture/shapeMatch';
import { specialShapeFor } from './controller';
import { SHAPE_LABELS, SHAPE_NAMES, buildShape } from './shapes';

const NEW_SHAPES = ['anchor', 'umbrella', 'ladder', 'butterfly', 'note', 'mushroom', 'trident', 'snake', 'stairs', 'check', 'hook', 'boomerang', 'lollipop', 'candle'] as const;

describe('şekil listesi (Task 69)', () => {
  it('50 şekil var; ad ve Türkçe etiketler benzersiz, yeni 14 şekil listede', () => {
    expect(SHAPE_NAMES).toHaveLength(50);
    expect(new Set(SHAPE_NAMES).size).toBe(50);
    expect(new Set(SHAPE_NAMES.map((n) => SHAPE_LABELS[n])).size).toBe(50);
    for (const n of NEW_SHAPES) expect(SHAPE_NAMES).toContain(n);
  });

  it('her şekil farklı boyutlarda tuval içinde kalır ve geçerli çizim sayılır', () => {
    for (const n of SHAPE_NAMES) {
      for (const size of [45, 75, 100]) {
        const strokes = buildShape(n, 128, 128, size, 2200);
        for (const s of strokes) for (const p of s) expect(p.x >= 0 && p.x <= LOGICAL_SIZE && p.y >= 0 && p.y <= LOGICAL_SIZE, `${n} ${size}`).toBe(true);
        expect(analyzeStrokes(strokes).validity.valid, `${n} ${size}`).toBe(true);
      }
    }
  });

  it('şekil çizimi belirlidir: aynı girdi aynı çizgileri üretir', () => {
    for (const n of NEW_SHAPES) expect(buildShape(n, 128, 128, 75, 2000)).toEqual(buildShape(n, 128, 128, 75, 2000));
  });

  it('yeni şekiller kendilerini tanır ve birbirinin yerine geçmez', () => {
    for (const a of NEW_SHAPES) {
      const drawn = buildShape(a, 128, 128, 75, 2000);
      expect(matchShape(drawn, a).ok, a).toBe(true);
      for (const b of NEW_SHAPES) if (a !== b) expect(matchShape(drawn, b).ok, `${a} → ${b}`).toBe(false);
    }
  });
});

describe('özel büyü şekli seçimi', () => {
  it('döngüler ilerledikçe 50 şeklin hepsi sırayla gelir (adım, şekil sayısıyla aralarında asal)', () => {
    const seen = new Set<string>();
    for (let c = 0; c < SHAPE_NAMES.length; c++) seen.add(specialShapeFor(c, { team: 0, index: 0 }));
    expect(seen.size).toBe(SHAPE_NAMES.length);
  });

  it('aynı döngüde farklı takım ve sıradaki savaşçılar farklı şekil alır', () => {
    for (let c = 0; c < 20; c++) {
      const shapes = [
        specialShapeFor(c, { team: 0, index: 0 }),
        specialShapeFor(c, { team: 0, index: 1 }),
        specialShapeFor(c, { team: 1, index: 0 }),
        specialShapeFor(c, { team: 1, index: 1 }),
      ];
      expect(new Set(shapes).size, `döngü ${c}`).toBe(4);
    }
  });
});
