import { cityAt } from '../save/cityEntry';
import { generateMap, reachableSet, tileAt, type WorldMap } from '../world/generateMap';
import { mulberry32 } from '../world/rng';
import { Tile } from '../world/tiles';
import { ELEMENTS } from '../battle/damage/elements';
import type { Tier } from './catalog';
import { CHEST_SPOTS } from './chests';
import { MINE_SPOTS } from './mines';
import { ENEMY_SPOTS, tierAt, type EnemySpot } from './spots';

/**
 * Tehlikeli bölgeler (Task 62): haritada bazı yerler çok daha tehlikelidir. Haritada kırmızı bir halka ve kafatası ile, küçük haritada kırmızı
 * bir daire olarak görünür. İçinde **çok sayıda** düşman bulunur ve hepsi yerin kademesinden daha güçlüdür (en az kademe 3). Bölgedeki düşmanlar
 * daha zengin ganimet verir (`DANGER_LOOT_BOOST`). Bölgeye girince uyarı çıkar.
 */

export interface DangerZone {
  id: string;
  name: string;
  /** Merkez karo ve yarıçap (karo) */
  tileX: number;
  tileY: number;
  radius: number;
}

export const DANGER_ZONE_COUNT = 5;
export const DANGER_RADIUS = 9;
/** Bölge başına düşman sayısı (normal düşman dağılımından çok daha yoğun) */
export const DANGER_ENEMIES_PER_ZONE = 10;
/** Bölgedeki düşmanların ganimet şansı çarpanı */
export const DANGER_LOOT_BOOST = 1.3;
const NAMES = ['Kızıl Vadi', 'Kemik Ovası', 'Kara Çukur', 'Sis Mezarlığı', 'Küllerin Çöplüğü'] as const;
const ENEMY_SPACING = 3;

const open = (t: Tile): boolean => t === Tile.Grass || t === Tile.Sand || t === Tile.Path;

/**
 * Tohumlu yerleşim: şehirlerden ve köylerden uzak, başlangıçtan uzak, birbirinden uzak, ulaşılabilir ve içinde yeterince açık zemin olan yerler.
 */
export function generateDangerZones(map: WorldMap, seed = 9091): DangerZone[] {
  const rand = mulberry32(seed);
  const reachable = reachableSet(map, map.spawn);
  const zones: DangerZone[] = [];
  const free = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < map.width && y < map.height && open(tileAt(map, x, y)) && reachable.has(y * map.width + x);
  for (let tries = 0; tries < 40000 && zones.length < DANGER_ZONE_COUNT; tries++) {
    const x = DANGER_RADIUS + 2 + Math.floor(rand() * (map.width - 2 * (DANGER_RADIUS + 2)));
    const y = DANGER_RADIUS + 2 + Math.floor(rand() * (map.height - 2 * (DANGER_RADIUS + 2)));
    if (!free(x, y) || cityAt(map.locations, x, y) !== null) continue;
    if (Math.hypot(x - map.spawn.x, y - map.spawn.y) < 26) continue;
    if (map.locations.some((l) => Math.hypot(l.x - x, l.y - y) < DANGER_RADIUS + (l.kind === 'city' ? 14 : 9))) continue;
    if (zones.some((z) => Math.hypot(z.tileX - x, z.tileY - y) < DANGER_RADIUS * 2 + 10)) continue;
    let openCount = 0;
    for (let dy = -DANGER_RADIUS; dy <= DANGER_RADIUS; dy++) for (let dx = -DANGER_RADIUS; dx <= DANGER_RADIUS; dx++) if (dx * dx + dy * dy <= DANGER_RADIUS ** 2 && free(x + dx, y + dy)) openCount++;
    if (openCount < 110) continue;
    zones.push({ id: `tehlike-${zones.length}`, name: NAMES[zones.length], tileX: x, tileY: y, radius: DANGER_RADIUS });
  }
  return zones;
}

/** Bölgenin düşmanları: bölge içinde, birbirinden en az 3 karo uzakta; kademe = yerin kademesi + 1 (en az 3, en çok 4); elementler dönüşümlü. */
export function generateZoneEnemies(map: WorldMap, zones: readonly DangerZone[], taken: readonly { x: number; y: number }[]): EnemySpot[] {
  const reachable = reachableSet(map, map.spawn);
  const out: EnemySpot[] = [];
  const blocked = [...taken];
  zones.forEach((zone, zi) => {
    const rand = mulberry32(5000 + zi * 31);
    const tier = Math.min(4, Math.max(3, tierAt(map, zone.tileX, zone.tileY) + 1)) as Tier;
    let n = 0;
    for (let tries = 0; tries < 4000 && n < DANGER_ENEMIES_PER_ZONE; tries++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * (zone.radius - 1);
      const x = Math.round(zone.tileX + Math.cos(a) * r);
      const y = Math.round(zone.tileY + Math.sin(a) * r);
      if (x < 2 || y < 2 || x >= map.width - 2 || y >= map.height - 2) continue;
      if (!open(tileAt(map, x, y)) || !reachable.has(y * map.width + x) || cityAt(map.locations, x, y) !== null) continue;
      if (blocked.some((p) => Math.hypot(p.x - x, p.y - y) < ENEMY_SPACING)) continue;
      blocked.push({ x, y });
      out.push({ id: `z-${zi}-${n}`, element: ELEMENTS[(zi + n) % ELEMENTS.length], tier, tileX: x, tileY: y });
      n++;
    }
  });
  return out;
}

const MAP = generateMap();
export const DANGER_ZONES: readonly DangerZone[] = generateDangerZones(MAP);
/** Bölge düşmanları (normal düşmanlardan, madenlerden ve sandıklardan uzakta) */
export const DANGER_ENEMY_SPOTS: readonly EnemySpot[] = generateZoneEnemies(MAP, DANGER_ZONES, [
  ...ENEMY_SPOTS.map((e) => ({ x: e.tileX, y: e.tileY })),
  ...MINE_SPOTS.map((m) => ({ x: m.tileX, y: m.tileY })),
  ...CHEST_SPOTS.map((c) => ({ x: c.tileX, y: c.tileY })),
]);
/** Haritadaki tüm sabit düşmanlar: normal ve tehlikeli bölge düşmanları */
export const WORLD_ENEMIES: readonly EnemySpot[] = [...ENEMY_SPOTS, ...DANGER_ENEMY_SPOTS];

/** Karo hangi tehlikeli bölgenin içinde (yoksa null). */
export function dangerZoneAt(tileX: number, tileY: number, zones: readonly DangerZone[] = DANGER_ZONES): DangerZone | null {
  return zones.find((z) => Math.hypot(tileX - z.tileX, tileY - z.tileY) <= z.radius) ?? null;
}

/** Bu düşman bir tehlikeli bölge düşmanı mı (ganimeti zenginleşir). */
export const isDangerEnemy = (id: string): boolean => id.startsWith('z-');
