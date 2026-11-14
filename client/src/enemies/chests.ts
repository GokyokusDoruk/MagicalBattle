import { cityAt, locationAt } from '../save/cityEntry';
import { generateMap, reachableSet, tileAt, type WorldMap } from '../world/generateMap';
import { mulberry32 } from '../world/rng';
import { Tile } from '../world/tiles';
import { ELEMENTS, type Element } from '../battle/damage/elements';
import { MAX_WAND_LEVEL, ROLES, makeWand } from '../wands/catalog';
import { GEAR_SLOT_LIST, MAX_GEAR_LEVEL, equipmentId } from '../economy/equipment';
import { ENEMY_KINDS, enemyStats, type Tier } from './catalog';
import { ENEMY_SPOTS, tierAt, type EnemySpot } from './spots';
import { MINE_SPOTS } from './mines';
import { rollRarity, type LootResult } from './loot';

/**
 * Korumalı sandıklar (Task 31): haritada sabit yerlerde kapalı sandıklar. Yanına gelince **2 muhafız** peş peşe
 * savaşır (can taşınır); ikisini de yenersen sandık açılır ve **kesin** ekipman, çoğu zaman asa ve iksir düşer.
 * Sandık bir kez açılır (kayıtta `collected` içinde tutulur, bir daha çıkmaz).
 */

export const CHEST_COUNT = 12;
export const CHEST_GUARDS = 2;

export interface ChestSpot {
  id: string;
  element: Element;
  tier: Tier;
  tileX: number;
  tileY: number;
}

const MIN_FROM_SPAWN = 10;
const MIN_FROM_LOCATION = 8;
const MIN_SPACING = 9;
const BORDER = 4;

export function generateChests(map: WorldMap, seed = 777): ChestSpot[] {
  const rand = mulberry32(seed);
  const reachable = reachableSet(map, map.spawn);
  const chests: ChestSpot[] = [];
  const others = [...ENEMY_SPOTS.map((e) => ({ x: e.tileX, y: e.tileY })), ...MINE_SPOTS.map((m) => ({ x: m.tileX, y: m.tileY }))];
  for (let tries = 0; tries < 80000 && chests.length < CHEST_COUNT; tries++) {
    const x = BORDER + Math.floor(rand() * (map.width - BORDER * 2));
    const y = BORDER + Math.floor(rand() * (map.height - BORDER * 2));
    const t = tileAt(map, x, y);
    if (t !== Tile.Grass && t !== Tile.Sand) continue;
    if (cityAt(map.locations, x, y) !== null || locationAt(map.locations, x, y) !== null) continue;
    if (!reachable.has(y * map.width + x)) continue;
    if (Math.hypot(x - map.spawn.x, y - map.spawn.y) < MIN_FROM_SPAWN) continue;
    if (map.locations.some((l) => Math.hypot(l.x - x, l.y - y) < MIN_FROM_LOCATION + (l.kind === 'city' ? 6 : 2))) continue;
    if (chests.some((c) => Math.hypot(c.tileX - x, c.tileY - y) < MIN_SPACING)) continue;
    if (others.some((p) => Math.hypot(p.x - x, p.y - y) < 4)) continue;
    const n = chests.length;
    // Kademeler dönüşümlü istenir (her kademeden eşit sayıda); uygun yer çok aranıp bulunamazsa kademe şartı gevşer
    const tier = tierAt(map, x, y);
    if (tier !== ((n % 4) + 1) as Tier && tries < 60000) continue;
    chests.push({ id: `sandik-${n}`, element: ELEMENTS[n % ELEMENTS.length], tier, tileX: x, tileY: y });
  }
  return chests;
}

export const CHEST_SPOTS: readonly ChestSpot[] = generateChests(generateMap());

/** Sandığın muhafızları: sandığın elementinden, kademesinde. */
export function chestGuards(chest: ChestSpot): EnemySpot[] {
  return Array.from({ length: CHEST_GUARDS }, (_, i) => ({ id: `${chest.id}-g${i}`, element: chest.element, tier: chest.tier, tileX: chest.tileX, tileY: chest.tileY }));
}

/** Sandık ganimetinde nadirlik zarı bir kademe yüksek atılır (en çok 4): dünya düşmanından daha nadir parçalar çıkar. */
const chestTier = (t: Tier): Tier => Math.min(4, t + 1) as Tier;

/**
 * Sandığın içi: bol para ve XP, **kesin bir ekipman**, %50 asa, %70 iksir, 1-3 malzeme.
 * `dropRate` ahlak yolundan gelen çarpandır (asa ve iksir şansını artırır).
 */
export function rollChestLoot(chest: Pick<ChestSpot, 'element' | 'tier'>, playerLevel: number, dropRate: number, rand: () => number): LootResult {
  const stats = enemyStats(chest.element, chest.tier);
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
  const chance = (base: number): number => Math.min(1, base * Math.max(0, dropRate));
  const items: Record<string, number> = {};
  const wands: Record<string, number> = {};
  const add = (m: Record<string, number>, id: string, n = 1): void => {
    m[id] = (m[id] ?? 0) + n;
  };
  const tier = chestTier(chest.tier);
  const el = rand() < 0.6 ? chest.element : pick(ELEMENTS);
  const gearCap = Math.min(MAX_GEAR_LEVEL, Math.max(1, Math.floor(playerLevel)) + 3);
  add(items, equipmentId(pick(GEAR_SLOT_LIST), el, rollRarity(rand, tier), 1 + Math.floor(rand() * gearCap)));
  add(items, ENEMY_KINDS[chest.element].material, 1 + Math.floor(rand() * 3));
  if (rand() < chance(0.7)) add(items, chest.tier >= 3 ? 'iksir-orta' : 'iksir-kucuk');
  if (rand() < chance(0.5)) {
    const cap = Math.min(MAX_WAND_LEVEL, Math.max(1, Math.floor(playerLevel)) + 3);
    add(wands, makeWand({ element: rand() < 0.6 ? chest.element : pick(ELEMENTS), role: pick(ROLES), rarity: rollRarity(rand, tier), level: 1 + Math.floor(rand() * cap) }).id);
  }
  return { money: stats.money * 3, xp: stats.xp * 2, items, wands };
}
