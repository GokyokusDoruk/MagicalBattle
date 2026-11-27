import { describe, expect, it } from 'vitest';
import { GRID, LOGICAL_SIZE } from '../gesture/config';
import { DEFAULT_POSE, FIGURE_HEIGHT, GRAZE_DISTANCE, POSITION_BOUNDS, TARGET_POSES, TARGET_SCALE, ZONE, clampPose, silhouetteShape, targetPoseFor, zoneAt, zoneMap, zoneMultiplier } from './target';

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

  it('silüetin hacmi hep sabittir, yalnızca yeri değişir; geniş bir alan kaplar', () => {
    for (const p of [...TARGET_POSES, DEFAULT_POSE]) expect(p.scale).toBe(TARGET_SCALE);
    const cells = zoneMap(DEFAULT_POSE).filter((z) => z === ZONE.body || z === ZONE.head).length;
    expect(cells / (GRID * GRID)).toBeGreaterThan(0.18); // tuvalin beşte birine yakını silüet
    const moved = zoneMap(TARGET_POSES[1]).filter((z) => z === ZONE.body || z === ZONE.head).length;
    expect(Math.abs(moved - cells)).toBeLessThan(cells * 0.08); // yer değişse de alan aynı (hücre yuvarlaması kadar fark)
  });

  it('seçilen yer sınırlara çekilir, ölçek her zaman sabitlenir (küçülüp köşeye sıkışılamaz)', () => {
    expect(clampPose({ cx: -50, cy: 999 })).toEqual({ cx: POSITION_BOUNDS.minX, cy: POSITION_BOUNDS.maxY, scale: TARGET_SCALE });
    expect(clampPose({ cx: 128, cy: 128, scale: 0.3 } as never).scale).toBe(TARGET_SCALE);
    expect(clampPose({ cx: NaN, cy: NaN })).toEqual({ cx: 128, cy: 128, scale: TARGET_SCALE });
    const s = silhouetteShape(clampPose({ cx: 0, cy: 0 }));
    for (const [x, y] of [...s.body, ...s.hat]) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
    }
  });

  it('bölgeler: baş üstte, gövde altta, kenarda sıyırma, uzakta ıska; baş silüetle birlikte kayar', () => {
    const s = silhouetteShape(DEFAULT_POSE);
    expect(zoneAt(s, s.head.x, s.head.y)).toBe(ZONE.head);
    expect(zoneAt(s, 128, 180)).toBe(ZONE.body);
    expect(zoneAt(s, 128 + 48 * TARGET_SCALE + GRAZE_DISTANCE / 2, 220)).toBe(ZONE.graze);
    expect(zoneAt(s, 10, 10)).toBe(ZONE.far);
    const moved = silhouetteShape(clampPose({ cx: 64, cy: 150 }));
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
