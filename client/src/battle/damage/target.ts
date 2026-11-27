import { CELL, GRID, LOGICAL_SIZE } from '../gesture/config';

/**
 * Rakip silüeti (Faz 3): çizim tuvalinde rakibin büyücü silüeti görünür. Büyünün **silüete düşen** kısmı tam vurur, başa düşen
 * kısmı daha çok vurur; silüeti sıyıran ya da ıskalayan kısım çok az hasar verir. Her saldırı turunda silüet farklı bir yerde ve
 * boyutta durur (baş da onunla kayar). Saf hesap: arayüzden bağımsız, testlenebilir.
 */

/**
 * Silüetin tuvaldeki duruşu: figürün ortası (mantıksal birim) ve ölçeği (1 = 170 birim boy).
 * Faz 3 ek: silüetin hacmi **her zaman sabittir** (`TARGET_SCALE`); yalnızca yeri değişir. Savunan kendini küçültüp bir köşeye sıkıştıramaz.
 */
export interface TargetPose {
  cx: number;
  cy: number;
  scale: number;
}

/** Bölge: 0 uzak (ıska), 1 sıyırma, 2 gövde, 3 baş */
export type Zone = 0 | 1 | 2 | 3;
export const ZONE = { far: 0, graze: 1, body: 2, head: 3 } as const;

/** Bölge çarpanları: gövde tam, baş ×1.25 (+yetenek), sıyırma ×0.2, ıska ×0.1 */
export const HEAD_MULTIPLIER = 1.25;
export const GRAZE_MULTIPLIER = 0.2;
export const MISS_MULTIPLIER = 0.1;
/** Silüet kenarına bu kadar yakın hücre "sıyırma" sayılır: tuvalin ~%6'sı (kalem kalınlığının 2 katı) */
export const GRAZE_DISTANCE = Math.round(LOGICAL_SIZE * 0.0625);

/** Figürün ölçek 1'deki boyu (mantıksal birim) */
export const FIGURE_HEIGHT = 170;

/** Silüetin sabit ölçeği: tuvalin boyunun ~%80'i, genişliğinin ~%45'i (vurmak kolay, hacim hep aynı) */
export const TARGET_SCALE = 1.2;

/** Silüetin ortasının gidebileceği alan (silüet hep tuvalin içinde kalır) */
export const POSITION_BOUNDS = {
  minX: Math.ceil(48 * TARGET_SCALE) + 2,
  maxX: 256 - Math.ceil(48 * TARGET_SCALE) - 2,
  minY: Math.ceil(85 * TARGET_SCALE) + 2,
  maxY: 256 - Math.ceil(85 * TARGET_SCALE) - 2,
} as const;

/** Yeri sınırlara çeker, ölçeği sabitler (savunanın seçtiği yer ya da bozuk girdi güvenle kullanılır). */
export function clampPose(p: { cx: number; cy: number }): TargetPose {
  const b = POSITION_BOUNDS;
  const fx = Number.isFinite(p.cx) ? p.cx : 128;
  const fy = Number.isFinite(p.cy) ? p.cy : 128;
  return { cx: Math.min(b.maxX, Math.max(b.minX, fx)), cy: Math.min(b.maxY, Math.max(b.minY, fy)), scale: TARGET_SCALE };
}

/** Tuvalin ortasında duruş (silüet verilmeyen hesaplar ve laboratuvar için) */
export const DEFAULT_POSE: TargetPose = { cx: 128, cy: 128, scale: TARGET_SCALE };

/**
 * Savunan yer seçmezse (botlar arası simülasyon, testler) kullanılan duruşlar: sol, sağ, orta, yukarı, aşağı. Hepsi aynı boyda.
 * Sıra `targetPoseFor` ile seçilir (zar atılmaz, tohumlu testler bozulmaz).
 */
export const TARGET_POSES: readonly TargetPose[] = [
  clampPose({ cx: 128, cy: 132 }),
  clampPose({ cx: 70, cy: 140 }),
  clampPose({ cx: 186, cy: 116 }),
  clampPose({ cx: 104, cy: 150 }),
  clampPose({ cx: 160, cy: 136 }),
  clampPose({ cx: 64, cy: 110 }),
  clampPose({ cx: 192, cy: 150 }),
  clampPose({ cx: 136, cy: 108 }),
  clampPose({ cx: 90, cy: 124 }),
  clampPose({ cx: 170, cy: 146 }),
];

export interface SlotLike {
  team: number;
  index: number;
}

/** Bu saldırı turunda rakibin duruşu: döngü, saldıranın takımı ve sırasına göre; art arda iki saldırıda aynı yer gelmez. */
export function targetPoseFor(cycle: number, attacker: SlotLike): TargetPose {
  const i = (cycle * 3 + attacker.team * 5 + attacker.index * 7) % TARGET_POSES.length;
  return TARGET_POSES[i];
}

/** Silüetin parçaları (mantıksal koordinat): şapka üçgeni, baş dairesi ve cüppe (yamuk). */
export interface SilhouetteShape {
  hat: [number, number][];
  head: { x: number; y: number; r: number };
  body: [number, number][];
}

export function silhouetteShape(pose: TargetPose): SilhouetteShape {
  const s = pose.scale;
  const top = pose.cy - (FIGURE_HEIGHT / 2) * s;
  const X = (dx: number): number => pose.cx + dx * s;
  const Y = (dy: number): number => top + dy * s;
  return {
    hat: [
      [X(0), Y(0)],
      [X(-27), Y(30)],
      [X(27), Y(30)],
    ],
    head: { x: X(0), y: Y(46), r: 19 * s },
    // Omuzlardan eteğe genişleyen cüppe; boyun başa değer
    body: [
      [X(-10), Y(62)],
      [X(10), Y(62)],
      [X(34), Y(76)],
      [X(48), Y(FIGURE_HEIGHT)],
      [X(-48), Y(FIGURE_HEIGHT)],
      [X(-34), Y(76)],
    ],
  };
}

function insidePolygon(x: number, y: number, poly: readonly [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function polygonDistance(x: number, y: number, poly: readonly [number, number][]): number {
  if (insidePolygon(x, y, poly)) return 0;
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) best = Math.min(best, segmentDistance(x, y, poly[j][0], poly[j][1], poly[i][0], poly[i][1]));
  return best;
}

/** Tek bir noktanın bölgesi. */
export function zoneAt(shape: SilhouetteShape, x: number, y: number): Zone {
  const headD = Math.max(0, Math.hypot(x - shape.head.x, y - shape.head.y) - shape.head.r);
  const hatD = polygonDistance(x, y, shape.hat);
  if (headD === 0 || hatD === 0) return ZONE.head;
  const bodyD = polygonDistance(x, y, shape.body);
  if (bodyD === 0) return ZONE.body;
  return Math.min(headD, hatD, bodyD) <= GRAZE_DISTANCE ? ZONE.graze : ZONE.far;
}

const cache = new Map<string, Uint8Array>();

/** Yoğunluk haritası hücrelerinin bölgeleri (GRID×GRID, hücre ortasına göre). Duruş başına bir kez hesaplanır. */
export function zoneMap(pose: TargetPose): Uint8Array {
  const key = `${pose.cx}:${pose.cy}:${pose.scale}`;
  let map = cache.get(key);
  if (!map) {
    const shape = silhouetteShape(pose);
    map = new Uint8Array(GRID * GRID);
    for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) map[r * GRID + c] = zoneAt(shape, (c + 0.5) * CELL, (r + 0.5) * CELL);
    cache.set(key, map);
  }
  return map;
}

/** Bölge çarpanı; `headBonus` yeteneklerden başa eklenir. */
export function zoneMultiplier(zone: Zone, headBonus = 0): number {
  return zone === ZONE.head ? HEAD_MULTIPLIER + headBonus : zone === ZONE.body ? 1 : zone === ZONE.graze ? GRAZE_MULTIPLIER : MISS_MULTIPLIER;
}
