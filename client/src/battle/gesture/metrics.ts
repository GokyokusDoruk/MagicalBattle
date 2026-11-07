import { GRID, MAX_SEGMENT_DT_MS, MIN_EXTENT, MIN_INKED_CELLS } from './config';
import type { DensityMap, SpellMetrics, SpellValidity, Stroke } from './types';

/** Çizimin ölçümleri. Kaplanan alan geometriden, süre ve uzunluk örneklerden hesaplanır. */
export function computeMetrics(strokes: readonly Stroke[], density: DensityMap): SpellMetrics {
  let inkedCells = 0;
  for (const v of density.ink) inkedCells += v;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let pathLength = 0;
  let drawTimeMs = 0;
  for (const stroke of strokes) {
    for (let k = 0; k < stroke.length; k++) {
      const p = stroke[k];
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
      if (k > 0) {
        const prev = stroke[k - 1];
        pathLength += Math.hypot(p.x - prev.x, p.y - prev.y);
        drawTimeMs += Math.min(Math.max(p.t - prev.t, 0), MAX_SEGMENT_DT_MS);
      }
    }
  }
  const hasPoints = Number.isFinite(minX);

  return {
    inkedCells,
    coverage: inkedCells / (GRID * GRID),
    width: hasPoints ? maxX - minX : 0,
    height: hasPoints ? maxY - minY : 0,
    pathLength,
    drawTimeSec: drawTimeMs / 1000,
  };
}

/**
 * Minimum hacim kuralı: büyü hem yeterli alan kaplamalı hem de yeterince geniş olmalı.
 * Tek nokta ya da küçük karalama büyü sayılmaz ("Büyü yapamadı!").
 */
export function validateSpell(m: SpellMetrics): SpellValidity {
  if (m.inkedCells === 0) {
    return { valid: false, reason: 'EMPTY', message: 'Hiçbir şey çizmedin.' };
  }
  if (m.inkedCells < MIN_INKED_CELLS || Math.max(m.width, m.height) < MIN_EXTENT) {
    return { valid: false, reason: 'TOO_SMALL', message: 'Çizim çok küçük.' };
  }
  return { valid: true };
}
