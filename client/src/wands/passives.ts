import type { Element } from '../battle/damage/elements';
import { ELEMENT_NAMES } from '../battle/damage/elements';
import type { WandInventory } from './inventory';

/**
 * Asa pasifleri (Task 38): kuşanılı asanın elementi oyuncuya savaş dışında geçerli bir pasif verir. Asa seviye şartını
 * karşılıyorsa (kullanılabilirse) geçerlidir; nadirlik ve seviyeden bağımsızdır.
 *  - Hava: yürüme hızı +%25
 *  - Su: her saniye azami canın %0.5'i kadar can yenilenir (hareket etmek gerekmez; savaşta işlemez)
 *  - Ateş: eşya (ekipman, asa, ticari mal) düşme şansı +%10
 *  - Toprak: taşıma kapasitesi (asa, eşya, kuşanılabilir) +%25
 */

export interface WandPassive {
  /** Yürüme hızına eklenen oran (0.25 = +%25) */
  speed: number;
  /** Saniyede yenilenen can oranı (azami canın) */
  regenPerSec: number;
  /** Eşya düşme şansı çarpanına eklenen oran */
  dropRate: number;
  /** Taşıma kapasitesine eklenen oran */
  carry: number;
}

export const NO_PASSIVE: WandPassive = { speed: 0, regenPerSec: 0, dropRate: 0, carry: 0 };

export const WAND_PASSIVES: Readonly<Record<Element, WandPassive>> = {
  air: { ...NO_PASSIVE, speed: 0.25 },
  water: { ...NO_PASSIVE, regenPerSec: 0.005 },
  fire: { ...NO_PASSIVE, dropRate: 0.1 },
  earth: { ...NO_PASSIVE, carry: 0.25 },
};

/** Asanın elementine göre pasif; asa yoksa hiçbir pasif yok. */
export const passiveOf = (element: Element | null | undefined): WandPassive => (element ? WAND_PASSIVES[element] : NO_PASSIVE);

/** Oyuncunun şu an geçerli pasifi: kuşanılı asa varsa ve seviyesi yetiyorsa o asanınki. */
export function activePassive(wands: WandInventory): WandPassive {
  const w = wands.equippedWand;
  return w && wands.usable(w.id) ? passiveOf(w.element) : NO_PASSIVE;
}

/** Pasifin Türkçe açıklaması ("Hava asası: yürüme hızı +%25"). */
export function describePassive(element: Element): string {
  const p = WAND_PASSIVES[element];
  const who = `${ELEMENT_NAMES[element]} asası`;
  if (p.speed) return `${who}: yürüme hızı +%${Math.round(p.speed * 100)}`;
  if (p.regenPerSec) return `${who}: her saniye azami canın %${p.regenPerSec * 100} kadarı yenilenir`;
  if (p.dropRate) return `${who}: eşya düşme şansı +%${Math.round(p.dropRate * 100)}`;
  return `${who}: taşıma kapasitesi +%${Math.round(p.carry * 100)}`;
}

/**
 * Can yenileme sayacı: geçen süreye göre kesirli canı biriktirir, tam sayıya ulaşınca verir (can tam sayıdır).
 * `tick` o ana kadar biriken ve verilecek tam can miktarını döndürür.
 */
export class RegenAccumulator {
  private rest = 0;

  tick(maxHp: number, regenPerSec: number, dtSec: number): number {
    if (!(regenPerSec > 0) || !(dtSec > 0)) {
      this.rest = 0;
      return 0;
    }
    this.rest += maxHp * regenPerSec * dtSec;
    const whole = Math.floor(this.rest);
    this.rest -= whole;
    return whole;
  }

  reset(): void {
    this.rest = 0;
  }
}
