import type { DensityMap } from '../gesture/types';

/**
 * Savunma çiziminin kenarındaki "yumuşak" pay (hücre). İz içindeki hücreler tam, bu mesafeye
 * kadar uzaktaki hücreler kademeli olarak korumalı sayılır; birkaç piksellik kaymalar cezalandırılmaz.
 */
export const DEFENSE_SOFT_EDGE_CELLS = 2;

export interface MatchResult {
  /** Saldırı ağırlığının savunulan oranı (0-1) */
  defendedRatio: number;
  /** Hücre başına savunulan saldırı ağırlığı (saniye) */
  blocked: Float32Array;
  /** Hücre başına savunulmayan, yani hasar verecek ağırlık (saniye). blocked + unblocked = saldırı */
  unblocked: Float32Array;
  /** Savunmanın hücre başına koruma düzeyi (0-1) */
  coverage: Float32Array;
  totalAttackWeight: number;
  unblockedWeight: number;
}

/** Savunma çiziminin her hücrede ne kadar koruma sağladığı (0-1). Çizilmemişse hep 0. */
export function defenseCoverage(defense: DensityMap | null): Float32Array {
  const n = defense?.size ?? 0;
  const out = new Float32Array(n * n);
  if (!defense) return out;

  const reach = Math.ceil(DEFENSE_SOFT_EDGE_CELLS);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      let best = 0;
      for (let dj = -reach; dj <= reach && best < 1; dj++) {
        for (let di = -reach; di <= reach; di++) {
          const x = i + di;
          const y = j + dj;
          if (x < 0 || y < 0 || x >= n || y >= n || !defense.ink[y * n + x]) continue;
          const d = Math.hypot(di, dj);
          if (d >= DEFENSE_SOFT_EDGE_CELLS) continue;
          best = Math.max(best, 1 - d / DEFENSE_SOFT_EDGE_CELLS); // iz içinde d=0 → tam koruma
        }
      }
      out[j * n + i] = best;
    }
  }
  return out;
}

/**
 * Saldırı ve savunma yoğunluk haritalarını karşılaştırır.
 * Saldırının her hücredeki ağırlığı, savunmanın o hücredeki korumasıyla azalır:
 * korunan kısım savunulmuştur, korunmayan kısım hasar verir.
 *
 * - Savunmanın kendi çizim hızı/süresi sonucu etkilemez, yalnızca nereyi kapattığı önemlidir.
 * - Savunma küçükse saldırının büyük kısmı açıkta kalır; saldırıyı tamamen kaplayan geniş savunma en fazla %100 verir.
 * - `defense` null ise (büyü yapılamadı) hiçbir şey savunulmaz.
 */
export function matchDefense(attack: DensityMap, defense: DensityMap | null, strength = 1, weightCapMultiple = Infinity): MatchResult {
  const cover = defenseCoverage(defense && defense.size === attack.size ? defense : null);
  const str = Math.min(1, Math.max(0, strength));
  // Ağırlık sınırı: bir noktada bekleyerek biriken fazla ağırlık sayılmaz
  let filled = 0;
  let sum = 0;
  for (let i = 0; i < attack.cells.length; i++) if (attack.cells[i] > 0) { filled++; sum += attack.cells[i]; }
  const cap = filled > 0 && Number.isFinite(weightCapMultiple) ? (sum / filled) * weightCapMultiple : Infinity;
  const blocked = new Float32Array(attack.cells.length);
  const unblocked = new Float32Array(attack.cells.length);
  let total = 0;
  let blockedTotal = 0;

  for (let k = 0; k < attack.cells.length; k++) {
    const a = Math.min(attack.cells[k], cap);
    const c = cover.length > 0 ? cover[k] * str : 0;
    blocked[k] = a * c;
    unblocked[k] = a - blocked[k];
    total += a;
    blockedTotal += blocked[k];
  }

  return {
    defendedRatio: total > 0 ? blockedTotal / total : 0,
    blocked,
    unblocked,
    coverage: cover.length > 0 ? cover : new Float32Array(attack.cells.length),
    totalAttackWeight: total,
    unblockedWeight: total - blockedTotal,
  };
}
