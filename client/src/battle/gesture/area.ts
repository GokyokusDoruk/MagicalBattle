import type { DensityMap, DrawingResult } from './types';

/**
 * Faz 6: alan büyüsü. Çizgiler kendine değip (ya da birbirine bağlanıp) kapalı bir bölge çevirince, o bölgenin içi hesaplanır.
 * Büyücünün **alan gücü** (asa + kolye, hücre sayısı) yetiyorsa bölge dolar ve büyünün kendisi olur: saldırıda vurur, savunmada
 * korur. Yetmeyen bölge boş kalır (yalnızca çizgisi sayılır); oyuncu yeni bir çizgiyle bölgeyi bölüp küçültebilir. Birden çok bölge
 * varsa gücün yettiği en büyük toplam seçilir. Saf hesap: arayüzden bağımsız, testlenebilir.
 */

/** Doldurulan bir hücrenin ağırlığı, çizilmiş hücrelerin ortalamasının bu katı (dolu alan çizginin kendisinden biraz hafiftir) */
export const FILL_WEIGHT = 0.6;
/** Bundan küçük kapalı boşluklar (çizgi arası kırıntılar) bölge sayılmaz */
export const MIN_REGION_CELLS = 3;

export interface AreaRegion {
  /** Bölgenin hücreleri (satır × kenar + sütun) */
  cells: number[];
}

export interface AreaInfo {
  /** Bulunan kapalı bölgelerin büyüklükleri (hücre) */
  regions: number[];
  /** Doldurulan bölgelerin sırası (`regions` içinde) */
  filled: number[];
  /** Doldurulan toplam hücre */
  filledCells: number;
  /** Alan gücü (hücre) */
  capacity: number;
  /** Doldurulan hücrelerin sırası (satır × kenar + sütun); 3D'de büyünün dolu yüzeyi olarak gösterilir */
  cells: number[];
}

/**
 * Mürekkebin çevirdiği kapalı bölgeler: kenardan mürekkebe değmeden ulaşılamayan boş hücreler, 4-komşulukla gruplanır.
 */
export function enclosedRegions(ink: ArrayLike<number>, size: number): AreaRegion[] {
  const n = size * size;
  const outside = new Uint8Array(n);
  const stack: number[] = [];
  const push = (k: number): void => {
    if (!ink[k] && !outside[k]) {
      outside[k] = 1;
      stack.push(k);
    }
  };
  for (let i = 0; i < size; i++) {
    push(i);
    push((size - 1) * size + i);
    push(i * size);
    push(i * size + size - 1);
  }
  const spread = (k: number, visit: (j: number) => void): void => {
    const r = Math.floor(k / size);
    const c = k % size;
    if (r > 0) visit(k - size);
    if (r < size - 1) visit(k + size);
    if (c > 0) visit(k - 1);
    if (c < size - 1) visit(k + 1);
  };
  while (stack.length) spread(stack.pop()!, push);

  const seen = new Uint8Array(n);
  const regions: AreaRegion[] = [];
  for (let k = 0; k < n; k++) {
    if (ink[k] || outside[k] || seen[k]) continue;
    const cells: number[] = [];
    const q = [k];
    seen[k] = 1;
    while (q.length) {
      const j = q.pop()!;
      cells.push(j);
      spread(j, (m) => {
        if (!ink[m] && !outside[m] && !seen[m]) {
          seen[m] = 1;
          q.push(m);
        }
      });
    }
    if (cells.length >= MIN_REGION_CELLS) regions.push({ cells });
  }
  return regions;
}

/**
 * Gücün yettiği en büyük toplam: bölgelerden hangileri doldurulsun (toplam ≤ güç, en büyük toplam). Eşitlikte daha az bölge.
 * Dönen: seçilen bölgelerin sırası (artan).
 */
export function chooseRegions(sizes: readonly number[], capacity: number): number[] {
  const cap = Math.max(0, Math.floor(capacity));
  const best: (number[] | null)[] = Array.from({ length: cap + 1 }, () => null);
  best[0] = [];
  sizes.forEach((s, i) => {
    if (s <= 0 || s > cap) return;
    for (let c = cap; c >= s; c--) {
      const prev = best[c - s];
      if (prev && (!best[c] || best[c]!.length > prev.length + 1)) best[c] = [...prev, i];
    }
  });
  for (let c = cap; c > 0; c--) if (best[c] && best[c]!.length > 0) return best[c]!;
  return [];
}

/** Çizimin bölgeleri ve hangilerinin dolacağı (çizerken canlı gösterim için de kullanılır). */
export function areaPlan(density: Pick<DensityMap, 'ink' | 'size'>, capacity: number): { regions: AreaRegion[]; filled: number[] } {
  const regions = enclosedRegions(density.ink, density.size);
  return { regions, filled: chooseRegions(regions.map((r) => r.cells.length), capacity) };
}

/**
 * Çizime alan büyüsünü uygular: seçilen bölgeler mürekkep olur ve ağırlık kazanır (çizilmiş hücrelerin ortalaması × FILL_WEIGHT).
 * Kaplama ölçüsü güncellenir; şekil, süre ve kalite aynen kalır. Dolacak bölge yoksa çizim değişmez.
 */
export function applyArea(result: DrawingResult, capacity: number): DrawingResult & { area: AreaInfo } {
  const plan = areaPlan(result.density, capacity);
  const sizes = plan.regions.map((r) => r.cells.length);
  const filledCells = plan.filled.reduce((sum, i) => sum + sizes[i], 0);
  const area: AreaInfo = { regions: sizes, filled: plan.filled, filledCells, capacity, cells: plan.filled.flatMap((i) => plan.regions[i].cells) };
  if (filledCells === 0 || !result.validity.valid) return { ...result, area };
  const { size, cells, ink } = result.density;
  let total = 0;
  let inked = 0;
  for (let k = 0; k < ink.length; k++) {
    if (ink[k]) {
      inked++;
      total += cells[k];
    }
  }
  const fill = (inked > 0 ? total / inked : 0) * FILL_WEIGHT;
  const nextCells = new Float32Array(cells);
  const nextInk = new Uint8Array(ink);
  for (const i of plan.filled) {
    for (const k of plan.regions[i].cells) {
      nextInk[k] = 1;
      nextCells[k] += fill;
    }
  }
  const inkedCells = result.metrics.inkedCells + filledCells;
  return {
    ...result,
    density: { size, cells: nextCells, ink: nextInk },
    metrics: { ...result.metrics, inkedCells, coverage: inkedCells / (size * size) },
    area,
  };
}
