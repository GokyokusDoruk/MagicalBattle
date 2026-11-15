import { ARENA_LOOT_ROLLS, arenaMoneyXp } from './arena';
import type { EnemySpot } from './spots';
import { enemyStats, type Tier } from './catalog';
import type { Element } from '../battle/damage/elements';
import { DROP_CHANCE, difficultyMultiplier } from './loot';
import { CHEST_GUARDS, type ChestSpot } from './chests';
import { MINE_DROP_BOOST } from './mines';

/**
 * Ganimet önizlemesi (Task 53): seçmeli yerlerde (dünya düşmanı, maden, sandık; arena eklenince o da) "ne kazanacağız" bilgisi. Para ve XP kesindir (zorluk çarpanı dahil);
 * ticari mal, ekipman ve asa şanslarla düşer. Şanslar `rollLoot` ile aynı formülle hesaplanır: temel şans × zorluk × `dropRate`.
 */

const pct = (v: number): string => `%${Math.round(Math.min(1, Math.max(0, v)) * 100)}`;

export interface DropOdds {
  money: number;
  xp: number;
  goods: number;
  gear: number;
  wand: number;
}

/** Tek bir düşmanın ganimeti: para, XP ve düşme şansları. `boost` maden/arena gibi yerlerin ek şans çarpanı. */
export function dropOdds(element: Element, tier: Tier, playerLevel: number, dropRate: number, boost = 1): DropOdds {
  const s = enemyStats(element, tier);
  const diff = difficultyMultiplier(s.level, playerLevel);
  const chance = (base: number): number => Math.min(1, base * diff * Math.max(0, dropRate) * boost);
  return { money: Math.round(s.money * diff), xp: Math.round(s.xp * diff), goods: chance(DROP_CHANCE.goods), gear: chance(DROP_CHANCE.gear), wand: chance(DROP_CHANCE.wand) };
}

const oddsText = (o: Pick<DropOdds, 'goods' | 'gear' | 'wand'>): string => `ticari mal ${pct(o.goods)} · ekipman ${pct(o.gear)} · asa ${pct(o.wand)}`;

/** Dünya düşmanı: "Kazanırsan: 27 Kor, 54 XP · ticari mal %60 · ekipman %14 · asa %7" */
export function enemyLootHint(element: Element, tier: Tier, playerLevel: number, dropRate: number, currencyName: string): string {
  const o = dropOdds(element, tier, playerLevel, dropRate);
  return `Kazanırsan: ${o.money} ${currencyName}, ${o.xp} XP · ${oddsText(o)}`;
}

/** Maden: üç düşmanın toplam parası ve XP'si; her zaferde şanslar maden çarpanıyla (×1.5). */
export function mineLootHint(foes: readonly EnemySpot[], playerLevel: number, dropRate: number, currencyName: string): string {
  let money = 0;
  let xp = 0;
  for (const f of foes) {
    const o = dropOdds(f.element, f.tier, playerLevel, dropRate, MINE_DROP_BOOST);
    money += o.money;
    xp += o.xp;
  }
  const last = foes[foes.length - 1];
  const odds = dropOdds(last.element, last.tier, playerLevel, dropRate, MINE_DROP_BOOST);
  return `Üç zaferin toplamı: ${money} ${currencyName}, ${xp} XP · her zaferde ${oddsText(odds)}`;
}

/** Sandık: para ve XP kesin, kesin bir ekipman, 1-3 ticari mal, %50 asa. */
export function chestLootHint(chest: Pick<ChestSpot, 'element' | 'tier'>, dropRate: number, currencyName: string): string {
  const s = enemyStats(chest.element, chest.tier);
  return `Sandıktan (${CHEST_GUARDS} muhafızı yenince): ${s.money * 3} ${currencyName}, ${s.xp * 2} XP · kesin 1 ekipman · 1-3 ticari mal · asa ${pct(0.5 * dropRate)}`;
}

/** Arena: her galibiyet sayısında toplam para/XP ve ek ganimet zarlarının şansları (2, 4 ve 5 galibiyette). */
export function arenaLootHints(foes: readonly EnemySpot[], playerLevel: number, dropRate: number, currencyName: string): string[] {
  return ARENA_LOOT_ROLLS.map(([need, boost]) => {
    const foe = foes[Math.min(foes.length, need) - 1];
    const o = dropOdds(foe.element, foe.tier, playerLevel, dropRate, boost);
    const total = arenaMoneyXp(foes, need, playerLevel);
    return `${need} galibiyet: ${total.money} ${currencyName}, ${total.xp} XP · ${oddsText(o)}`;
  });
}
