import { ELEMENTS } from '../battle/damage/elements';
import { MAX_WAND_LEVEL, ROLES, makeWand, type Rarity } from '../wands/catalog';
import { GEAR_SLOT_LIST, MAX_GEAR_LEVEL, equipmentId } from '../economy/equipment';
import { ENEMY_KINDS, enemyStats, type Tier } from './catalog';
import type { Element } from '../battle/damage/elements';

/**
 * Düşman ganimeti (Task 28, v2 Task 37): karışık paket. Her zaman para ve XP; ayrıca ticari mal, ekipman ve asa şansla
 * düşer (can iksiri artık düşmez). Ekipman ve asada **nadirlik arttıkça düşme şansı azalır**; Destansı (4) ve üstü çok nadirdir. Karanlık yol
 * ganimet oranını artırır (`dropRateMultiplier`, 1.0-1.3). Kademe yükseldikçe yüksek nadirliğin payı biraz artar.
 */

/** Nadirlik ağırlıkları (Sıradan → Efsanevi): her basamakta yaklaşık yarıdan fazla düşer */
export const RARITY_WEIGHTS: Readonly<Record<Rarity, number>> = { 1: 60, 2: 25, 3: 10, 4: 3.5, 5: 1.2, 6: 0.3 };

/** Temel düşme şansları (zorluk ve ahlak çarpanları öncesi). Para ve XP her zaman düşer. */
export const DROP_CHANCE = { goods: 0.6, goodsBonus: 0.6, gear: 0.14, wand: 0.07 } as const;

/** Bir savaştan düşebilecek en çok ekipman + asa sayısı, ve ikinci parçanın şansının ilkine oranı */
export const MAX_PIECES = 2;
export const SECOND_PIECE = 0.25;

/** Her kademenin yüksek nadirliklere verdiği ek ağırlık çarpanı (nadirlik-1 kuvveti) */
export const TIER_RARITY_BOOST = 0.3;

export interface LootResult {
  money: number;
  xp: number;
  /** Ticari mal ve ekipman: eşya kimliği → adet */
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

/** Zorluk çarpanının sınırları: düşman oyuncudan çok zayıfsa ganimet azalır, çok güçlüyse artar. */
export const DIFFICULTY_MIN = 0.7;
export const DIFFICULTY_MAX = 1.6;

/**
 * Savaşın zorluğuna göre ganimet çarpanı: düşman seviyesi oyuncu seviyesine eşitse 1; düşman iki kat güçlüyse 1.3;
 * yarısı kadarsa 0.85. Para, XP ve eşya şanslarının hepsini çarpar.
 */
export function difficultyMultiplier(enemyLevel: number, playerLevel: number): number {
  const ratio = enemyLevel / Math.max(1, playerLevel);
  return Math.min(DIFFICULTY_MAX, Math.max(DIFFICULTY_MIN, 0.7 + 0.3 * ratio));
}

export interface LootOptions {
  /** Maden gibi zengin yerlerde fazladan ticari mal şansı */
  goodsBonus?: boolean;
}

/**
 * Bir düşmanın ganimetini zarlar. Her zaman **para ve XP** (zorluğa göre çarpılır). Şansla: **ticari mal**, **ekipman**
 * ve **asa**; ekipman ve asada en çok **2 parça** düşer (iki ekipman, iki asa ya da biri biri). `dropRate` ahlak yolundan
 * ve ateş asasından gelen çarpandır; tüm şansları (üst sınır %100) çarpar. `playerLevel` eşya seviyesinin üst sınırını belirler.
 */
export function rollLoot(element: Element, tier: Tier, playerLevel: number, dropRate: number, rand: () => number, options: LootOptions = {}): LootResult {
  const stats = enemyStats(element, tier);
  const diff = difficultyMultiplier(stats.level, playerLevel);
  const chance = (base: number): number => Math.min(1, base * diff * Math.max(0, dropRate));
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
  const items: Record<string, number> = {};
  const wands: Record<string, number> = {};
  const goodOf = (el: Element): string => ENEMY_KINDS[el].material;

  // Ticari mal: çoğunlukla düşmanın elementinin malı; yüksek kademede daha çok
  if (rand() < chance(DROP_CHANCE.goods)) {
    const el = rand() < 0.6 ? element : pick(ELEMENTS);
    add(items, goodOf(el), 1 + (tier >= 3 ? 1 : 0) + (rand() < 0.3 ? 1 : 0));
  }
  if (options.goodsBonus && rand() < chance(DROP_CHANCE.goodsBonus)) add(items, goodOf(pick(ELEMENTS)), 1 + Math.floor(rand() * 2));

  // Ekipman ve asa: her biri için ilk parça `şans`, ikinci parça onun dörtte biri; toplam MAX_PIECES ile sınırlı
  type Piece = { kind: 'gear' | 'wand'; id: string; rarity: Rarity };
  const pieces: Piece[] = [];
  const gearCap = Math.min(MAX_GEAR_LEVEL, Math.max(1, Math.floor(playerLevel)) + 2);
  const wandCap = Math.min(MAX_WAND_LEVEL, Math.max(1, Math.floor(playerLevel)) + 2);
  for (let n = 0; n < 2; n++) {
    if (rand() < chance(DROP_CHANCE.gear) * (n === 0 ? 1 : SECOND_PIECE)) {
      const el = rand() < 0.6 ? element : pick(ELEMENTS);
      const rarity = rollRarity(rand, tier);
      pieces.push({ kind: 'gear', rarity, id: equipmentId(pick(GEAR_SLOT_LIST), el, rarity, 1 + Math.floor(rand() * gearCap)) });
    }
    if (rand() < chance(DROP_CHANCE.wand) * (n === 0 ? 1 : SECOND_PIECE)) {
      const el = rand() < 0.6 ? element : pick(ELEMENTS);
      const rarity = rollRarity(rand, tier);
      pieces.push({ kind: 'wand', rarity, id: makeWand({ element: el, role: pick(ROLES), rarity, level: 1 + Math.floor(rand() * wandCap) }).id });
    }
  }
  // En nadir parçalar kalır
  pieces.sort((a, b) => b.rarity - a.rarity);
  for (const p of pieces.slice(0, MAX_PIECES)) add(p.kind === 'gear' ? items : wands, p.id);

  return { money: Math.round(stats.money * diff), xp: Math.round(stats.xp * diff), items, wands };
}
