import { BRUSH_RADIUS, CELL, GRID, LOGICAL_SIZE, MAX_SEGMENT_DT_MS } from './config';
import type { DensityMap, Stroke } from './types';

export function createDensityMap(): DensityMap {
  return { size: GRID, cells: new Float32Array(GRID * GRID), ink: new Uint8Array(GRID * GRID) };
}

const clampCoord = (v: number): number => Math.min(LOGICAL_SIZE - 1e-6, Math.max(0, v));

/** Fırça alanındaki hücreler ve ağırlıkları (toplamı 1). Her nokta en az kendi hücresini kapsar. */
function brushCells(x: number, y: number): { index: number; weight: number }[] {
  const i0 = Math.max(0, Math.floor((x - BRUSH_RADIUS) / CELL));
  const i1 = Math.min(GRID - 1, Math.floor((x + BRUSH_RADIUS) / CELL));
  const j0 = Math.max(0, Math.floor((y - BRUSH_RADIUS) / CELL));
  const j1 = Math.min(GRID - 1, Math.floor((y + BRUSH_RADIUS) / CELL));
  const out: { index: number; weight: number }[] = [];
  let total = 0;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const d = Math.hypot((i + 0.5) * CELL - x, (j + 0.5) * CELL - y);
      if (d > BRUSH_RADIUS) continue;
      const w = 1 - d / (BRUSH_RADIUS * 1.25); // merkezde ağır, kenarda hafif
      out.push({ index: j * GRID + i, weight: w });
      total += w;
    }
  }
  return out.map((c) => ({ index: c.index, weight: c.weight / total }));
}

/** (x, y) noktasına `seconds` ağırlık ekler ve fırça izini işaretler. */
function splat(map: DensityMap, x: number, y: number, seconds: number): void {
  for (const { index, weight } of brushCells(clampCoord(x), clampCoord(y))) {
    map.cells[index] += seconds * weight;
    map.ink[index] = 1;
  }
}

/**
 * Çizgileri yoğunluk haritasına çevirir.
 * - Bir noktada ne kadar vakit geçtiyse o hücrenin ağırlığı o kadar artar (yavaş çizilen kısım daha önemli).
 * - Toplam ağırlık, çizim süresine eşittir.
 * - `ink` hızdan bağımsızdır: çabuk çizilen büyük bir daire de aynı alanı kaplar.
 */
export function buildDensity(strokes: readonly Stroke[]): DensityMap {
  const map = createDensityMap();
  for (const stroke of strokes) {
    if (stroke.length === 0) continue;
    splat(map, stroke[0].x, stroke[0].y, 0);
    for (let k = 1; k < stroke.length; k++) {
      const a = stroke[k - 1];
      const b = stroke[k];
      const seconds = Math.min(Math.max(b.t - a.t, 0), MAX_SEGMENT_DT_MS) / 1000;
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (CELL / 2)));
      for (let s = 0; s < steps; s++) {
        const f = (s + 0.5) / steps;
        splat(map, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, seconds / steps);
      }
      splat(map, b.x, b.y, 0);
    }
  }
  return map;
}
