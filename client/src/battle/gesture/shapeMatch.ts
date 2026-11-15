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
export function shapeDistance(a: readonly Stroke[], b: readonly Stroke[], samples = SAMPLES): number {
  const ca = normalizeCloud(resample(a, samples));
  const cb = normalizeCloud(resample(b, samples));
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

/** Aday ararken kullanılan hafif ayarlar (hız için): daha az örnek */
const SEARCH_SAMPLES = 64;
const WINDOW_FRACTIONS = [0.35, 0.5, 0.65, 0.8];
const MAX_POOL = 6;

const strokeLength = (s: Stroke): number => s.reduce((m, p, i) => (i ? m + Math.hypot(p.x - s[i - 1].x, p.y - s[i - 1].y) : m), 0);

/** Çizginin yay uzunluğuna göre [from, to) oranları arasındaki parçası. */
function strokeWindow(s: Stroke, from: number, to: number): Stroke {
  const total = strokeLength(s);
  if (total === 0) return s;
  const a = from * total;
  const b = to * total;
  const out: Stroke = [];
  let walked = 0;
  for (let i = 0; i < s.length; i++) {
    if (i > 0) walked += Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y);
    if (walked >= a && walked <= b) out.push(s[i]);
  }
  return out;
}

/**
 * Aday alt çizimler: tüm çizim; her çizgi tek başına; en uzun 6 çizginin 2'li ve 3'lü birleşimleri (çok çizgili şekiller: artı, çarpı, güneş...);
 * ve her çizginin farklı boy ve başlangıçlardaki parçaları (uzun bir çizginin içinde saklı şekil: ekstra çizilmiş kuyruklar, süsler).
 */
export function candidateDrawings(strokes: readonly Stroke[]): Stroke[][] {
  const out: Stroke[][] = [strokes.map((s) => s)];
  const usable = strokes.filter((s) => s.length > 1);
  const pool = [...usable].sort((a, b) => strokeLength(b) - strokeLength(a)).slice(0, MAX_POOL);
  for (const s of pool) out.push([s]);
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      out.push([pool[i], pool[j]]);
      for (let k = j + 1; k < pool.length; k++) out.push([pool[i], pool[j], pool[k]]);
    }
  }
  for (const s of pool) {
    if (strokeLength(s) < 60) continue;
    for (const w of WINDOW_FRACTIONS) {
      const step = Math.max(0.1, (1 - w) / 3);
      for (let from = 0; from + w <= 1 + 1e-9; from += step) {
        const part = strokeWindow(s, from, from + w);
        if (part.length > 3) out.push([part]);
      }
    }
  }
  return out;
}

/**
 * Çizimin **içinde** şekil var mı (Task 67): tüm çizim ve alt parçalar (tek çizgi, çizgi birleşimleri, çizgi parçaları) şablonla karşılaştırılır;
 * herhangi biri eşiği geçerse başarılıdır. Böylece şekle ek olarak başka çizgiler çizmek özel büyü puanını bozmaz.
 * \`distance\` en iyi adayın uzaklığıdır.
 */
export function matchShapeWithin(strokes: readonly Stroke[], name: ShapeName): ShapeMatch {
  const template = templateStrokes(name);
  let best = Infinity;
  for (const cand of candidateDrawings(strokes)) {
    const d = shapeDistance(cand, template, SEARCH_SAMPLES);
    if (d < best) best = d;
    if (best <= MATCH_THRESHOLD) break;
  }
  return { distance: best, ok: best <= MATCH_THRESHOLD };
}
