import { describe, expect, it } from 'vitest';
import { GRID, LOGICAL_SIZE } from '../gesture/config';
import { DEFAULT_POSE, FIGURE_HEIGHT, GRAZE_DISTANCE, TARGET_POSES, ZONE, silhouetteShape, targetPoseFor, zoneAt, zoneMap, zoneMultiplier } from './target';

describe('rakip silüeti (Faz 3)', () => {
  it('her duruş tuvalin içinde kalır', () => {
    for (const p of TARGET_POSES) {
      const s = silhouetteShape(p);
      const pts = [...s.hat, ...s.body, [s.head.x - s.head.r, s.head.y], [s.head.x + s.head.r, s.head.y]];
      for (const [x, y] of pts) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(LOGICAL_SIZE);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(LOGICAL_SIZE);
      }
      expect(FIGURE_HEIGHT * p.scale).toBeLessThan(LOGICAL_SIZE);
    }
  });

  it('her saldırıda farklı yer: art arda saldırılarda (1v1 ve 2v2) aynı duruş gelmez, döngüler boyunca hepsi görülür', () => {
    const order = [];
    for (let c = 1; c <= 10; c++) for (const ref of [{ team: 0, index: 0 }, { team: 0, index: 1 }, { team: 1, index: 0 }, { team: 1, index: 1 }]) order.push(targetPoseFor(c, ref));
    for (let i = 1; i < order.length; i++) expect(order[i]).not.toBe(order[i - 1]);
    expect(new Set(order).size).toBe(TARGET_POSES.length);
    const duel = [];
    for (let c = 1; c <= 6; c++) for (const ref of [{ team: 0, index: 0 }, { team: 1, index: 0 }]) duel.push(targetPoseFor(c, ref));
    for (let i = 1; i < duel.length; i++) expect(duel[i]).not.toBe(duel[i - 1]);
  });

  it('bölgeler: baş üstte, gövde altta, kenarda sıyırma, uzakta ıska; baş silüetle birlikte kayar', () => {
    const s = silhouetteShape(DEFAULT_POSE);
    expect(zoneAt(s, s.head.x, s.head.y)).toBe(ZONE.head);
    expect(zoneAt(s, 128, 180)).toBe(ZONE.body);
    expect(zoneAt(s, 128 + 48 + GRAZE_DISTANCE / 2, 200)).toBe(ZONE.graze);
    expect(zoneAt(s, 10, 10)).toBe(ZONE.far);
    const moved = silhouetteShape({ cx: 70, cy: 120, scale: 0.78 });
    expect(zoneAt(moved, moved.head.x, moved.head.y)).toBe(ZONE.head);
    expect(zoneAt(moved, s.head.x, s.head.y)).not.toBe(ZONE.head);
    const map = zoneMap(DEFAULT_POSE);
    expect(map).toHaveLength(GRID * GRID);
    for (const z of [ZONE.far, ZONE.graze, ZONE.body, ZONE.head]) expect(map.includes(z)).toBe(true);
  });

  it('çarpanlar: baş 1.25 (+yetenek), gövde 1, sıyırma 0.2, ıska 0.1', () => {
    expect([zoneMultiplier(ZONE.head), zoneMultiplier(ZONE.body), zoneMultiplier(ZONE.graze), zoneMultiplier(ZONE.far)]).toEqual([1.25, 1, 0.2, 0.1]);
    expect(zoneMultiplier(ZONE.head, 0.1)).toBeCloseTo(1.35);
  });
});
