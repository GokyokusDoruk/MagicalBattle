import { buildDensity } from './density';
import { computeMetrics, validateSpell } from './metrics';
import { computeQuality } from './quality';
import type { DrawingResult, Stroke } from './types';

/**
 * Hazır çizgilerden çizim sonucu üretir (yoğunluk haritası, ölçümler, geçerlilik).
 * Botlar ve testler çizgileri kendisi ürettiği için oyuncunun `DrawingSession` turunun aynısını burada yapar.
 */
export function analyzeStrokes(strokes: readonly Stroke[], elapsedMs?: number): DrawingResult {
  const copy = strokes.map((s) => s.slice());
  const density = buildDensity(copy);
  const metrics = computeMetrics(copy, density);
  const lastT = copy.reduce((m, s) => (s.length > 0 ? Math.max(m, s[s.length - 1].t) : m), 0);
  return {
    strokes: copy,
    density,
    metrics,
    quality: computeQuality(metrics, density),
    validity: validateSpell(metrics),
    elapsedMs: elapsedMs ?? lastT,
  };
}
