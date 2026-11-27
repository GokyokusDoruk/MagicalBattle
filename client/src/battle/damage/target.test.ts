import { describe, expect, it } from 'vitest';
import { GRID, LOGICAL_SIZE } from '../gesture/config';
import { boundsFor, normTurn, silhouetteHull, DEFAULT_POSE, FIGURE_HEIGHT, GRAZE_DISTANCE, POSITION_BOUNDS, TARGET_POSES, TARGET_SCALE, ZONE, clampPose, silhouetteShape, targetPoseFor, zoneAt, zoneMap, zoneMultiplier } from './target';

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
    expect(clampPose({ cx: -50, cy: 999 })).toEqual({ cx: POSITION_BOUNDS.minX, cy: POSITION_BOUNDS.maxY, scale: TARGET_SCALE, turn: 0 });
    expect(clampPose({ cx: 128, cy: 128, scale: 0.3 } as never).scale).toBe(TARGET_SCALE);
    expect(clampPose({ cx: NaN, cy: NaN })).toEqual({ cx: 128, cy: 128, scale: TARGET_SCALE, turn: 0 });
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

  it('başın nerede olduğuna savunan karar verir: yön çevrilince baş yukarı/sağa/aşağı/sola gider, alan aynı kalır', () => {
    const at = (turn: number) => silhouetteShape(clampPose({ cx: 128, cy: 128, turn })).head;
    const up = at(0);
    const right = at(1);
    const down = at(2);
    const left = at(3);
    expect(up.y).toBeLessThan(128);
    expect(right.x).toBeGreaterThan(128);
    expect(down.y).toBeGreaterThan(128);
    expect(left.x).toBeLessThan(128);
    const area = (turn: number) => zoneMap(clampPose({ cx: 128, cy: 128, turn })).filter((z) => z === ZONE.body || z === ZONE.head).length;
    for (const t of [1, 2, 3]) expect(Math.abs(area(t) - area(0))).toBeLessThan(area(0) * 0.08);
    expect(zoneAt(silhouetteShape(clampPose({ cx: 128, cy: 128, turn: 1 })), right.x, right.y)).toBe(ZONE.head);
    expect([normTurn(5), normTurn(-1), normTurn(undefined)]).toEqual([1, 3, 0]);
  });

  it('yan yatmış silüet de tuvalden taşmaz; saldıranın gördüğü kütle iki yönde de simetriktir', () => {
    for (const turn of [0, 1, 2, 3]) {
      const b = boundsFor(turn);
      for (const [cx, cy] of [[b.minX, b.minY], [b.maxX, b.maxY], [0, 256]]) {
        const pose = clampPose({ cx, cy, turn });
        const s = silhouetteShape(pose);
        for (const [x, y] of [...s.body, ...s.hat]) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(256);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(256);
        }
      }
    }
    // Baş yukarıda ya da aşağıdayken kütle aynı: saldıran başın hangi uçta olduğunu kütleden anlayamaz
    expect(silhouetteHull(clampPose({ cx: 128, cy: 128, turn: 0 }))).toEqual(silhouetteHull(clampPose({ cx: 128, cy: 128, turn: 2 })));
    expect(silhouetteHull(clampPose({ cx: 128, cy: 128, turn: 1 }))).toEqual(silhouetteHull(clampPose({ cx: 128, cy: 128, turn: 3 })));
  });

  it('çarpanlar: baş 1.25 (+yetenek), gövde 1, sıyırma 0.2, ıska 0.1', () => {
    expect([zoneMultiplier(ZONE.head), zoneMultiplier(ZONE.body), zoneMultiplier(ZONE.graze), zoneMultiplier(ZONE.far)]).toEqual([1.25, 1, 0.2, 0.1]);
    expect(zoneMultiplier(ZONE.head, 0.1)).toBeCloseTo(1.35);
  });
});
