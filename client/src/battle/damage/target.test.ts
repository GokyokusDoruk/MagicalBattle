import { describe, expect, it } from 'vitest';
import { GRID, LOGICAL_SIZE } from '../gesture/config';
import {
  DEFAULT_POSE,
  GRAZE_DISTANCE,
  TARGET_POSES,
  TARGET_SCALE,
  ZONE,
  boundsFor,
  clampPose,
  normPose,
  puppetAngles,
  silhouetteShape,
  targetPoseFor,
  zoneAt,
  zoneMap,
  zoneMultiplier,
  type SilhouetteShape,
} from './target';

const allPoints = (s: SilhouetteShape): [number, number, number][] => [
  ...s.segments.flatMap((g) => [[g.ax, g.ay, g.r], [g.bx, g.by, g.r]] as [number, number, number][]),
  ...[s.head, ...s.ends].map((c) => [c.x, c.y, c.r] as [number, number, number]),
];
const insideCanvas = (s: SilhouetteShape): boolean => allPoints(s).every(([x, y, r]) => x - r >= 0 && x + r <= LOGICAL_SIZE && y - r >= 0 && y + r <= LOGICAL_SIZE);
const bodyCells = (p: Parameters<typeof zoneMap>[0]): number => zoneMap(p).filter((z) => z === ZONE.body || z === ZONE.head).length;

describe('rakip silüeti: kukla (Faz 3)', () => {
  it('baş, eller ve ayaklar aynı büyüklükte yuvarlak: hangisinin baş olduğu biçimden anlaşılmaz', () => {
    const s = silhouetteShape(DEFAULT_POSE);
    expect(s.ends).toHaveLength(4);
    for (const e of s.ends) expect(e.r).toBe(s.head.r);
  });

  it('kukla duruşları birbirinden farklı: baş her yerde olabilir (yukarıda, aşağıda, sağda, solda)', () => {
    const dirs = new Set<string>();
    for (let p = 1; p <= 60; p++) {
      const pose = clampPose({ cx: 128, cy: 128, pose: p });
      const s = silhouetteShape(pose);
      const dx = s.head.x - pose.cx;
      const dy = s.head.y - pose.cy;
      dirs.add(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'sağ' : 'sol') : dy > 0 ? 'aşağı' : 'yukarı');
    }
    expect(dirs.size).toBe(4);
    expect(puppetAngles(5)).toEqual(puppetAngles(5)); // tohumlu: aynı numara aynı duruş
    expect(puppetAngles(5)).not.toEqual(puppetAngles(6));
  });

  it('her duruş ve her yer tuvalin içinde kalır; seçilen yer sınırlara çekilir, ölçek sabittir', () => {
    for (let p = 0; p <= 80; p++) {
      const b = boundsFor(p);
      for (const [cx, cy] of [[b.minX, b.minY], [b.maxX, b.maxY], [-500, 900], [900, -500]]) {
        const pose = clampPose({ cx, cy, pose: p });
        expect(pose.scale).toBe(TARGET_SCALE);
        expect(insideCanvas(silhouetteShape(pose)), `duruş ${p}`).toBe(true);
      }
    }
    expect(clampPose({ cx: NaN, cy: NaN }).pose).toBe(0);
    expect([normPose(-3), normPose(2.7), normPose(undefined)]).toEqual([0, 2, 0]);
  });

  it('hacim hep aynıdır: duruş ve yer değişse de silüetin kapladığı alan neredeyse aynı (geniş, vurması kolay)', () => {
    const base = bodyCells(DEFAULT_POSE);
    expect(base / (GRID * GRID)).toBeGreaterThan(0.12);
    for (const p of [1, 7, 23, 51]) {
      const other = bodyCells(clampPose({ cx: 128, cy: 128, pose: p }));
      expect(Math.abs(other - base) / base, `duruş ${p}`).toBeLessThan(0.2); // eklemler üst üste binince biraz azalır
    }
  });

  it('bölgeler: baş, gövde (kollar, bacaklar, eller, ayaklar dahil), kenarda sıyırma, uzakta ıska', () => {
    const s = silhouetteShape(DEFAULT_POSE);
    expect(zoneAt(s, s.head.x, s.head.y)).toBe(ZONE.head);
    expect(zoneAt(s, DEFAULT_POSE.cx, DEFAULT_POSE.cy)).toBe(ZONE.body);
    for (const e of s.ends) expect(zoneAt(s, e.x, e.y)).toBe(ZONE.body); // el ve ayak baş değildir
    expect(zoneAt(s, s.head.x + s.head.r + GRAZE_DISTANCE / 2, s.head.y)).toBe(ZONE.graze);
    expect(zoneAt(s, 4, 4)).toBe(ZONE.far);
    const map = zoneMap(DEFAULT_POSE);
    expect(map).toHaveLength(GRID * GRID);
    for (const z of [ZONE.far, ZONE.graze, ZONE.body, ZONE.head]) expect(map.includes(z)).toBe(true);
  });

  it('art arda saldırılarda (1v1 ve 2v2) aynı hazır duruş gelmez; hepsi görülür', () => {
    const order = [];
    for (let c = 1; c <= 10; c++) for (const ref of [{ team: 0, index: 0 }, { team: 0, index: 1 }, { team: 1, index: 0 }, { team: 1, index: 1 }]) order.push(targetPoseFor(c, ref));
    for (let i = 1; i < order.length; i++) expect(order[i]).not.toBe(order[i - 1]);
    expect(new Set(order).size).toBe(TARGET_POSES.length);
  });

  it('çarpanlar: baş 1.25 (+yetenek), gövde 1, sıyırma 0.2, ıska 0.1', () => {
    expect([zoneMultiplier(ZONE.head), zoneMultiplier(ZONE.body), zoneMultiplier(ZONE.graze), zoneMultiplier(ZONE.far)]).toEqual([1.25, 1, 0.2, 0.1]);
    expect(zoneMultiplier(ZONE.head, 0.1)).toBeCloseTo(1.35);
  });
});
