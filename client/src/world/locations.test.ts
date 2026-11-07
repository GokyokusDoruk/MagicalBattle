import { describe, expect, it } from 'vitest';
import { GateRegistry, isLockedGateAt } from './gates';
import { generateMap, isReachable, tileAt } from './generateMap';
import { CITY_HALF, LOCATIONS, approachTile } from './locations';
import { MAIN_QUEST_MARKERS, QuestTracker, markersInRange } from './questMarkers';
import { TILE_SIZE, Tile, isBlockedTile } from './tiles';

const map = generateMap();

describe('konumlar', () => {
  it('4 surlu şehir, 3 köy ve son arena var', () => {
    expect(LOCATIONS.filter((l) => l.kind === 'city')).toHaveLength(4);
    expect(LOCATIONS.filter((l) => l.kind === 'village')).toHaveLength(3);
    expect(LOCATIONS.filter((l) => l.kind === 'arena')).toHaveLength(1);
    expect(LOCATIONS.map((l) => l.chapter)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('hepsi harita içinde, kenardan uzakta', () => {
    for (const l of LOCATIONS) {
      expect(l.x).toBeGreaterThan(10);
      expect(l.y).toBeGreaterThan(10);
      expect(l.x).toBeLessThan(map.width - 10);
      expect(l.y).toBeLessThan(map.height - 5);
    }
  });

  it('her şehrin tam bir kapısı var ve etrafı duvar', () => {
    const cities = LOCATIONS.filter((l) => l.kind === 'city');
    expect(map.gates).toHaveLength(cities.length);
    for (const c of cities) {
      const gate = map.gates.find((g) => g.cityId === c.id)!;
      expect(tileAt(map, gate.x, gate.y)).toBe(Tile.Gate);
      expect(tileAt(map, c.x - CITY_HALF, c.y - CITY_HALF)).toBe(Tile.Wall);
      expect(tileAt(map, c.x, c.y)).toBe(Tile.Grass);
    }
  });

  it('başlangıçtan her konumun yaklaşma karosuna yürünebilir', () => {
    for (const l of LOCATIONS) {
      const a = approachTile(l);
      expect(isBlockedTile(tileAt(map, a.x, a.y))).toBe(false);
      expect(isReachable(map, map.spawn, a)).toBe(true);
    }
  });

  it('kapılar açık sayılınca şehir içine de girilebilir', () => {
    for (const l of LOCATIONS.filter((x) => x.kind === 'city')) {
      expect(isReachable(map, map.spawn, { x: l.x, y: l.y })).toBe(true);
    }
  });

  it('şehir duvarları kapı dışında geçilmezdir', () => {
    const l = LOCATIONS.find((x) => x.id === 'ignis')!;
    // Surun doğu duvarında kapı yok
    expect(isBlockedTile(tileAt(map, l.x + CITY_HALF, l.y))).toBe(true);
  });
});

describe('GateRegistry', () => {
  it('hepsi kilitli başlar, unlock açar, lock tekrar kilitler', () => {
    const reg = new GateRegistry();
    expect(reg.isUnlocked('ignis')).toBe(false);
    reg.unlock('ignis');
    expect(reg.isUnlocked('ignis')).toBe(true);
    reg.lock('ignis');
    expect(reg.isUnlocked('ignis')).toBe(false);
  });

  it('değişiklik olunca dinleyiciyi çağırır, tekrar açmak çağırmaz', () => {
    const reg = new GateRegistry();
    const calls: [string, boolean][] = [];
    reg.onChange((id, open) => calls.push([id, open]));
    reg.unlock('abyss');
    reg.unlock('abyss');
    expect(calls).toEqual([['abyss', true]]);
  });

  it('isLockedGateAt yalnızca kilitli kapı karosunda true döner', () => {
    const reg = new GateRegistry();
    const gate = map.gates[0];
    expect(isLockedGateAt(map.gates, reg, gate.x, gate.y)).toBe(true);
    expect(isLockedGateAt(map.gates, reg, gate.x + 5, gate.y)).toBe(false);
    reg.unlock(gate.cityId);
    expect(isLockedGateAt(map.gates, reg, gate.x, gate.y)).toBe(false);
  });
});

describe('ana görev işaretleri', () => {
  it('her bölüm için bir işaret var ve yürünebilir karoda duruyor', () => {
    expect(MAIN_QUEST_MARKERS).toHaveLength(8);
    for (const m of MAIN_QUEST_MARKERS) {
      const tile = tileAt(map, Math.floor(m.px / TILE_SIZE), Math.floor(m.py / TILE_SIZE));
      expect(isBlockedTile(tile)).toBe(false);
    }
  });

  it('başlangıçta yalnızca 1. bölüm aktif, activate yenisini açar', () => {
    const q = new QuestTracker();
    expect(q.activeMarkers().map((m) => m.chapter)).toEqual([1]);
    q.activate(2);
    expect(q.activeMarkers().map((m) => m.chapter)).toEqual([1, 2]);
  });

  it('markersInRange yakındakileri bulur', () => {
    const m = MAIN_QUEST_MARKERS[0];
    expect(markersInRange(MAIN_QUEST_MARKERS, m.px + 10, m.py, 30)).toEqual([m]);
    expect(markersInRange(MAIN_QUEST_MARKERS, m.px + 500, m.py, 30)).toEqual([]);
  });
});
