import { ARMOR_CAP } from '../battle/damage/config';
import type { Element } from '../battle/damage/elements';
import { ARMOR_SLOTS, GEAR_ELEMENT_MATCH } from './equipment';
import { getItem, type GearSlot } from './items';

/** Bir büyü için giyilen ekipmandan gelen etki: zırh (hasar azaltma) ve büyü süresi (yüzük). */
export interface GearEffects {
  /** Toplam zırh (0-1, ARMOR_CAP ile sınırlı) */
  armor: number;
  /** Çizim süresine eklenen saniye (yüzük) */
  timeBonusSec: number;
}

/** (büyünün elementi) → o büyü için ekipman etkisi; savaşçıya verilir, her turda seçilen elemente göre çalışır */
export type GearResolver = (element: Element) => GearEffects;

export type EquippedMap = Readonly<Partial<Record<GearSlot, string>>>;

/**
 * Seçilen büyünün elementiyle aynı elementteki zırh parçaları ve yüzük %50 daha güçlüdür. Elementi verilmezse
 * eşleşme yoktur (taban değer). Zırh toplamı ARMOR_CAP'i aşmaz.
 */
export function gearEffects(equipped: EquippedMap, element?: Element): GearEffects {
  let armor = 0;
  for (const slot of ARMOR_SLOTS) {
    const item = equipped[slot] ? getItem(equipped[slot]!) : undefined;
    if (!item?.armor) continue;
    armor += item.armor * (element !== undefined && item.element === element ? GEAR_ELEMENT_MATCH : 1);
  }
  const ring = equipped.ring ? getItem(equipped.ring) : undefined;
  const time = ring?.timeBonus ?? 0;
  const timeBonusSec = time * (element !== undefined && ring?.element === element ? GEAR_ELEMENT_MATCH : 1);
  return { armor: Math.min(ARMOR_CAP, armor), timeBonusSec: Math.round(timeBonusSec * 1000) / 1000 };
}

/** Ayakkabıdan gelen yürüme hızı bonusu (0.1 = +%10), şehir bonusu hariç. */
export function bootsSpeed(equipped: EquippedMap): number {
  const boots = equipped.boots ? getItem(equipped.boots) : undefined;
  return boots?.speed ?? 0;
}
