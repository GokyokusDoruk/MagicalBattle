import { ELEMENTS, type Element } from '../battle/damage/elements';
import { cityAt, locationAt } from '../save/cityEntry';
import { generateMap, reachableSet, tileAt, type WorldMap } from '../world/generateMap';
import { Tile } from '../world/tiles';
import type { Tier } from './catalog';
import { enemyStats } from './catalog';
import { MINE_SPOTS } from './mines';
import { difficultyMultiplier, rollLoot, type LootResult } from './loot';
import { ENEMY_SPOTS, tierAt, type EnemySpot } from './spots';

/**
 * Arena (Task 48): her şehrin yanında bir arena. Girince **5 rakiple peş peşe** dövüşülür (can savaşlar arasında taşınır).
 * Ödül **toplam galibiyet sayısına** göre büyür ve savaşlar bitince bir kerede verilir: ilk yenilgide (ya da "Kaç" denince) arena biter
 * ve o ana kadarki galibiyetlerin ödülü ödenir. Yenilgi ölüm değildir; can çeyreğe iner. Arena **15 dakika** dinlenir (oturumda).
 */

export const ARENA_STAGES = 5;
export const ARENA_COOLDOWN_MS = 15 * 60 * 1000;
/** Her galibiyetin ödül çarpanı (rakibin para ve XP'sine göre); ilerledikçe artar */
export const ARENA_WIN_MULTIPLIERS: readonly number[] = [1.5, 2, 3, 4, 6];
/** Kaç galibiyette kaç ganimet zarı (ekipman, asa, ticari mal): [galibiyet sayısı, ganimet şansı çarpanı] */
export const ARENA_LOOT_ROLLS: readonly (readonly [number, number])[] = [
  [2, 1.5],
  [4, 2],
  [5, 3.5],
];
/** Yenilgiden ya da kaçıştan sonra canın azami cana oranı */
export const ARENA_DEFEAT_HP_FRACTION = 0.25;

export interface ArenaSpot {
  id: string;
  cityId: string;
  name: string;
  tileX: number;
  tileY: number;
}

/** Arena şehrin doğusunda durur (maden köşegenlerinden ve kapıdaki yoldan uzak). */
const OFFSET = { x: 17, y: 0 };

export function generateArenas(map: WorldMap): ArenaSpot[] {
  const reachable = reachableSet(map, map.spawn);
  const taken: { x: number; y: number }[] = [...ENEMY_SPOTS.map((e) => ({ x: e.tileX, y: e.tileY })), ...MINE_SPOTS.map((m) => ({ x: m.tileX, y: m.tileY }))];
  const ok = (x: number, y: number): boolean => {
    const t = tileAt(map, x, y);
    if (t !== Tile.Grass && t !== Tile.Sand) return false;
    if (cityAt(map.locations, x, y) !== null || locationAt(map.locations, x, y) !== null) return false;
    if (!reachable.has(y * map.width + x)) return false;
    if (x < 4 || y < 4 || x > map.width - 5 || y > map.height - 5) return false;
    return !taken.some((p) => Math.hypot(p.x - x, p.y - y) < 5);
  };
  const arenas: ArenaSpot[] = [];
  for (const city of map.locations.filter((l) => l.kind === 'city')) {
    let found: { x: number; y: number } | null = null;
    for (let r = 0; r <= 12 && !found; r++) {
      for (let dy = -r; dy <= r && !found; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = city.x + OFFSET.x + dx;
          const y = city.y + OFFSET.y + dy;
          if (ok(x, y)) {
            found = { x, y };
            break;
          }
        }
      }
    }
    if (!found) continue;
    taken.push(found);
    arenas.push({ id: `arena-${city.id}`, cityId: city.id, name: `${city.name.split(' ')[0]} Arenası`, tileX: found.x, tileY: found.y });
  }
  return arenas;
}

export const ARENA_SPOTS: readonly ArenaSpot[] = generateArenas(generateMap());

/**
 * Arenadaki beş rakip: elementler karışık (arenanın sırasına göre dönüşümlü), kademe yerin kademesinden başlar ve ilerledikçe artar
 * (1., 2.: yerin kademesi; 3., 4.: +1; 5.: +2; en çok 4).
 */
export function arenaFoes(map: WorldMap, arena: ArenaSpot): EnemySpot[] {
  const base = tierAt(map, arena.tileX, arena.tileY);
  const start = arena.id.length % ELEMENTS.length;
  const bump = [0, 0, 1, 1, 2];
  return Array.from({ length: ARENA_STAGES }, (_, i) => ({
    id: `${arena.id}-${i}`,
    element: ELEMENTS[(start + i) % ELEMENTS.length] as Element,
    tier: Math.min(4, base + bump[i]) as Tier,
    tileX: arena.tileX,
    tileY: arena.tileY,
  }));
}

export interface ArenaPayout {
  wins: number;
  money: number;
  xp: number;
  /** Ganimet zarlarından düşenler (ekipman, asa, ticari mal) */
  loot: LootResult;
}

/** Yalnızca para ve XP'nin hesabı (zar yok): galibiyet sayısına göre toplam. Önizleme için de kullanılır. */
export function arenaMoneyXp(foes: readonly EnemySpot[], wins: number, playerLevel: number): { money: number; xp: number } {
  let money = 0;
  let xp = 0;
  for (let i = 0; i < Math.min(wins, foes.length); i++) {
    const s = enemyStats(foes[i].element, foes[i].tier);
    const diff = difficultyMultiplier(s.level, playerLevel);
    money += Math.round(s.money * diff * ARENA_WIN_MULTIPLIERS[i]);
    xp += Math.round(s.xp * diff * ARENA_WIN_MULTIPLIERS[i]);
  }
  return { money, xp };
}

/**
 * Galibiyet sayısına göre ödeme: para ve XP her galibiyetle büyür; 2, 4 ve 5 galibiyette birer ganimet zarı daha atılır (sonuncusu
 * büyük ödül). Hiç galibiyet yoksa ödeme boştur.
 */
export function arenaPayout(foes: readonly EnemySpot[], wins: number, playerLevel: number, dropRate: number, rand: () => number): ArenaPayout {
  const w = Math.max(0, Math.min(foes.length, Math.floor(wins)));
  const { money, xp } = arenaMoneyXp(foes, w, playerLevel);
  const loot: LootResult = { money, xp, items: {}, wands: {} };
  for (const [need, boost] of ARENA_LOOT_ROLLS) {
    if (w < need) continue;
    const foe = foes[Math.min(foes.length, need) - 1];
    const roll = rollLoot(foe.element, foe.tier, playerLevel, dropRate * boost, rand, { goodsBonus: true });
    for (const [id, n] of Object.entries(roll.items)) loot.items[id] = (loot.items[id] ?? 0) + n;
    for (const [id, n] of Object.entries(roll.wands)) loot.wands[id] = (loot.wands[id] ?? 0) + n;
  }
  return { wins: w, money, xp, loot };
}
