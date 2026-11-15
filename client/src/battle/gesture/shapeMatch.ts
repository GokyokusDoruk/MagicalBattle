import { buildShape, type ShapeName } from '../flow/shapes';
import type { Stroke } from './types';

/**
 * Özel büyü şekli tanıma (Task 58): çizilen çizgiler şablon şekille karşılaştırılır. Konum ve boyut önemsizdir (ağırlık merkezi ve ortalama
 * yarıçapa göre birimlenir); küçük dönmeler (±12°) tolere edilir, ama yön (yukarı/aşağı, sağ/sol) ve şekil önemlidir. Çok çizgili şekiller
 * (artı, çarpı) desteklenir.
 *
 * Ölçüt: iki nokta bulutu arasındaki **simetrik ortalama en yakın komşu uzaklığı**. Küçükse benzerdir.
 */

/** Bu uzaklığın altında şekil "başarılı" sayılır. Elle çizimin titremesine ve oynamasına tolerans verecek kadar geniş. */
export const MATCH_THRESHOLD = 0.115;
const SAMPLES = 96;

type P = { x: number; y: number };

/** Tüm çizgileri yay uzunluğuna göre eşit aralıkla `n` noktaya örnekler (çizgi atlamaları sayılmaz). */
export function resample(strokes: readonly Stroke[], n = SAMPLES): P[] {
  const segs: { a: P; b: P; len: number }[] = [];
  let total = 0;
  for (const s of strokes) {
    for (let i = 1; i < s.length; i++) {
      const len = Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y);
      if (len > 0) {
        segs.push({ a: s[i - 1], b: s[i], len });
        total += len;
      }
    }
  }
  if (total === 0) {
    const p = strokes.flat()[0];
    return p ? Array.from({ length: n }, () => ({ x: p.x, y: p.y })) : [];
  }
  const out: P[] = [];
  const step = total / n;
  let si = 0;
  let walked = 0;
  for (let k = 0; k < n; k++) {
    const target = (k + 0.5) * step;
    while (si < segs.length - 1 && walked + segs[si].len < target) {
      walked += segs[si].len;
      si++;
    }
    const sg = segs[si];
    const f = Math.min(1, Math.max(0, (target - walked) / sg.len));
    out.push({ x: sg.a.x + (sg.b.x - sg.a.x) * f, y: sg.a.y + (sg.b.y - sg.a.y) * f });
  }
  return out;
}

/** Ağırlık merkezini 0,0'a taşır ve merkezden ortalama (RMS) uzaklığa bölerek boyutu birimler. */
export function normalizeCloud(points: readonly P[]): P[] {
  if (points.length === 0) return [];
  const cx = points.reduce((m, p) => m + p.x, 0) / points.length;
  const cy = points.reduce((m, p) => m + p.y, 0) / points.length;
  const rms = Math.sqrt(points.reduce((m, p) => m + (p.x - cx) ** 2 + (p.y - cy) ** 2, 0) / points.length) || 1;
  return points.map((p) => ({ x: (p.x - cx) / rms, y: (p.y - cy) / rms }));
}

function rotate(points: readonly P[], rad: number): P[] {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return points.map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }));
}

/** Elle çizimde izin verilen en büyük dönme (rad) ve deneme adımı */
export const MAX_TILT = (12 * Math.PI) / 180;
const TILT_STEP = (4 * Math.PI) / 180;

function meanNearest(a: readonly P[], b: readonly P[]): number {
  let sum = 0;
  for (const p of a) {
    let best = Infinity;
    for (const q of b) {
      const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
      if (d < best) best = d;
    }
    sum += Math.sqrt(best);
  }
  return sum / Math.max(1, a.length);
}

/** İki çizim arasındaki uzaklık (küçük = benzer). Birinde nokta yoksa sonsuz. Küçük dönmeler tolere edilir (en iyi açı alınır). */
export function shapeDistance(a: readonly Stroke[], b: readonly Stroke[]): number {
  const ca = normalizeCloud(resample(a));
  const cb = normalizeCloud(resample(b));
  if (ca.length === 0 || cb.length === 0) return Infinity;
  let best = Infinity;
  for (let t = -MAX_TILT; t <= MAX_TILT + 1e-9; t += TILT_STEP) {
    const r = rotate(ca, t);
    best = Math.min(best, (meanNearest(r, cb) + meanNearest(cb, r)) / 2);
  }
  return best;
}

const templates = new Map<ShapeName, Stroke[]>();

/** Şablon çizgiler (standart boyutta, merkezde). */
export function templateStrokes(name: ShapeName): Stroke[] {
  let t = templates.get(name);
  if (!t) {
    t = buildShape(name, 128, 128, 75, 2000);
    templates.set(name, t);
  }
  return t;
}

export interface ShapeMatch {
  distance: number;
  ok: boolean;
}

/** Çizimin istenen şekle uyup uymadığı. */
export function matchShape(strokes: readonly Stroke[], name: ShapeName): ShapeMatch {
  const distance = shapeDistance(strokes, templateStrokes(name));
  return { distance, ok: distance <= MATCH_THRESHOLD };
}
