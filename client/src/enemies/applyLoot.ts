import type { GroundLoot } from '../world/groundLoot';
import type { PlayerState } from '../economy/player';
import type { WandInventory } from '../wands/inventory';
import type { LootResult } from './loot';

export interface LootOutcome {
  gold: number;
  xp: number;
  levelsGained: number;
  /** Çantaya giren eşya ve asa adedi */
  taken: number;
  /** Çantaya sığmayıp yere bırakılan eşya ve asa adedi (10 dakika kalır) */
  dropped: number;
  /** Çantaya giren her şeyin kimliği ve adedi (bildirim için) */
  items: Record<string, number>;
  wands: Record<string, number>;
}

/**
 * Ganimeti oyuncuya verir: altın ve XP doğrudan; eşya ve asa çantaya, sığmayanlar savaşın yapıldığı karoya (yere)
 * bırakılır ve 10 dakika bekler.
 */
export function applyLoot(
  loot: LootResult,
  hero: PlayerState,
  wands: WandInventory,
  ground: GroundLoot,
  tileX: number,
  tileY: number,
): LootOutcome {
  hero.addGold(loot.gold);
  const levelsGained = hero.addXp(loot.xp);
  const out: LootOutcome = { gold: loot.gold, xp: loot.xp, levelsGained, taken: 0, dropped: 0, items: {}, wands: {} };
  const leftItems: Record<string, number> = {};
  const leftWands: Record<string, number> = {};

  for (const [id, n] of Object.entries(loot.items)) {
    const got = hero.addItemPartial(id, n);
    if (got > 0) {
      out.items[id] = got;
      out.taken += got;
    }
    if (n - got > 0) {
      leftItems[id] = n - got;
      out.dropped += n - got;
    }
  }
  for (const [id, n] of Object.entries(loot.wands)) {
    let got = 0;
    for (let i = 0; i < n; i++) if (wands.add(id, 1)) got++;
    if (got > 0) {
      out.wands[id] = got;
      out.taken += got;
    }
    if (n - got > 0) {
      leftWands[id] = n - got;
      out.dropped += n - got;
    }
  }
  if (out.dropped > 0) ground.drop(tileX, tileY, { items: leftItems, wands: leftWands });
  return out;
}
