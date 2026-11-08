import { ELEMENTS, ELEMENT_NAMES, type Element } from '../battle/damage/elements';

/** Asa kataloğu: 6 nadirlik × 4 element × saldırı/savunma = 48 asa. */

export type WandRole = 'attack' | 'defense';
export type Rarity = 1 | 2 | 3 | 4 | 5 | 6;

export const ROLES: readonly WandRole[] = ['attack', 'defense'];
export const RARITIES: readonly Rarity[] = [1, 2, 3, 4, 5, 6];
export const MAX_RARITY: Rarity = 6;

export const RARITY_NAMES: Record<Rarity, string> = {
  1: 'Sıradan',
  2: 'Gelişmiş',
  3: 'Nadir',
  4: 'Destansı',
  5: 'Efsanevi',
  6: 'Mistik',
};

export const RARITY_COLORS: Record<Rarity, string> = {
  1: '#cbd5e1',
  2: '#86efac',
  3: '#7dd3fc',
  4: '#c4b5fd',
  5: '#fcd34d',
  6: '#f9a8d4',
};

export const ROLE_NAMES: Record<WandRole, string> = { attack: 'Saldırı Asası', defense: 'Savunma Asası' };

/** Aynı asadan bu kadarı bir üst nadirliğe birleşir. */
export const SYNTHESIS_COUNT = 5;
/** Tüccarlar yalnızca Sıradan asa satar (altın). Üst nadirlikler birleştirmeyle elde edilir. */
export const COMMON_WAND_PRICE = 40;
/** Tek bir asadan taşınabilecek en çok adet */
export const MAX_WAND_STACK = 999;

/** Saldırı asası: büyünün taban gücünü bu çarpanla çarpar (Sıradan x1.00, Mistik x1.75). */
export const ATTACK_POWER_PER_RARITY = 0.15;
/** Savunma asası: alınan hasarı azaltır (Sıradan -%0, Mistik -%20). */
export const DEFENSE_REDUCTION_PER_RARITY = 0.04;

export interface WandDef {
  id: string;
  element: Element;
  role: WandRole;
  rarity: Rarity;
  name: string;
  /** Saldırı asasında taban güç çarpanı; savunma asasında 1 */
  powerMultiplier: number;
  /** Savunma asasında alınan hasar çarpanı; saldırı asasında 1 */
  takenMultiplier: number;
}

export const wandId = (element: Element, role: WandRole, rarity: Rarity): string => `wand-${element}-${role}-${rarity}`;

const round = (n: number): number => Math.round(n * 1000) / 1000;

export const WANDS: readonly WandDef[] = RARITIES.flatMap((rarity) =>
  ELEMENTS.flatMap((element) =>
    ROLES.map((role) => ({
      id: wandId(element, role, rarity),
      element,
      role,
      rarity,
      name: `${RARITY_NAMES[rarity]} ${ELEMENT_NAMES[element]} ${ROLE_NAMES[role]}`,
      powerMultiplier: role === 'attack' ? round(1 + ATTACK_POWER_PER_RARITY * (rarity - 1)) : 1,
      takenMultiplier: role === 'defense' ? round(1 - DEFENSE_REDUCTION_PER_RARITY * (rarity - 1)) : 1,
    })),
  ),
);

const BY_ID = new Map(WANDS.map((w) => [w.id, w]));
export const getWand = (id: string): WandDef | undefined => BY_ID.get(id);

/** Tüccar listesinde elementlerin sırası */
export const ELEMENT_ORDER_FOR_SHOP: readonly Element[] = ELEMENTS;

/** Kuşanma yuvası: element ve role göre bir asa (8 yuva). */
export type SlotKey = `${Element}-${WandRole}`;
export const slotKey = (element: Element, role: WandRole): SlotKey => `${element}-${role}`;
export const SLOT_KEYS: readonly SlotKey[] = ELEMENTS.flatMap((e) => ROLES.map((r) => slotKey(e, r)));

/** Kısa Türkçe etki açıklaması */
export function describeWand(w: WandDef): string {
  if (w.role === 'attack') {
    const pct = Math.round((w.powerMultiplier - 1) * 100);
    return pct === 0 ? 'Taban güç değişmez' : `Büyü taban gücü +%${pct}`;
  }
  const pct = Math.round((1 - w.takenMultiplier) * 100);
  return pct === 0 ? 'Alınan hasar değişmez' : `Alınan hasar -%${pct}`;
}
