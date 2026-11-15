import { LOGICAL_SIZE } from '../gesture/config';
import type { Stroke } from '../gesture/types';

/** Bot çizimleri için hazır şekiller. Hepsi mantıksal tuvalde, `ms` sürede çizilmiş gibi zaman damgalı. */

const clampCoord = (v: number): number => Math.min(LOGICAL_SIZE, Math.max(0, v));

function timed(points: [number, number][], ms: number): Stroke {
  const last = Math.max(1, points.length - 1);
  return points.map(([x, y], i) => ({ x: clampCoord(x), y: clampCoord(y), t: (i / last) * ms }));
}

export function circleShape(cx: number, cy: number, r: number, ms: number, n = 64): Stroke[] {
  return [timed(Array.from({ length: n + 1 }, (_, i) => [cx + r * Math.cos((i / n) * Math.PI * 2), cy + r * Math.sin((i / n) * Math.PI * 2)]), ms)];
}

export function starShape(cx: number, cy: number, r: number, ms: number): Stroke[] {
  const corners = [0, 2, 4, 1, 3, 0].map((k) => {
    const a = -Math.PI / 2 + (k / 5) * Math.PI * 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number];
  });
  const dense: [number, number][] = [];
  for (let i = 0; i < corners.length - 1; i++) {
    for (let s = 0; s < 12; s++) {
      dense.push([
        corners[i][0] + ((corners[i + 1][0] - corners[i][0]) * s) / 12,
        corners[i][1] + ((corners[i + 1][1] - corners[i][1]) * s) / 12,
      ]);
    }
  }
  dense.push(corners[corners.length - 1]);
  return [timed(dense, ms)];
}

export function spiralShape(cx: number, cy: number, rMax: number, ms: number, n = 90): Stroke[] {
  return [
    timed(
      Array.from({ length: n }, (_, i) => {
        const f = i / (n - 1);
        const a = f * Math.PI * 5;
        const r = rMax * (0.15 + 0.85 * f);
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      }),
      ms,
    ),
  ];
}

export function waveShape(cx: number, cy: number, width: number, amp: number, ms: number, n = 60): Stroke[] {
  return [
    timed(
      Array.from({ length: n }, (_, i) => {
        const f = i / (n - 1);
        return [cx - width / 2 + f * width, cy + amp * Math.sin(f * Math.PI * 3)];
      }),
      ms,
    ),
  ];
}

export function zigzagShape(cx: number, cy: number, width: number, height: number, ms: number): Stroke[] {
  const pts: [number, number][] = [];
  const legs = 5;
  for (let i = 0; i <= legs; i++) {
    const x = cx - width / 2 + (i / legs) * width;
    const y = cy + (i % 2 === 0 ? -height / 2 : height / 2);
    pts.push([x, y]);
  }
  const dense: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    for (let s = 0; s < 10; s++) {
      dense.push([pts[i][0] + ((pts[i + 1][0] - pts[i][0]) * s) / 10, pts[i][1] + ((pts[i + 1][1] - pts[i][1]) * s) / 10]);
    }
  }
  dense.push(pts[pts.length - 1]);
  return [timed(dense, ms)];
}

/** Büyü sayılmayacak kadar küçük bir karalama (botun ara sıra "büyü yapamadı" demesi için). */
export function scribbleShape(cx: number, cy: number, ms: number): Stroke[] {
  return circleShape(cx, cy, 9, ms, 16);
}

type Pt = [number, number];

/** Birim şekil (−1..1): çizgiler, `size` ile ölçeklenir ve (cx, cy) merkezine konur; çizgi parçaları sık noktalarla doldurulur. */
function unitShape(lines: Pt[][], cx: number, cy: number, size: number, ms: number): Stroke[] {
  const step = Math.max(2, size / 8);
  const total = lines.reduce((n, l) => n + l.reduce((m, p, i) => (i ? m + Math.hypot(p[0] - l[i - 1][0], p[1] - l[i - 1][1]) : m), 0), 0) || 1;
  let acc = 0;
  return lines.map((line) => {
    const dense: Pt[] = [];
    for (let i = 0; i < line.length - 1; i++) {
      const [x0, y0] = line[i];
      const [x1, y1] = line[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0) * size;
      const n = Math.max(1, Math.ceil(len / step));
      for (let k = 0; k < n; k++) dense.push([cx + (x0 + ((x1 - x0) * k) / n) * size, cy + (y0 + ((y1 - y0) * k) / n) * size]);
    }
    const last = line[line.length - 1];
    dense.push([cx + last[0] * size, cy + last[1] * size]);
    const lineLen = line.reduce((m, p, i) => (i ? m + Math.hypot(p[0] - line[i - 1][0], p[1] - line[i - 1][1]) : m), 0);
    const t0 = (acc / total) * ms;
    acc += lineLen;
    const t1 = (acc / total) * ms;
    return dense.map(([x, y], i) => ({ x: clampCoord(x), y: clampCoord(y), t: t0 + ((t1 - t0) * i) / Math.max(1, dense.length - 1) }));
  });
}

const curve = (n: number, fn: (t: number) => Pt, t0 = 0, t1 = Math.PI * 2): Pt[] => Array.from({ length: n + 1 }, (_, i) => fn(t0 + ((t1 - t0) * i) / n));

/** Birim şekil tanımları (özel büyü şekilleri ve bot çizimleri). Hepsi dönmeye duyarlıdır: yukarı/aşağı yönü önemlidir. */
const UNIT_SHAPES: Record<string, () => Pt[][]> = {
  triangle: () => [[[0, -1], [0.95, 0.8], [-0.95, 0.8], [0, -1]]],
  diamond: () => [[[0, -1], [0.8, 0], [0, 1], [-0.8, 0], [0, -1]]],
  heart: () => [curve(60, (t) => [(16 * Math.sin(t) ** 3) / 17, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17])],
  lightning: () => [[[0.45, -1], [-0.45, 0.05], [0.12, 0.05], [-0.45, 1]]],
  crescent: () => [[...curve(40, (t) => [Math.cos(t), Math.sin(t)], 0.75, Math.PI * 2 - 0.75), ...curve(30, (t) => [0.42 + 0.78 * Math.cos(t), 0.78 * Math.sin(t)], Math.PI * 2 - 0.62, 0.62)]],
  plus: () => [[[-0.9, 0], [0.9, 0]], [[0, -0.9], [0, 0.9]]],
  infinity: () => [curve(80, (t) => [(1.05 * Math.cos(t)) / (1 + Math.sin(t) ** 2), (1.05 * Math.sin(t) * Math.cos(t)) / (1 + Math.sin(t) ** 2)])],
  arrow: () => [[[-1, 0], [0.9, 0]], [[0.35, -0.55], [0.9, 0], [0.35, 0.55]]],
  cross: () => [[[-0.85, -0.85], [0.85, 0.85]], [[0.85, -0.85], [-0.85, 0.85]]],
  drop: () => [curve(60, (t) => [0.8 * Math.sin(t) * Math.sin(t / 2), -Math.cos(t)])],
  target: () => [curve(48, (t) => [Math.cos(t), Math.sin(t)]), curve(32, (t) => [0.45 * Math.cos(t), 0.45 * Math.sin(t)])],
  semicircle: () => [[...curve(40, (t) => [Math.cos(t), Math.sin(t) - 0.15], Math.PI, Math.PI * 2), [-1, -0.15]]],
  bowtie: () => [[[-0.95, -0.7], [0.95, 0.7], [0.95, -0.7], [-0.95, 0.7], [-0.95, -0.7]]],
  tower: () => [[[-0.5, 1], [-0.5, -0.2], [-0.75, -0.2], [-0.75, -0.9], [-0.3, -0.9], [-0.3, -0.5], [0.3, -0.5], [0.3, -0.9], [0.75, -0.9], [0.75, -0.2], [0.5, -0.2], [0.5, 1], [-0.5, 1]]],
  hook: () => [[[0.6, -1], [0.6, 0.3], ...curve(24, (t) => [0.6 * Math.cos(t), 0.3 + 0.6 * Math.sin(t)], 0, Math.PI).slice(1), [-0.6, -0.2]]],
};

export const SHAPE_NAMES = [
  'circle', 'star', 'spiral', 'wave', 'zigzag', 'triangle', 'diamond', 'heart', 'lightning', 'crescent', 'plus', 'infinity', 'arrow', 'cross', 'semicircle', 'tower',
] as const;
export type ShapeName = (typeof SHAPE_NAMES)[number];

/** Türkçe adlar (özel büyü şekli önizlemesinde gösterilir) */
export const SHAPE_LABELS: Record<ShapeName, string> = {
  circle: 'Daire', star: 'Yıldız', spiral: 'Spiral', wave: 'Dalga', zigzag: 'Zikzak', triangle: 'Üçgen', diamond: 'Elmas', heart: 'Kalp', lightning: 'Yıldırım',
  crescent: 'Hilal', plus: 'Artı', infinity: 'Sonsuzluk', arrow: 'Ok', cross: 'Çarpı', semicircle: 'Yarım daire', tower: 'Kale',
};

export function buildShape(name: ShapeName, cx: number, cy: number, size: number, ms: number): Stroke[] {
  switch (name) {
    case 'circle':
      return circleShape(cx, cy, size, ms);
    case 'star':
      return starShape(cx, cy, size * 1.1, ms);
    case 'spiral':
      return spiralShape(cx, cy, size, ms);
    case 'wave':
      return waveShape(cx, cy, size * 2.4, size * 0.7, ms);
    case 'zigzag':
      return zigzagShape(cx, cy, size * 2.3, size * 1.3, ms);
    default:
      return unitShape(UNIT_SHAPES[name](), cx, cy, size, ms);
  }
}
