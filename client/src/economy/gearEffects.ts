import { ARMOR_CAP, CRIT_CAP } from '../battle/damage/config';
import type { Element } from '../battle/damage/elements';
import { ARMOR_SLOTS, CRIT_SLOTS, GEAR_SLOT_LIST, elementBonusOf } from './equipment';
import { getItem, type GearSlot } from './items';

/** Bir büyü için giyilen ekipmandan gelen etki: zırh (hasar azaltma) ve büyü süresi (yüzük). */
export interface GearEffects {
  /** Toplam zırh (0-1, ARMOR_CAP ile sınırlı) */
  armor: number;
  /** Çizim süresine eklenen saniye (yüzük, bileklik, kolye) */
  timeBonusSec: number;
  /** Kritik vuruş şansı (0-1): yüzük, bileklik ve kolyenin toplamı, CRIT_CAP ile sınırlı */
  crit: number;
  /** O büyünün elementindeki ekipman parçalarından gelen hasar bonusu (0.04 = +%4) */
  damageBonus: number;
  /** Faz 6: kolyeden gelen alan gücü (hücre) */
  areaCells?: number;
}

export const NO_GEAR: GearEffects = { armor: 0, timeBonusSec: 0, crit: 0, damageBonus: 0, areaCells: 0 };

/** (büyünün elementi) → o büyü için ekipman etkisi; savaşçıya verilir, her turda seçilen elemente göre çalışır */
export type GearResolver = (element: Element) => GearEffects;

export type EquippedMap = Readonly<Partial<Record<GearSlot, string>>>;

/**
 * Giyilen ekipmanın bir büyü için etkisi. Zırh (4 parça) toplanır, ARMOR_CAP'i aşmaz. Yüzük, bileklik ve kolyenin kritik
 * şansı ve büyü süresi toplanır (şans CRIT_CAP ile sınırlı). Elementi verilirse, kuşanılan **her** parça (9 yuva) kendi
 * elementiyle eşleşiyorsa hasar bonusu verir: %1 × nadirlik katsayısı (Sıradan 0.25 ... Mistik 1.5).
 */
export function gearEffects(equipped: EquippedMap, element?: Element): GearEffects {
  let armor = 0;
  for (const slot of ARMOR_SLOTS) {
    const item = equipped[slot] ? getItem(equipped[slot]!) : undefined;
    if (item?.armor) armor += item.armor;
  }
  let time = 0;
  let crit = 0;
  for (const slot of CRIT_SLOTS) {
    const item = equipped[slot] ? getItem(equipped[slot]!) : undefined;
    time += item?.timeBonus ?? 0;
    crit += item?.crit ?? 0;
  }
  const necklace = equipped.necklace ? getItem(equipped.necklace) : undefined;
  const areaCells = necklace?.areaCells ?? 0;
  let damageBonus = 0;
  if (element !== undefined) {
    for (const slot of GEAR_SLOT_LIST) {
      const item = equipped[slot] ? getItem(equipped[slot]!) : undefined;
      if (item?.element === element && item.rarity) damageBonus += elementBonusOf(item.rarity);
    }
  }
  return {
    armor: Math.min(ARMOR_CAP, armor),
    timeBonusSec: Math.round(time * 1000) / 1000,
    crit: Math.min(CRIT_CAP, Math.round(crit * 1000) / 1000),
    damageBonus: Math.round(damageBonus * 10000) / 10000,
    areaCells,
  };
}

/** Ayakkabıdan gelen yürüme hızı bonusu (0.1 = +%10), şehir bonusu hariç. */
export function bootsSpeed(equipped: EquippedMap): number {
  const boots = equipped.boots ? getItem(equipped.boots) : undefined;
  return boots?.speed ?? 0;
}

/** Kendi elementinin şehrinde (ya da köyünde) ayakkabı ve çanta bu kadar güçlüdür (%50). */
export const LOCATION_BONUS = 1.5;

/** Eşyanın elementi, bulunulan konumun elementlerinden biriyse şehir bonusu geçerlidir. */
export const matchesLocation = (element: Element | undefined, elements: readonly Element[]): boolean =>
  element !== undefined && elements.includes(element);

/** Ayakkabının yürüme hızı bonusu; bulunulan konumun elementindeyse %50 daha fazla. */
export function bootsSpeedIn(equipped: EquippedMap, elements: readonly Element[]): number {
  const boots = equipped.boots ? getItem(equipped.boots) : undefined;
  if (!boots?.speed) return 0;
  return boots.speed * (matchesLocation(boots.element, elements) ? LOCATION_BONUS : 1);
}
