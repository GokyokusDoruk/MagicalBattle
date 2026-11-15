import { describe, expect, it } from 'vitest';
import { LOGICAL_SIZE } from '../battle/gesture/config';
import { placeScars } from './drawingCanvas';

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
});
