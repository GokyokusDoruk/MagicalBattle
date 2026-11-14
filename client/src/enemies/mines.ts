import { cityAt, locationAt } from '../save/cityEntry';
import { generateMap, reachableSet, tileAt, type WorldMap } from '../world/generateMap';
import { Tile } from '../world/tiles';
import { ELEMENTS, type Element } from '../battle/damage/elements';
import { tierAt, ENEMY_SPOTS, type EnemySpot } from './spots';
import type { Tier } from './catalog';

/**
 * Madenler (Task 30): her şehrin çevresinde dört element madeni (ateş, hava, toprak, su). Girince **3 düşmanla peş
 * peşe** savaşılır (can savaşlar arasında taşınır); her zaferde ganimet düşer, sonuncusu daha güçlüdür. Maden
 * **10 dakika** (oyun süresiyle, oturumda) dinlenir.
 */

export const MINE_STAGES = 3;
export const MINE_COOLDOWN_MS = 10 * 60 * 1000;
/** Maden ganimetinin düşme şansı çarpanı (dünya düşmanına göre) */
export const MINE_DROP_BOOST = 1.5;

export interface MineSpot {
  id: string;
  cityId: string;
  element: Element;
  name: string;
  tileX: number;
  tileY: number;
}

/** Elementin şehre göre yönü: köşegen (kapıdaki yol ve surlar açık kalır). */
const OFFSETS: Record<Element, { x: number; y: number }> = {
  fire: { x: 11, y: -11 },
  air: { x: -11, y: -11 },
  earth: { x: -11, y: 11 },
  water: { x: 11, y: 11 },
};

const ELEMENT_LABEL: Record<Element, string> = { fire: 'Ateş', air: 'Hava', earth: 'Toprak', water: 'Su' };

/** Şehir başına dört madeni, köşegen uzaklarda en yakın uygun karoya yerleştirir. */
export function generateMines(map: WorldMap): MineSpot[] {
  const reachable = reachableSet(map, map.spawn);
  const taken: { x: number; y: number }[] = ENEMY_SPOTS.map((e) => ({ x: e.tileX, y: e.tileY }));
  const ok = (x: number, y: number): boolean => {
    const t = tileAt(map, x, y);
    if (t !== Tile.Grass && t !== Tile.Sand) return false;
    if (cityAt(map.locations, x, y) !== null || locationAt(map.locations, x, y) !== null) return false;
    if (!reachable.has(y * map.width + x)) return false;
    if (x < 4 || y < 4 || x > map.width - 5 || y > map.height - 5) return false;
    return !taken.some((p) => Math.hypot(p.x - x, p.y - y) < 4);
  };
  const mines: MineSpot[] = [];
  for (const city of map.locations.filter((l) => l.kind === 'city')) {
    for (const element of ELEMENTS) {
      const o = OFFSETS[element];
      let found: { x: number; y: number } | null = null;
      for (let r = 0; r <= 10 && !found; r++) {
        for (let dy = -r; dy <= r && !found; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const x = city.x + o.x + dx;
            const y = city.y + o.y + dy;
            if (ok(x, y)) {
              found = { x, y };
              break;
            }
          }
        }
      }
      if (!found) continue;
      taken.push(found);
      mines.push({ id: `maden-${city.id}-${element}`, cityId: city.id, element, name: `${city.name.split(' ')[0]} ${ELEMENT_LABEL[element]} Madeni`, tileX: found.x, tileY: found.y });
    }
  }
  return mines;
}

export const MINE_SPOTS: readonly MineSpot[] = generateMines(generateMap());

/** Madendeki üç düşman: yerin kademesinden başlar, sonuncusu bir kademe güçlüdür (en çok 4). */
export function mineEnemies(map: WorldMap, mine: MineSpot): EnemySpot[] {
  const base = tierAt(map, mine.tileX, mine.tileY);
  return Array.from({ length: MINE_STAGES }, (_, i) => ({
    id: `${mine.id}-${i}`,
    element: mine.element,
    tier: Math.min(4, base + (i === MINE_STAGES - 1 ? 1 : 0)) as Tier,
    tileX: mine.tileX,
    tileY: mine.tileY,
  }));
}

/** Madenlerin dinlenme sürelerini oturumda tutar. */
export class MineBoard {
  private readonly startedAt = new Map<string, number>();

  constructor(
    private readonly now: () => number,
    private readonly cooldownMs = MINE_COOLDOWN_MS,
  ) {}

  /** Maden savaşı başladı: dinlenme süresi işler. */
  start(id: string): void {
    this.startedAt.set(id, this.now());
  }

  /** Kalan dinlenme süresi (ms); hazırsa 0. */
  cooldownLeftMs(id: string): number {
    const t = this.startedAt.get(id);
    if (t === undefined) return 0;
    const left = t + this.cooldownMs - this.now();
    if (left <= 0) {
      this.startedAt.delete(id);
      return 0;
    }
    return left;
  }

  isReady(id: string): boolean {
    return this.cooldownLeftMs(id) === 0;
  }
}
