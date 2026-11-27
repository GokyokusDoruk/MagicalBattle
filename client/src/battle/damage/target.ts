import { CELL, GRID, LOGICAL_SIZE } from '../gesture/config';

/**
 * Büyücü silüeti (Faz 3): bir **kukla**. Gövde, boyun ve baş, iki kol (el), iki bacak (ayak) eklemlidir; kollar, bacaklar ve baş
 * her duruşta başka yerdedir, figür istediği açıyla döner. Baş, eller ve ayaklar **aynı büyüklükte yuvarlaklardır**: dışarıdan bakan
 * hangisinin baş olduğunu ayırt edemez. Büyünün **silüete düşen** kısmı tam vurur, başa düşen kısmı ×1.25; silüeti sıyıran ×0.2,
 * ıskalayan ×0.1. Silüetin hacmi (parça boyları ve kalınlıkları) hep aynıdır; yalnızca yeri ve duruşu değişir.
 * Saf hesap: arayüzden bağımsız, testlenebilir.
 */

/** Silüetin tuvaldeki yeri (gövdenin ortası, mantıksal birim), ölçeği (sabit) ve kukla duruşu (`pose`: duruş numarası). */
export interface TargetPose {
  cx: number;
  cy: number;
  scale: number;
  /** Kukla duruşu (0 ve üstü tam sayı); verilmezse 0 (dik duruş) */
  pose?: number;
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

/** Sabit ölçek: kukla hep aynı büyüklükte */
export const TARGET_SCALE = 1.15;

/** Kukla ölçüleri (ölçek 1, mantıksal birim) */
export const PUPPET = {
  torsoHalf: 30,
  torsoR: 17,
  neckLen: 18,
  neckR: 7,
  /** Baş, eller ve ayaklar aynı yarıçapta */
  endR: 15,
  shoulderX: 15,
  shoulderY: -24,
  upperArm: 34,
  foreArm: 30,
  armR: 8,
  hipX: 10,
  upperLeg: 38,
  lowerLeg: 34,
  legR: 10,
} as const;

/** Kukla duruşu: açılar derece, 0 aşağıyı gösterir, artı yön aşağıdan sağa doğru */
export interface PuppetAngles {
  rot: number;
  neck: number;
  armL: [number, number];
  armR: [number, number];
  legL: [number, number];
  legR: [number, number];
}

/** Dik duruş (duruş 0): baş yukarıda, kollar yanlarda, bacaklar aşağıda */
const STANDING: PuppetAngles = { rot: 0, neck: 180, armL: [-25, -10], armR: [25, 10], legL: [-12, -4], legR: [12, 4] };

function hash(n: number, k: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(k + 1, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x27d4eb2d);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** En geniş duruş bile tuvale sığsın: kuklanın kapladığı kutunun en uzun kenarı bu sınırı geçmez */
const MAX_SPAN = LOGICAL_SIZE - 24;

const anglesCache = new Map<number, PuppetAngles>();

/**
 * Duruş numarasından kukla açıları (tohumlu, her çağrıda aynı). 0 dik duruştur; diğerlerinde kollar, bacaklar, boyun ve tüm gövde
 * rastgele açılarda (kukla gibi) durur. Tuvale sığmayan aday atlanır.
 */
export function puppetAngles(pose = 0): PuppetAngles {
  const idx = normPose(pose);
  if (idx === 0) return STANDING;
  const hit = anglesCache.get(idx);
  if (hit) return hit;
  let found: PuppetAngles = STANDING;
  for (let attempt = 0; attempt < 40; attempt++) {
    const between = (k: number, lo: number, hi: number): number => lo + (hi - lo) * hash(idx * 41 + attempt, k);
    const cand: PuppetAngles = {
      rot: between(0, 0, 360),
      neck: 180 + between(1, -50, 50),
      armL: [between(2, -175, 10), between(3, -120, 120)],
      armR: [between(4, -10, 175), between(5, -120, 120)],
      legL: [between(6, -80, 25), between(7, -90, 90)],
      legR: [between(8, -25, 80), between(9, -90, 90)],
    };
    const box = localBox(cand, TARGET_SCALE);
    if (box.maxX - box.minX <= MAX_SPAN && box.maxY - box.minY <= MAX_SPAN) {
      found = cand;
      break;
    }
  }
  anglesCache.set(idx, found);
  return found;
}

export interface Circle {
  x: number;
  y: number;
  r: number;
}
export interface Segment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  r: number;
}

/** Silüetin parçaları (tuval koordinatı): kalın çizgiler (gövde, boyun, kollar, bacaklar), baş ve uçlar (eller, ayaklar). */
export interface SilhouetteShape {
  head: Circle;
  /** Eller ve ayaklar: başla aynı büyüklükte */
  ends: Circle[];
  segments: Segment[];
}

const rad = (deg: number): number => (deg * Math.PI) / 180;
/** 0° aşağı; artı açı aşağıdan sağa döner */
const dir = (deg: number): [number, number] => [Math.sin(rad(deg)), Math.cos(rad(deg))];

/** Kuklayı yerel koordinatta (gövde ortası 0,0) kurar; `rot` uygulanır. */
function buildLocal(a: PuppetAngles, s: number): SilhouetteShape {
  const P = PUPPET;
  const cr = Math.cos(rad(a.rot));
  const sr = Math.sin(rad(a.rot));
  const R = (x: number, y: number): [number, number] => [x * cr - y * sr, x * sr + y * cr];
  const add = (p: [number, number], d: number, len: number): [number, number] => {
    const [dx, dy] = dir(d);
    return [p[0] + dx * len, p[1] + dy * len];
  };
  const segments: Segment[] = [];
  const seg = (p: [number, number], q: [number, number], r: number): void => {
    const [ax, ay] = R(p[0] * s, p[1] * s);
    const [bx, by] = R(q[0] * s, q[1] * s);
    segments.push({ ax, ay, bx, by, r: r * s });
  };
  const circ = (p: [number, number]): Circle => {
    const [x, y] = R(p[0] * s, p[1] * s);
    return { x, y, r: P.endR * s };
  };
  const neckBase: [number, number] = [0, -P.torsoHalf];
  seg(neckBase, [0, P.torsoHalf], P.torsoR);
  const neckEnd = add(neckBase, a.neck, P.neckLen);
  seg(neckBase, neckEnd, P.neckR);
  const head = circ(add(neckEnd, a.neck, P.endR * 0.7));
  const ends: Circle[] = [];
  const limb = (root: [number, number], [a1, a2]: [number, number], l1: number, l2: number, r: number): void => {
    const knee = add(root, a1, l1);
    const tip = add(knee, a1 + a2, l2);
    seg(root, knee, r);
    seg(knee, tip, r);
    ends.push(circ(tip));
  };
  limb([-P.shoulderX, P.shoulderY], a.armL, P.upperArm, P.foreArm, P.armR);
  limb([P.shoulderX, P.shoulderY], a.armR, P.upperArm, P.foreArm, P.armR);
  limb([-P.hipX, P.torsoHalf], a.legL, P.upperLeg, P.lowerLeg, P.legR);
  limb([P.hipX, P.torsoHalf], a.legR, P.upperLeg, P.lowerLeg, P.legR);
  return { head, ends, segments };
}

/** Yerel kuklanın kapladığı kutu (yarıçaplar dahil) */
function localBox(a: PuppetAngles, s: number): { minX: number; maxX: number; minY: number; maxY: number } {
  const sh = buildLocal(a, s);
  const box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  const take = (x: number, y: number, r: number): void => {
    box.minX = Math.min(box.minX, x - r);
    box.maxX = Math.max(box.maxX, x + r);
    box.minY = Math.min(box.minY, y - r);
    box.maxY = Math.max(box.maxY, y + r);
  };
  for (const g of sh.segments) {
    take(g.ax, g.ay, g.r);
    take(g.bx, g.by, g.r);
  }
  for (const c of [sh.head, ...sh.ends]) take(c.x, c.y, c.r);
  return box;
}

/** Duruş numarasını güvenli tam sayıya çeker */
export function normPose(p: number | undefined): number {
  return Math.max(0, Math.floor(typeof p === 'number' && Number.isFinite(p) ? p : 0));
}

/** Bu duruşta gövde ortasının gidebileceği alan (kukla hep tuvalin içinde kalır) */
export function boundsFor(pose = 0): { minX: number; maxX: number; minY: number; maxY: number } {
  const b = localBox(puppetAngles(pose), TARGET_SCALE);
  const m = 2;
  const minX = -b.minX + m;
  const maxX = LOGICAL_SIZE - b.maxX - m;
  const minY = -b.minY + m;
  const maxY = LOGICAL_SIZE - b.maxY - m;
  return { minX: Math.min(minX, maxX), maxX: Math.max(minX, maxX), minY: Math.min(minY, maxY), maxY: Math.max(minY, maxY) };
}

/** Yeri bu duruşun sınırlarına çeker, ölçeği sabitler (savunanın seçtiği yer ya da bozuk girdi güvenle kullanılır). */
export function clampPose(p: { cx: number; cy: number; pose?: number }): TargetPose {
  const pose = normPose(p.pose);
  const b = boundsFor(pose);
  const fx = Number.isFinite(p.cx) ? p.cx : 128;
  const fy = Number.isFinite(p.cy) ? p.cy : 128;
  return { cx: Math.min(b.maxX, Math.max(b.minX, fx)), cy: Math.min(b.maxY, Math.max(b.minY, fy)), scale: TARGET_SCALE, pose };
}

/** Tuvalin ortasında dik duruş (silüet verilmeyen hesaplar ve laboratuvar için) */
export const DEFAULT_POSE: TargetPose = clampPose({ cx: 128, cy: 128, pose: 0 });

/**
 * Savunan yer seçmezse (botlar arası simülasyon, testler) kullanılan duruşlar: farklı yerler ve farklı kukla duruşları.
 * Sıra `targetPoseFor` ile seçilir (zar atılmaz, tohumlu testler bozulmaz).
 */
export const TARGET_POSES: readonly TargetPose[] = [
  clampPose({ cx: 128, cy: 128, pose: 0 }),
  clampPose({ cx: 80, cy: 140, pose: 1 }),
  clampPose({ cx: 176, cy: 116, pose: 2 }),
  clampPose({ cx: 110, cy: 150, pose: 3 }),
  clampPose({ cx: 150, cy: 120, pose: 4 }),
  clampPose({ cx: 70, cy: 100, pose: 5 }),
  clampPose({ cx: 186, cy: 156, pose: 6 }),
  clampPose({ cx: 136, cy: 100, pose: 7 }),
  clampPose({ cx: 96, cy: 124, pose: 8 }),
  clampPose({ cx: 166, cy: 146, pose: 9 }),
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

/** Kuklanın tuvaldeki parçaları. */
export function silhouetteShape(pose: TargetPose): SilhouetteShape {
  const local = buildLocal(puppetAngles(pose.pose), pose.scale);
  const mv = (c: Circle): Circle => ({ x: c.x + pose.cx, y: c.y + pose.cy, r: c.r });
  return {
    head: mv(local.head),
    ends: local.ends.map(mv),
    segments: local.segments.map((g) => ({ ax: g.ax + pose.cx, ay: g.ay + pose.cy, bx: g.bx + pose.cx, by: g.by + pose.cy, r: g.r })),
  };
}

function segmentDistance(px: number, py: number, g: Segment): number {
  const dx = g.bx - g.ax;
  const dy = g.by - g.ay;
  const len = dx * dx + dy * dy;
  const t = len > 0 ? Math.max(0, Math.min(1, ((px - g.ax) * dx + (py - g.ay) * dy) / len)) : 0;
  return Math.hypot(px - (g.ax + t * dx), py - (g.ay + t * dy)) - g.r;
}

const circleDistance = (x: number, y: number, c: Circle): number => Math.hypot(x - c.x, y - c.y) - c.r;

/** Tek bir noktanın bölgesi. */
export function zoneAt(shape: SilhouetteShape, x: number, y: number): Zone {
  if (circleDistance(x, y, shape.head) <= 0) return ZONE.head;
  let d = Infinity;
  for (const g of shape.segments) d = Math.min(d, segmentDistance(x, y, g));
  for (const c of shape.ends) d = Math.min(d, circleDistance(x, y, c));
  if (d <= 0) return ZONE.body;
  d = Math.min(d, circleDistance(x, y, shape.head));
  return d <= GRAZE_DISTANCE ? ZONE.graze : ZONE.far;
}

const cache = new Map<string, Uint8Array>();

/** Yoğunluk haritası hücrelerinin bölgeleri (GRID×GRID, hücre ortasına göre). Duruş başına bir kez hesaplanır. */
export function zoneMap(pose: TargetPose): Uint8Array {
  const key = `${pose.cx}:${pose.cy}:${pose.scale}:${normPose(pose.pose)}`;
  let map = cache.get(key);
  if (!map) {
    const shape = silhouetteShape(pose);
    map = new Uint8Array(GRID * GRID);
    for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) map[r * GRID + c] = zoneAt(shape, (c + 0.5) * CELL, (r + 0.5) * CELL);
    if (cache.size > 400) cache.clear();
    cache.set(key, map);
  }
  return map;
}

/** Bölge çarpanı; `headBonus` yeteneklerden başa eklenir. */
export function zoneMultiplier(zone: Zone, headBonus = 0): number {
  return zone === ZONE.head ? HEAD_MULTIPLIER + headBonus : zone === ZONE.body ? 1 : zone === ZONE.graze ? GRAZE_MULTIPLIER : MISS_MULTIPLIER;
}
