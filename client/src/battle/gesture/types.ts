/** Çizim örneği. Koordinatlar mantıksal tuvalde (0..LOGICAL_SIZE), `t` ilk dokunuştan beri geçen ms. */
export interface StrokePoint {
  x: number;
  y: number;
  t: number;
}

export type Stroke = StrokePoint[];

/** Büyünün yoğunluk haritası: hangi noktada ne kadar vakit harcandığı ve nerelerin kaplandığı. */
export interface DensityMap {
  /** Bir kenardaki hücre sayısı */
  size: number;
  /** Her hücrede çizilirken harcanan süre (saniye). Toplamı çizim süresine eşittir. */
  cells: Float32Array;
  /** Fırça izinin kapladığı hücreler (1) — hızdan bağımsız, yalnızca geometri */
  ink: Uint8Array;
}

export interface SpellMetrics {
  /** İz kaplayan hücre sayısı */
  inkedCells: number;
  /** Kaplanan alanın tuvale oranı (0-1) */
  coverage: number;
  /** Çizimin sınır kutusu (mantıksal birim) */
  width: number;
  height: number;
  /** Toplam çizgi uzunluğu (mantıksal birim) */
  pathLength: number;
  /** Toplam çizim süresi (saniye) */
  drawTimeSec: number;
}

export type SpellRejection = 'EMPTY' | 'TOO_SMALL';

export type SpellValidity = { valid: true } | { valid: false; reason: SpellRejection; message: string };

import type { DrawQuality } from './quality';

export interface DrawingResult {
  /** Çizim kalitesi: karalama ve dağılım çarpanları (Task 52) */
  quality: DrawQuality;
  strokes: Stroke[];
  density: DensityMap;
  metrics: SpellMetrics;
  validity: SpellValidity;
  /** Ne kadar sürdü (ms); hiç çizilmediyse 0 */
  elapsedMs: number;
}
