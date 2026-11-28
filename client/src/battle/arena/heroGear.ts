import { getItem, type GearSlot } from '../../economy/items';
import { getWand } from '../../wands/catalog';
import type { HeroGear } from './heroModel';

/**
 * Faz 7: oyuncunun kuşandıklarından görünüm: cüppe, şapka, eldiven, pantolon, kolye ve kuşanılı asa (element ve nadirlik).
 * Saf fonksiyon: arayüzden ve 3D'den bağımsız, testlenebilir.
 */
export function heroGearFrom(equipped: Readonly<Partial<Record<GearSlot, string>>>, wandId: string | null): HeroGear {
  const look = (slot: GearSlot) => {
    const id = equipped[slot];
    const item = id ? getItem(id) : undefined;
    return item?.element && item.rarity ? { element: item.element, rarity: item.rarity } : undefined;
  };
  const wand = wandId ? getWand(wandId) : undefined;
  const gear: HeroGear = {};
  for (const slot of ['robe', 'hat', 'gloves', 'pants', 'necklace'] as const) {
    const l = look(slot);
    if (l) gear[slot] = l;
  }
  if (wand) gear.wand = { element: wand.element, rarity: wand.rarity };
  return gear;
}
