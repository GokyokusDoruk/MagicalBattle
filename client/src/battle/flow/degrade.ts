import { analyzeStrokes } from '../gesture/analyze';
import { LOGICAL_SIZE } from '../gesture/config';
import type { DrawingResult, Stroke } from '../gesture/types';

/**
 * Botların çizimini bozma (Task 66b): yara izi, sarsıntı, sis ve çamur insan oyuncuya yalnızca görüş engeli verir; botlar görmediği için
 * bu pasifler **çizimlerini belli oranda yanlış** yaptırır. Bozulma şiddeti (0-0.5): büyü yanlış yere kayar, çizgiler titrer ve çizgilerde
 * boşluklar kalır (saldırıda büyü zayıf ve şekilsiz çıkar, savunmada kalkan yanlış yeri kapatır).
 */

/** Pasif başına bozulma şiddeti */
export const DEGRADE_PER_SCAR = 0.05;
export const DEGRADE_PER_SHAKE = 0.04;
export const DEGRADE_PER_FOG = 0.05;
export const DEGRADE_PER_MUD = 0.04;
export const DEGRADE_MAX = 0.5;

/** Şiddete göre en büyük kayma, titreme (mantıksal birim) ve boşluk oranı */
const SHIFT = 34;
const JITTER = 26;
const GAP = 0.55;

const clamp = (v: number): number => Math.min(LOGICAL_SIZE, Math.max(0, v));

/** Saldırı çizerken botun maruz kaldığı bozulma: yara izi ve sarsıntı. */
export const attackDegrade = (p: { scars: number; shake: number }): number => Math.min(DEGRADE_MAX, p.scars * DEGRADE_PER_SCAR + p.shake * DEGRADE_PER_SHAKE);

/** Savunma çizerken botun maruz kaldığı bozulma: sis ve çamur. */
export const defenseDegrade = (p: { fog: number; mud: number }): number => Math.min(DEGRADE_MAX, p.fog * DEGRADE_PER_FOG + p.mud * DEGRADE_PER_MUD);

/**
 * Çizimi `severity` (0-0.5) oranında bozar: tüm büyü rastgele bir yöne kayar, her nokta titrer ve her çizgiden bir parça silinir (çizgi ikiye bölünür).
 * Sonuç yeniden analiz edilir (alan, kalite, geçerlilik). Şiddet 0 ise çizim aynen döner. Geçersiz büyü bozulmaz.
 */
export function degradeDrawing(result: DrawingResult, severity: number, random: () => number): DrawingResult {
  const s = Math.min(DEGRADE_MAX, Math.max(0, severity));
  if (s <= 0 || !result.validity.valid) return result;
  const dx = (random() - 0.5) * 2 * s * SHIFT;
  const dy = (random() - 0.5) * 2 * s * SHIFT;
  const phase = random() * 6;
  const out: Stroke[] = [];
  for (const stroke of result.strokes) {
    const moved = stroke.map((p, i) => ({
      x: clamp(p.x + dx + Math.sin(i * 0.45 + phase) * s * JITTER * 0.6 + (random() - 0.5) * s * JITTER),
      y: clamp(p.y + dy + Math.cos(i * 0.4 + phase) * s * JITTER * 0.6 + (random() - 0.5) * s * JITTER),
      t: p.t,
    }));
    const n = moved.length;
    const gap = Math.floor(n * s * GAP);
    if (gap >= 2 && n - gap >= 4) {
      const start = Math.floor(random() * (n - gap));
      const first = moved.slice(0, start);
      const second = moved.slice(start + gap);
      if (first.length > 1) out.push(first);
      if (second.length > 1) out.push(second);
    } else out.push(moved);
  }
  return analyzeStrokes(out, result.elapsedMs);
}
