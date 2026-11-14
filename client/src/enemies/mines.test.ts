import { describe, expect, it } from 'vitest';
import { cityAt } from '../save/cityEntry';
import { generateMap, reachableSet } from '../world/generateMap';
import { ELEMENTS } from '../battle/damage/elements';
import { MINE_COOLDOWN_MS, MINE_STAGES, MineBoard, generateMines, mineEnemies } from './mines';

const map = generateMap();
const mines = generateMines(map);

describe('madenler', () => {
  it('her şehrin dört element madeni vardır', () => {
    const cities = map.locations.filter((l) => l.kind === 'city');
    expect(mines).toHaveLength(cities.length * 4);
    for (const c of cities) expect(mines.filter((m) => m.cityId === c.id).map((m) => m.element).sort()).toEqual([...ELEMENTS].sort());
  });

  it('madenler yürünebilir, surların dışında ve birbirinden ayrıdır', () => {
    const reach = reachableSet(map, map.spawn);
    for (const m of mines) {
      expect(reach.has(m.tileY * map.width + m.tileX)).toBe(true);
      expect(cityAt(map.locations, m.tileX, m.tileY)).toBeNull();
    }
    expect(new Set(mines.map((m) => `${m.tileX},${m.tileY}`)).size).toBe(mines.length);
    expect(new Set(mines.map((m) => m.id)).size).toBe(mines.length);
  });

  it('üç düşman vardır; sonuncusu en güçlüdür', () => {
    for (const m of mines) {
      const foes = mineEnemies(map, m);
      expect(foes).toHaveLength(MINE_STAGES);
      expect(foes.every((f) => f.element === m.element)).toBe(true);
      expect(foes[2].tier).toBeGreaterThanOrEqual(foes[0].tier);
    }
  });
});

describe('MineBoard', () => {
  it('10 dakika dinlenir', () => {
    let t = 0;
    const b = new MineBoard(() => t);
    expect(b.isReady('a')).toBe(true);
    b.start('a');
    expect(b.isReady('a')).toBe(false);
    t = MINE_COOLDOWN_MS - 1000;
    expect(b.cooldownLeftMs('a')).toBe(1000);
    expect(b.isReady('b')).toBe(true);
    t = MINE_COOLDOWN_MS;
    expect(b.isReady('a')).toBe(true);
  });
});
