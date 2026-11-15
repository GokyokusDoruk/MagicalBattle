import { BRUSH_RADIUS, CELL, GRID } from './config';
import type { DensityMap, SpellMetrics } from './types';

/**
 * Çizim kalitesi (Task 52): rastgele karalama ile düzgün çizilen büyüyü ayırır.
 *
 * - **Karalama:** Aynı yerlerin üstünden defalarca geçen çizimde, kapladığı alan çizgi uzunluğuna göre küçük kalır.
 *   `verim = kaplanan alan / (çizgi uzunluğu × fırça kalınlığı)`: temiz çizgide ~0.8-1.0, üst üste karalamada 0.3'ün altı.
 * - **Dağılım:** Tuval 4x4 bölgeye ayrılır; büyü ne kadar çok bölgeye yayılırsa o kadar tam güç (tek köşeye yığılmak zayıf).
 *
 * Eşikler bilerek **gevşek** başlar (haksız ceza yemek, karalamanın hafif avantajından kötü): temiz şekiller hiç ceza almaz.
 */
export const QUALITY = {
  /** Fırça kalınlığı (verim hesabında çizgi genişliği) */
  brushWidth: BRUSH_RADIUS * 2,
  /** Bu verimin üstünde karalama cezası yok */
  efficiencyFull: 0.55,
  /** Bu verimin altında en çok ceza */
  efficiencyFloor: 0.22,
  /** En çok karalama cezasında çarpan */
  scribbleFloor: 0.6,
  /** Dağılım: 4x4 bölgeden bu kadarı ya da fazlası dolu ise tam güç */
  spreadFullRegions: 6,
  /** Tek bölgeye yığılmış büyünün dağılım çarpanı */
  spreadFloor: 0.8,
  /** Bölge sayılması için gereken en az mürekkep hücresi */
  regionMinCells: 2,
  /** Bölge ızgarası (kenar başına) */
  regionGrid: 4,
} as const;

export interface DrawQuality {
  /** Çizgi verimi (kaplanan alan / çizgi alanı); 0 çizgi yoksa */
  efficiency: number;
  /** Karalama çarpanı (0.6-1) */
  scribble: number;
  /** Dolu bölge sayısı (0-16) */
  regions: number;
  /** Dağılım çarpanı (0.8-1) */
  spread: number;
  /** Toplam kalite çarpanı = karalama × dağılım */
  total: number;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Verimden karalama çarpanı: temizse 1, çok üst üste ise `scribbleFloor`. */
export function scribbleFactor(efficiency: number): number {
  const t = clamp01((efficiency - QUALITY.efficiencyFloor) / (QUALITY.efficiencyFull - QUALITY.efficiencyFloor));
  return QUALITY.scribbleFloor + (1 - QUALITY.scribbleFloor) * t;
}

/** Dolu bölge sayısından dağılım çarpanı. */
export function spreadFactor(regions: number): number {
  const t = clamp01((regions - 1) / Math.max(1, QUALITY.spreadFullRegions - 1));
  return QUALITY.spreadFloor + (1 - QUALITY.spreadFloor) * t;
}

/** Mürekkep haritasında en az `regionMinCells` hücre içeren 4x4 bölgelerin sayısı. */
export function filledRegions(density: DensityMap): number {
  const g = QUALITY.regionGrid;
  const per = Math.max(1, Math.floor(density.size / g));
  const counts = new Array<number>(g * g).fill(0);
  for (let k = 0; k < density.ink.length; k++) {
    if (!density.ink[k]) continue;
    const x = Math.min(g - 1, Math.floor((k % density.size) / per));
    const y = Math.min(g - 1, Math.floor(Math.floor(k / density.size) / per));
    counts[y * g + x]++;
  }
  return counts.filter((c) => c >= QUALITY.regionMinCells).length;
}

/** Çizim kalitesi. Çizgi yoksa her şey 1 (geçersiz büyü zaten hasar vermez). */
export function computeQuality(metrics: SpellMetrics, density: DensityMap): DrawQuality {
  if (metrics.pathLength <= 0 || metrics.inkedCells === 0) return { efficiency: 0, scribble: 1, regions: 0, spread: 1, total: 1 };
  const area = metrics.inkedCells * CELL * CELL;
  const efficiency = area / (metrics.pathLength * QUALITY.brushWidth);
  const scribble = scribbleFactor(efficiency);
  const regions = filledRegions(density);
  const spread = spreadFactor(regions);
  return { efficiency, scribble, regions, spread, total: scribble * spread };
}

/** Tuval sayfası (GRID) dışarıya açılır: testler ve savunma "fazla kaplama" hesabı için. */
export const GRID_CELLS = GRID * GRID;
