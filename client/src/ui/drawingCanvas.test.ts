import { describe, expect, it } from 'vitest';
import { LOGICAL_SIZE } from '../battle/gesture/config';
import { SCAR_PENALTY_MS, SCAR_RADIUS, placeScars, segmentNearPoint } from './drawingCanvas';

describe('Yanık İzi tuval yardımcıları', () => {
  it('istenen sayıda iz, kenarlardan uzak ve birbirinden ayrı yerleşir', () => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let n = 0; n <= 3; n++) {
      const scars = placeScars(n, random);
      expect(scars).toHaveLength(n);
      for (const s of scars) {
        expect(s.x).toBeGreaterThanOrEqual(30);
        expect(s.x).toBeLessThanOrEqual(LOGICAL_SIZE - 30);
        expect(s.y).toBeGreaterThanOrEqual(30);
        expect(s.y).toBeLessThanOrEqual(LOGICAL_SIZE - 30);
      }
    }
  });

  it('dokunma, çizgi parçası izin yarıçapına girince sayılır (hızlı çizgi izin üstünden atlayamaz)', () => {
    const scar = { x: 100, y: 100 };
    expect(segmentNearPoint({ x: 0, y: 100 }, { x: 200, y: 100 }, scar, SCAR_RADIUS)).toBe(true);
    expect(segmentNearPoint({ x: 0, y: 150 }, { x: 200, y: 150 }, scar, SCAR_RADIUS)).toBe(false);
    expect(segmentNearPoint({ x: 100, y: 110 }, { x: 100, y: 110 }, scar, SCAR_RADIUS)).toBe(true);
  });

  it('ceza 0.2 saniyedir', () => {
    expect(SCAR_PENALTY_MS).toBe(200);
  });
});
