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

export const SHAPE_NAMES = ['circle', 'star', 'spiral', 'wave', 'zigzag'] as const;
export type ShapeName = (typeof SHAPE_NAMES)[number];

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
  }
}
