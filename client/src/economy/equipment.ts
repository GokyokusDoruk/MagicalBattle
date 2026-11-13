import { ELEMENTS, ELEMENT_NAMES, type Element } from '../battle/damage/elements';
import { RARITIES, RARITY_NAMES, type Rarity } from '../wands/catalog';
import type { CarryBonus, GearSlot, ItemDef } from './items';

/**
 * Ekipman (Task 23): 6 yuva × 4 element × 6 nadirlik = 144 eşya. Seviye şartı yoktur, yalnızca nadirlik vardır.
 *  - Cüppe, Şapka, Pantalon: zırh (hasar azaltma). Toplam zırh üst sınırlıdır.
 *  - Çanta: taşıma kapasitesi (asa, eşya, kuşanılabilir).
 *  - Ayakkabı: yürüme hızı.
 *  - Yüzük: büyü süresi (çizim süresi uzar). Yüzük, zırh parçalarından daha çok süre verir.
 * Element bonusu: seçilen büyünün elementiyle aynı elementteki zırh ve yüzük %50 daha güçlüdür (tur başına).
 * Şehir bonusu (ayakkabı hızı, çanta kapasitesi) Task 24'te.
 */

export const GEAR_SLOT_LIST: readonly GearSlot[] = ['robe', 'hat', 'pants', 'bag', 'ring', 'boots'];
export const ARMOR_SLOTS: readonly GearSlot[] = ['robe', 'hat', 'pants'];

export const SLOT_LABELS: Record<GearSlot, string> = {
  robe: 'Cüppe',
  hat: 'Şapka',
  pants: 'Pantalon',
  bag: 'Çanta',
  ring: 'Yüzük',
  boots: 'Ayakkabı',
};

/** Eşya adında kullanılan biçim: "Ateş Cüppesi" */
const SLOT_ITEM_NAMES: Record<GearSlot, string> = {
  robe: 'Cüppesi',
  hat: 'Şapkası',
  pants: 'Pantolonu',
  bag: 'Çantası',
  ring: 'Yüzüğü',
  boots: 'Ayakkabısı',
};

/** Element eşleşirse zırh ve yüzük bu kadar güçlüdür (%50) */
export const GEAR_ELEMENT_MATCH = 1.5;

/** Nadirliğe göre (1-6) zırh değerleri (hasar azaltma, 0-1). Üç parça birlikte en çok %48 (eşleşirse %72, sınır %75). */
export const ARMOR_BY_SLOT: Record<'robe' | 'hat' | 'pants', readonly number[]> = {
  robe: [0.04, 0.06, 0.09, 0.12, 0.16, 0.2],
  hat: [0.02, 0.035, 0.05, 0.07, 0.09, 0.12],
  pants: [0.03, 0.05, 0.07, 0.1, 0.13, 0.16],
};

/** Çanta kapasitesi (asa, eşya, kuşanılabilir); hepsi tam sayı */
export const BAG_BY_RARITY: readonly CarryBonus[] = [
  { wands: 3, goods: 20, gear: 2 },
  { wands: 5, goods: 40, gear: 3 },
  { wands: 8, goods: 70, gear: 5 },
  { wands: 12, goods: 110, gear: 7 },
  { wands: 18, goods: 170, gear: 10 },
  { wands: 26, goods: 250, gear: 14 },
];

/** Ayakkabının yürüme hızına kattığı oran (0.05 = +%5) */
export const BOOTS_SPEED: readonly number[] = [0.05, 0.08, 0.12, 0.16, 0.2, 0.25];

/** Yüzüğün büyü (çizim) süresine kattığı saniye */
export const RING_TIME_SEC: readonly number[] = [0.2, 0.35, 0.5, 0.7, 0.9, 1.2];

/** Yuvaya göre taban fiyat; nadirlik başına ×2.2 */
export const BASE_PRICE: Record<GearSlot, number> = { robe: 60, hat: 40, pants: 50, bag: 100, ring: 90, boots: 70 };
export const PRICE_PER_RARITY = 2.2;

export const equipmentId = (slot: GearSlot, element: Element, rarity: Rarity): string => `eq-${slot}-${element}-${rarity}`;

const ID = /^eq-(robe|hat|pants|bag|ring|boots)-(fire|water|earth|air)-([1-6])$/;

export function parseEquipmentId(id: string): { slot: GearSlot; element: Element; rarity: Rarity } | null {
  const m = ID.exec(id);
  return m ? { slot: m[1] as GearSlot, element: m[2] as Element, rarity: Number(m[3]) as Rarity } : null;
}

/** Açıklama yalnızca elementin bonusunu söyler; sayısal etki arayüzde ayrıca gösterilir. */
function describe(slot: GearSlot, element: Element): string {
  const el = ELEMENT_NAMES[element];
  switch (slot) {
    case 'robe':
    case 'hat':
    case 'pants':
      return `${el} büyüsünde %50 daha çok zırh verir.`;
    case 'bag':
      return `${el} şehirlerinde %50 daha geniştir.`;
    case 'boots':
      return `${el} şehirlerinde %50 daha hızlıdır.`;
    case 'ring':
      return `${el} büyüsünde büyü süresini %50 daha çok uzatır.`;
  }
}

export function makeEquipment(slot: GearSlot, element: Element, rarity: Rarity): ItemDef {
  const i = rarity - 1;
  const item: ItemDef = {
    id: equipmentId(slot, element, rarity),
    name: `${RARITY_NAMES[rarity]} ${ELEMENT_NAMES[element]} ${SLOT_ITEM_NAMES[slot]}`,
    description: describe(slot, element),
    price: Math.round(BASE_PRICE[slot] * PRICE_PER_RARITY ** i),
    slot,
    element,
    rarity,
  };
  if (slot === 'robe' || slot === 'hat' || slot === 'pants') item.armor = ARMOR_BY_SLOT[slot][i];
  if (slot === 'bag') item.carry = { ...BAG_BY_RARITY[i] };
  if (slot === 'boots') item.speed = BOOTS_SPEED[i];
  if (slot === 'ring') item.timeBonus = RING_TIME_SEC[i];
  return item;
}

/** Tüm ekipman: 6 × 4 × 6 = 144 eşya. */
export const EQUIPMENT: readonly ItemDef[] = GEAR_SLOT_LIST.flatMap((slot) =>
  ELEMENTS.flatMap((element) => RARITIES.map((rarity) => makeEquipment(slot, element, rarity))),
);

/**
 * Eski kayıtlardaki zırh eşyaları (Task 21'e kadar) yeni eşyalara dönüşür. Tılsım yuvası kalktı; tılsımlar yüzük olur.
 * Eski ÇANTALAR dönüşmez: aynen kalır (aşağıda `LEGACY_BAGS`), kendi kapasitesini korur.
 */
export const LEGACY_ITEMS: Readonly<Record<string, string>> = {
  'cirak-cuppesi': 'eq-robe-earth-1',
  'gezgin-cuppesi': 'eq-robe-air-2',
  'bekci-cuppesi': 'eq-robe-earth-3',
  'yun-sapka': 'eq-hat-earth-1',
  'tilsimli-sapka': 'eq-hat-air-2',
  'tas-tilsim': 'eq-ring-earth-1',
  'ruzgar-tilsimi': 'eq-ring-air-2',
};
export const LEGACY_SLOTS: Readonly<Record<string, GearSlot>> = { amulet: 'ring' };

export const migrateItemId = (id: string): string => LEGACY_ITEMS[id] ?? id;

/**
 * Eski çantalar (Task 21): kimlikleri, adları ve kapasiteleri aynen korunur, kuşanılabilir ve satılabilir. Elementleri
 * olmadığı için şehir bonusu almazlar. Artık tüccarda satılmaz ve yeni oyunlarda verilmez.
 */
export const LEGACY_BAGS: readonly ItemDef[] = ([
  { id: 'kucuk-canta', name: 'Küçük Çanta (eski)', price: 100, carry: { wands: 3, goods: 20, gear: 2 }, rarity: 1 },
  { id: 'deri-canta', name: 'Deri Çanta (eski)', price: 300, carry: { wands: 5, goods: 40, gear: 3 }, rarity: 2 },
  { id: 'gezgin-cantasi', name: 'Gezgin Çantası (eski)', price: 800, carry: { wands: 8, goods: 70, gear: 5 }, rarity: 3 },
  { id: 'usta-cantasi', name: 'Usta Çantası (eski)', price: 2000, carry: { wands: 12, goods: 110, gear: 7 }, rarity: 4 },
  { id: 'efsunlu-canta', name: 'Efsunlu Çanta (eski)', price: 5000, carry: { wands: 18, goods: 170, gear: 10 }, rarity: 5 },
] as const satisfies readonly Pick<ItemDef, 'id' | 'name' | 'price' | 'carry' | 'rarity'>[]).map((b): ItemDef => ({
  ...b,
  carry: { ...b.carry },
  description: 'Eski çanta: kapasitesini korur, element bonusu yoktur.',
  slot: 'bag',
}));
