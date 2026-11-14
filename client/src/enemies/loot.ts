import { ELEMENTS } from '../battle/damage/elements';
import { MAX_WAND_LEVEL, ROLES, makeWand, type Rarity } from '../wands/catalog';
import { GEAR_SLOT_LIST, MAX_GEAR_LEVEL, equipmentId } from '../economy/equipment';
import { ENEMY_KINDS, enemyStats, type Tier } from './catalog';
import type { Element } from '../battle/damage/elements';

/**
 * Düşman ganimeti (Task 28): karışık paket. Her zaman para ve XP; ayrıca malzeme, can iksiri, ekipman ve asa şansla
 * düşer. Ekipman ve asada **nadirlik arttıkça düşme şansı azalır**; Destansı (4) ve üstü çok nadirdir. Karanlık yol
 * ganimet oranını artırır (`dropRateMultiplier`, 1.0-1.3). Kademe yükseldikçe yüksek nadirliğin payı biraz artar.
 */

/** Nadirlik ağırlıkları (Sıradan → Efsanevi): her basamakta yaklaşık yarıdan fazla düşer */
export const RARITY_WEIGHTS: Readonly<Record<Rarity, number>> = { 1: 60, 2: 25, 3: 10, 4: 3.5, 5: 1.2, 6: 0.3 };

/** Temel düşme şansları (çarpan ve kademe öncesi) */
export const DROP_CHANCE = { material: 0.7, potion: 0.2, gear: 0.18, wand: 0.08 } as const;

/** Her kademenin yüksek nadirliklere verdiği ek ağırlık çarpanı (nadirlik-1 kuvveti) */
export const TIER_RARITY_BOOST = 0.3;

export interface LootResult {
  money: number;
  xp: number;
  /** Ticari eşya, iksir ve ekipman: eşya kimliği → adet */
  items: Record<string, number>;
  /** Asalar: asa kimliği → adet */
  wands: Record<string, number>;
}

/** Bir nadirliğin ağırlıklı seçilme olasılığı (kademe etkisiyle); toplamı 1. */
export function rarityOdds(tier: Tier): Record<Rarity, number> {
  const raw = {} as Record<Rarity, number>;
  let sum = 0;
  for (const r of [1, 2, 3, 4, 5, 6] as const) {
    raw[r] = RARITY_WEIGHTS[r] * (1 + TIER_RARITY_BOOST * (tier - 1)) ** (r - 1);
    sum += raw[r];
  }
  for (const r of [1, 2, 3, 4, 5, 6] as const) raw[r] /= sum;
  return raw;
}

export function rollRarity(rand: () => number, tier: Tier): Rarity {
  const odds = rarityOdds(tier);
  let x = rand();
  for (const r of [1, 2, 3, 4, 5, 6] as const) {
    x -= odds[r];
    if (x < 0) return r;
  }
  return 1;
}

const add = (m: Record<string, number>, id: string, n = 1): void => {
  m[id] = (m[id] ?? 0) + n;
};

/**
 * Bir düşmanın ganimetini zarlar. `dropRate` ahlak yolundan gelen çarpandır (karanlık yolda > 1); malzeme, iksir,
 * ekipman ve asa şanslarını (üst sınır %100) çarpar. `playerLevel` asanın seviye üst sınırını belirler.
 */
export function rollLoot(element: Element, tier: Tier, playerLevel: number, dropRate: number, rand: () => number): LootResult {
  const stats = enemyStats(element, tier);
  const chance = (base: number): number => Math.min(1, base * Math.max(0, dropRate));
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
  const items: Record<string, number> = {};
  const wands: Record<string, number> = {};

  if (rand() < chance(DROP_CHANCE.material)) add(items, ENEMY_KINDS[element].material, 1 + Math.floor(rand() * 2));
  if (rand() < chance(DROP_CHANCE.potion)) add(items, tier >= 3 ? 'iksir-orta' : 'iksir-kucuk');
  if (rand() < chance(DROP_CHANCE.gear)) {
    // Çoğunlukla düşmanın kendi elementinden
    const el = rand() < 0.6 ? element : pick(ELEMENTS);
    const gearCap = Math.min(MAX_GEAR_LEVEL, Math.max(1, Math.floor(playerLevel)) + 2);
    add(items, equipmentId(pick(GEAR_SLOT_LIST), el, rollRarity(rand, tier), 1 + Math.floor(rand() * gearCap)));
  }
  if (rand() < chance(DROP_CHANCE.wand)) {
    const cap = Math.min(MAX_WAND_LEVEL, Math.max(1, Math.floor(playerLevel)) + 2);
    const el = rand() < 0.6 ? element : pick(ELEMENTS);
    add(wands, makeWand({ element: el, role: pick(ROLES), rarity: rollRarity(rand, tier), level: 1 + Math.floor(rand() * cap) }).id);
  }

  return { money: stats.money, xp: stats.xp, items, wands };
}
