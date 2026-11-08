import { cityAt } from '../save/cityEntry';
import { generateMap, reachableSet, tileAt, type WorldMap } from './generateMap';
import { mulberry32 } from './rng';
import { Tile } from './tiles';

/** Dünyada toplanabilen eşya. Bir kez toplanınca (kayıtla birlikte) bir daha çıkmaz. */
export interface PickupSpot {
  id: string;
  itemId: string;
  tileX: number;
  tileY: number;
}

interface Kind {
  itemId: string;
  prefix: string;
  /** Hangi zeminde çıkar */
  ground: Tile;
  count: number;
}

const KINDS: readonly Kind[] = [
  { itemId: 'sifali-ot', prefix: 'p-ot', ground: Tile.Grass, count: 28 },
  { itemId: 'kristal-parcasi', prefix: 'p-kristal', ground: Tile.Sand, count: 12 },
];

const MIN_SPACING = 4;
const MIN_FROM_SPAWN = 7;
const MIN_FROM_LOCATION = 4;
const BORDER = 4;

/**
 * Haritaya tohumla sabit konumlarda toplanabilir eşyalar yerleştirir: otlar çimende, kristaller kumsalda.
 * Hepsi başlangıçtan yürünerek ulaşılabilir, surların dışında, birbirinden ve köylerden uzak yerlerdedir.
 */
export function generatePickups(map: WorldMap, seed = 99): PickupSpot[] {
  const rand = mulberry32(seed);
  const reachable = reachableSet(map, map.spawn);
  const spots: PickupSpot[] = [];

  const farEnough = (x: number, y: number): boolean => {
    if (Math.hypot(x - map.spawn.x, y - map.spawn.y) < MIN_FROM_SPAWN) return false;
    if (spots.some((s) => Math.hypot(s.tileX - x, s.tileY - y) < MIN_SPACING)) return false;
    return !map.locations.some((l) => Math.hypot(l.x - x, l.y - y) < MIN_FROM_LOCATION + (l.kind === 'city' ? 6 : 4));
  };

  for (const kind of KINDS) {
    let placed = 0;
    for (let tries = 0; tries < 40000 && placed < kind.count; tries++) {
      const x = BORDER + Math.floor(rand() * (map.width - BORDER * 2));
      const y = BORDER + Math.floor(rand() * (map.height - BORDER * 2));
      if (tileAt(map, x, y) !== kind.ground) continue;
      if (cityAt(map.locations, x, y) !== null) continue;
      if (!reachable.has(y * map.width + x)) continue;
      if (!farEnough(x, y)) continue;
      spots.push({ id: `${kind.prefix}-${placed}`, itemId: kind.itemId, tileX: x, tileY: y });
      placed++;
    }
  }
  return spots;
}

/** Varsayılan haritadaki toplanabilir eşyalar. */
export const PICKUP_SPOTS: readonly PickupSpot[] = generatePickups(generateMap());
