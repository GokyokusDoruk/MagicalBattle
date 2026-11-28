import { describe, expect, it } from 'vitest';
import { analyzeStrokes } from './analyze';
import { FILL_WEIGHT, applyArea, areaPlan, chooseRegions, enclosedRegions } from './area';
import type { Stroke } from './types';

const circle = (cx: number, cy: number, r: number, ms = 2000, n = 90): Stroke =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), t: (i / n) * ms };
  });
const line = (x0: number, y0: number, x1: number, y1: number, ms = 800, n = 40): Stroke =>
  Array.from({ length: n + 1 }, (_, i) => ({ x: x0 + (x1 - x0) * (i / n), y: y0 + (y1 - y0) * (i / n), t: (i / n) * ms }));

describe('alan büyüsü (Faz 6)', () => {
  it('kendine değen çizgi (daire) bir kapalı bölge çevirir; açık çizgi çevirmez', () => {
    const ring = analyzeStrokes([circle(128, 128, 60)]);
    const regions = enclosedRegions(ring.density.ink, ring.density.size);
    expect(regions).toHaveLength(1);
    expect(regions[0].cells.length).toBeGreaterThan(80);
    const open = analyzeStrokes([line(30, 128, 226, 128)]);
    expect(enclosedRegions(open.density.ink, open.density.size)).toHaveLength(0);
  });

  it('içinden geçen yeni bir çizgi bölgeyi ikiye böler (oyuncu alanı daraltabilir)', () => {
    const one = analyzeStrokes([circle(128, 128, 60)]);
    const two = analyzeStrokes([circle(128, 128, 60), line(128, 40, 128, 216)]);
    const r1 = enclosedRegions(one.density.ink, one.density.size);
    const r2 = enclosedRegions(two.density.ink, two.density.size);
    expect(r2).toHaveLength(2);
    expect(Math.max(...r2.map((r) => r.cells.length))).toBeLessThan(r1[0].cells.length * 0.6);
  });

  it('gücün yettiği en büyük toplam seçilir; sığmayan bölge seçilmez', () => {
    expect(chooseRegions([50, 40, 30], 75)).toEqual([1, 2]); // 50 + 30 = 80 sığmaz; 40 + 30 = 70 en büyük toplam
    expect(chooseRegions([50, 40, 30], 80)).toEqual([0, 2]);
    expect(chooseRegions([200], 100)).toEqual([]);
    expect(chooseRegions([10, 20], 0)).toEqual([]);
    expect(chooseRegions([], 50)).toEqual([]);
  });

  it('güç yetiyorsa bölge dolar: mürekkep ve ağırlık kazanır, kaplama büyür; şekil ve süre aynı kalır', () => {
    const ring = analyzeStrokes([circle(128, 128, 40)]);
    const plan = areaPlan(ring.density, 999);
    const inside = plan.regions[0].cells.length;
    const filled = applyArea(ring, inside + 5);
    expect(filled.area.filledCells).toBe(inside);
    expect(filled.metrics.inkedCells).toBe(ring.metrics.inkedCells + inside);
    expect(filled.metrics.coverage).toBeGreaterThan(ring.metrics.coverage);
    expect(filled.metrics.drawTimeSec).toBe(ring.metrics.drawTimeSec);
    expect(filled.strokes).toEqual(ring.strokes);
    const k = plan.regions[0].cells[0];
    expect(filled.density.ink[k]).toBe(1);
    let total = 0;
    let n = 0;
    ring.density.ink.forEach((v, i) => {
      if (v) {
        n++;
        total += ring.density.cells[i];
      }
    });
    expect(filled.density.cells[k]).toBeCloseTo((total / n) * FILL_WEIGHT, 5);
    // Orijinal çizim değişmez
    expect(ring.density.ink[k]).toBe(0);
  });

  it('güç yetmiyorsa büyü boş kalır (yalnız çizgisi sayılır)', () => {
    const ring = analyzeStrokes([circle(128, 128, 60)]);
    const out = applyArea(ring, 20);
    expect(out.area.filledCells).toBe(0);
    expect(out.area.regions[0]).toBeGreaterThan(20);
    expect(out.density).toBe(ring.density);
  });

  it('iki ayrı kapalı bölge: güç ikisine de yetiyorsa ikisi de dolar', () => {
    const two = analyzeStrokes([circle(70, 128, 30), circle(186, 128, 30)]);
    const sizes = enclosedRegions(two.density.ink, two.density.size).map((r) => r.cells.length);
    expect(sizes).toHaveLength(2);
    const both = applyArea(two, sizes[0] + sizes[1]);
    expect(both.area.filled).toHaveLength(2);
    const one = applyArea(two, Math.max(...sizes) + 1);
    expect(one.area.filled).toHaveLength(1);
  });
});
