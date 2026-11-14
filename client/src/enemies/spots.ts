import { cityAt } from '../save/cityEntry';
import { generateMap, reachableSet, tileAt, type WorldMap } from '../world/generateMap';
import { mulberry32 } from '../world/rng';
import { Tile } from '../world/tiles';
import { ELEMENTS, type Element } from '../battle/damage/elements';
import type { Tier } from './catalog';

/** Haritada bir düşmanın durduğu yer. Yenilince `RESPAWN_MS` sonra yeniden belirir (oturumda). */
export interface EnemySpot {
  id: string;
  element: Element;
  tier: Tier;
  tileX: number;
  tileY: number;
}

export const ENEMY_COUNT = 88;
/** Yenilen düşmanın geri gelme süresi (oyun süresiyle) */
export const ENEMY_RESPAWN_MS = 4 * 60 * 1000;

/** Düşman kademelerinin dağılımı (10 düşmanda): 2 x kademe 1, 3 x kademe 2, 2 x kademe 3, 3 x kademe 4 */
const TIER_QUOTA: readonly Tier[] = [1, 2, 3, 4, 2, 4, 1, 3, 2, 4];
const MIN_SPACING = 6;
const MIN_FROM_SPAWN = 9;
const MIN_FROM_LOCATION = 6;
const BORDER = 4;

/** Başlangıca uzaklığa göre kademe: yakın yerler kolay, uzak yerler zor. */
export function tierAt(map: WorldMap, x: number, y: number): Tier {
  const d = Math.hypot(x - map.spawn.x, y - map.spawn.y);
  return d < 16 ? 1 : d < 28 ? 2 : d < 40 ? 3 : 4;
}

/**
 * Haritaya tohumla sabit konumlarda düşman yerleştirir: yürünebilir yerlerde, surlardan, başlangıçtan ve birbirinden
 * uzakta. Elementler dönüşümlüdür; kademe başlangıca uzaklığa göre belirlenir.
 */
export function generateEnemySpots(map: WorldMap, seed = 4242): EnemySpot[] {
  const rand = mulberry32(seed);
  const reachable = reachableSet(map, map.spawn);
  const spots: EnemySpot[] = [];
  for (let tries = 0; tries < 60000 && spots.length < ENEMY_COUNT; tries++) {
    const x = BORDER + Math.floor(rand() * (map.width - BORDER * 2));
    const y = BORDER + Math.floor(rand() * (map.height - BORDER * 2));
    const tile = tileAt(map, x, y);
    if (tile !== Tile.Grass && tile !== Tile.Sand && tile !== Tile.Path) continue;
    if (cityAt(map.locations, x, y) !== null) continue;
    if (!reachable.has(y * map.width + x)) continue;
    if (Math.hypot(x - map.spawn.x, y - map.spawn.y) < MIN_FROM_SPAWN) continue;
    if (spots.some((s) => Math.hypot(s.tileX - x, s.tileY - y) < MIN_SPACING)) continue;
    if (map.locations.some((l) => Math.hypot(l.x - x, l.y - y) < MIN_FROM_LOCATION + (l.kind === 'city' ? 6 : 3))) continue;
    const n = spots.length;
    // Kademeler kotayla dağıtılır (yakın alan küçük, uzak alan geniş olduğu için rastgele yerleşim hep zor düşman verirdi)
    const tier = tierAt(map, x, y);
    if (tier !== TIER_QUOTA[n % TIER_QUOTA.length] && tries < 45000) continue;
    spots.push({ id: `d-${n}`, element: ELEMENTS[n % ELEMENTS.length], tier, tileX: x, tileY: y });
  }
  return spots;
}

export const ENEMY_SPOTS: readonly EnemySpot[] = generateEnemySpots(generateMap());

/** Yenilen düşmanları ve geri gelme sürelerini oturumda tutar. */
export class EnemyBoard {
  private readonly defeatedAt = new Map<string, number>();

  constructor(
    private readonly now: () => number,
    private readonly respawnMs = ENEMY_RESPAWN_MS,
  ) {}

  defeat(id: string): void {
    this.defeatedAt.set(id, this.now());
  }

  isActive(id: string): boolean {
    const t = this.defeatedAt.get(id);
    if (t === undefined) return true;
    if (this.now() - t >= this.respawnMs) {
      this.defeatedAt.delete(id);
      return true;
    }
    return false;
  }
}
