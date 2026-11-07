import { LOGICAL_SIZE } from '../gesture/config';
import type { Stroke } from '../gesture/types';

/** Büyü mührünün dünyadaki genişliği (birim). Tuvalin tamamı bu kareye sığar. */
export const SIGIL_SIZE = 3;
/** Bir çizginin 3D'de kullanılacak en fazla nokta sayısı (performans için seyreltilir) */
export const MAX_PATH_POINTS = 48;

export interface PlanePoint {
  x: number;
  y: number;
}

export interface MapOptions {
  size?: number;
  maxPoints?: number;
}

/**
 * Çizilen çizgileri büyü mührünün düzlemine çevirir: ortalanır, y ekseni yukarı bakar (tuvalde aşağı bakar),
 * aynı yerde bekleyerek biriken örnekler ayıklanır ve uzun çizgiler seyreltilir.
 * Tek noktalık çizgiler (dokunuş) atılır.
 */
export function strokesToPaths(strokes: readonly Stroke[], options: MapOptions = {}): PlanePoint[][] {
  const size = options.size ?? SIGIL_SIZE;
  const maxPoints = Math.max(2, options.maxPoints ?? MAX_PATH_POINTS);
  const paths: PlanePoint[][] = [];

  for (const stroke of strokes) {
    // Aynı noktadaki ardışık örnekleri (bekleme) tek noktaya indir
    const distinct = stroke.filter((p, i) => i === 0 || p.x !== stroke[i - 1].x || p.y !== stroke[i - 1].y);
    if (distinct.length < 2) continue;

    const picked =
      distinct.length <= maxPoints
        ? distinct
        : Array.from({ length: maxPoints }, (_, i) => distinct[Math.round((i * (distinct.length - 1)) / (maxPoints - 1))]);

    paths.push(
      picked.map((p) => ({
        x: (p.x / LOGICAL_SIZE - 0.5) * size,
        y: (0.5 - p.y / LOGICAL_SIZE) * size,
      })),
    );
  }
  return paths;
}

export function pathLength(path: readonly PlanePoint[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  return total;
}
