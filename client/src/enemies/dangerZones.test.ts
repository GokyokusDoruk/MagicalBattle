import { describe, expect, it } from 'vitest';
import { generateMap, reachableSet, tileAt } from '../world/generateMap';
import { Tile } from '../world/tiles';
import { CHEST_SPOTS } from './chests';
import { DANGER_ENEMIES_PER_ZONE, DANGER_ENEMY_SPOTS, DANGER_RADIUS, DANGER_ZONES, DANGER_ZONE_COUNT, WORLD_ENEMIES, dangerZoneAt, generateDangerZones, isDangerEnemy } from './dangerZones';
import { MINE_SPOTS } from './mines';
import { ENEMY_COUNT, ENEMY_SPOTS } from './spots';

const map = generateMap();

describe('tehlikeli bölgeler', () => {
  it('beş bölge: şehirlerden, köylerden ve başlangıçtan uzak, birbirinden ayrı, ulaşılabilir', () => {
    expect(DANGER_ZONES).toHaveLength(DANGER_ZONE_COUNT);
    expect(new Set(DANGER_ZONES.map((z) => z.name)).size).toBe(DANGER_ZONE_COUNT);
    const reachable = reachableSet(map, map.spawn);
    for (const z of DANGER_ZONES) {
      expect(reachable.has(z.tileY * map.width + z.tileX), z.name).toBe(true);
      expect(Math.hypot(z.tileX - map.spawn.x, z.tileY - map.spawn.y)).toBeGreaterThanOrEqual(26);
      for (const l of map.locations) expect(Math.hypot(l.x - z.tileX, l.y - z.tileY), `${z.name}/${l.id}`).toBeGreaterThan(z.radius + 8);
      for (const o of DANGER_ZONES) if (o !== z) expect(Math.hypot(o.tileX - z.tileX, o.tileY - z.tileY)).toBeGreaterThan(z.radius * 2);
      expect(z.radius).toBe(DANGER_RADIUS);
    }
  });

  it('yerleşim tohumludur (aynı harita, aynı bölgeler)', () => {
    expect(generateDangerZones(map)).toEqual([...DANGER_ZONES]);
  });

  it('çok düşman: her bölgede neredeyse 10, hepsi bölgenin içinde, en az kademe 3, birbirinden en az 3 karo', () => {
    for (let zi = 0; zi < DANGER_ZONES.length; zi++) {
      const z = DANGER_ZONES[zi];
      const foes = DANGER_ENEMY_SPOTS.filter((e) => e.id.startsWith(`z-${zi}-`));
      expect(foes.length, z.name).toBeGreaterThanOrEqual(DANGER_ENEMIES_PER_ZONE - 3);
      expect(foes.length).toBeLessThanOrEqual(DANGER_ENEMIES_PER_ZONE);
      for (const e of foes) {
        expect(Math.hypot(e.tileX - z.tileX, e.tileY - z.tileY)).toBeLessThanOrEqual(z.radius);
        expect(e.tier).toBeGreaterThanOrEqual(3);
        const t = tileAt(map, e.tileX, e.tileY);
        expect(t === Tile.Grass || t === Tile.Sand || t === Tile.Path).toBe(true);
      }
      for (const a of foes) for (const b of foes) if (a !== b) expect(Math.hypot(a.tileX - b.tileX, a.tileY - b.tileY)).toBeGreaterThanOrEqual(3);
    }
    // normal düşman yoğunluğundan çok daha yoğun: bölge alanı başına düşman sayısı
    const zoneArea = Math.PI * DANGER_RADIUS ** 2;
    const dangerDensity = DANGER_ENEMY_SPOTS.length / (zoneArea * DANGER_ZONES.length);
    const normalDensity = ENEMY_COUNT / (map.width * map.height);
    expect(dangerDensity).toBeGreaterThan(normalDensity * 6);
  });

  it('bölge düşmanları normal düşmanları, madenleri ve sandıkları bozmaz; kimlikler benzersiz', () => {
    expect(ENEMY_SPOTS).toHaveLength(ENEMY_COUNT);
    expect(WORLD_ENEMIES).toHaveLength(ENEMY_COUNT + DANGER_ENEMY_SPOTS.length);
    expect(new Set(WORLD_ENEMIES.map((e) => e.id)).size).toBe(WORLD_ENEMIES.length);
    for (const e of DANGER_ENEMY_SPOTS) {
      for (const o of [...ENEMY_SPOTS, ...MINE_SPOTS, ...CHEST_SPOTS]) expect(Math.hypot(('tileX' in o ? o.tileX : 0) - e.tileX, ('tileY' in o ? o.tileY : 0) - e.tileY)).toBeGreaterThanOrEqual(3);
    }
  });

  it('dangerZoneAt ve isDangerEnemy', () => {
    const z = DANGER_ZONES[0];
    expect(dangerZoneAt(z.tileX, z.tileY)?.id).toBe(z.id);
    expect(dangerZoneAt(z.tileX + z.radius, z.tileY)?.id).toBe(z.id);
    expect(dangerZoneAt(z.tileX + z.radius + 2, z.tileY)).toBeNull();
    expect(dangerZoneAt(map.spawn.x, map.spawn.y)).toBeNull();
    expect(isDangerEnemy(DANGER_ENEMY_SPOTS[0].id)).toBe(true);
    expect(isDangerEnemy(ENEMY_SPOTS[0].id)).toBe(false);
  });
});
