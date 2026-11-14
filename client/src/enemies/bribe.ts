import type { Element } from '../battle/damage/elements';
import { enemyStats, type Tier } from './catalog';

/**
 * Rüşvet (Task 40): bir düşmandan kaçmanın yolu para vermektir. Para verilirse savaş olmaz ve düşman haritadan kaybolur
 * (sabit düşman yenilmiş gibi bir süre sonra geri gelir; çalılık karşılaşması hiç olmamış sayılır). Bedel düşmanın ganimet
 * parasının `BRIBE_MULTIPLIER` katıdır ve bulunduğun bölgenin para biriminden ödenir. Boss, maden ve sandık muhafızlarına
 * rüşvet verilmez.
 */
export const BRIBE_MULTIPLIER = 3;
export const BRIBE_MIN = 10;

export function bribeCost(element: Element, tier: Tier): number {
  return Math.max(BRIBE_MIN, Math.round(enemyStats(element, tier).money * BRIBE_MULTIPLIER));
}
