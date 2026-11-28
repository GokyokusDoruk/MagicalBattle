import { ELEMENTS, ELEMENT_NAMES, type Element } from '../battle/damage/elements';
import { RARITIES, RARITY_NAMES, type Rarity } from '../wands/catalog';
import type { CarryBonus, GearSlot, ItemDef } from './items';

/**
 * Ekipman (Task 36): 9 yuva × 4 element × 6 nadirlik × 30 seviye = 6480 eşya. Her eşyanın nadirliği ve seviyesi vardır;
 * asalar gibi **seviye şartı** vardır (seviyen yetmezse kuşanılamaz) ve seviye eşyanın gücünü artırır.
 *  - Cüppe, Şapka, Pantalon, Eldiven: zırh (hasar azaltma). Toplam zırh üst sınırlıdır.
 *  - Çanta: taşıma kapasitesi (asa, ticari mal, ekipman, iksir).
 *  - Ayakkabı: yürüme hızı.
 *  - Yüzük, Bileklik, Kolye: kritik vuruş şansı ve büyü süresi (çizim süresi uzar). Şanslar toplanır.
 * **Element bonusu:** kuşandığın her ekipman, kendi elementinin büyüsünü yaparken hasarı %1 × nadirlik katsayısı kadar artırır.
 * Şehir bonusu (ayakkabı hızı, çanta kapasitesi) Task 24'te.
 */

export const GEAR_SLOT_LIST: readonly GearSlot[] = ['robe', 'hat', 'pants', 'gloves', 'bag', 'ring', 'bracelet', 'necklace', 'boots'];
export const ARMOR_SLOTS: readonly GearSlot[] = ['robe', 'hat', 'pants', 'gloves'];
/** Kritik şansı ve büyü süresi veren yuvalar */
export const CRIT_SLOTS: readonly GearSlot[] = ['ring', 'bracelet', 'necklace'];

export const MIN_GEAR_LEVEL = 1;
export const MAX_GEAR_LEVEL = 30;

export const SLOT_LABELS: Record<GearSlot, string> = {
  robe: 'Cüppe',
  hat: 'Şapka',
  pants: 'Pantalon',
  gloves: 'Eldiven',
  bag: 'Çanta',
  ring: 'Yüzük',
  bracelet: 'Bileklik',
  necklace: 'Kolye',
  boots: 'Ayakkabı',
};

/** Eşya adında kullanılan biçim: "Ateş Cüppesi" */
const SLOT_ITEM_NAMES: Record<GearSlot, string> = {
  robe: 'Cüppesi',
  hat: 'Şapkası',
  pants: 'Pantolonu',
  gloves: 'Eldiveni',
  bag: 'Çantası',
  ring: 'Yüzüğü',
  bracelet: 'Bilekliği',
  necklace: 'Kolyesi',
  boots: 'Ayakkabısı',
};

/** Seviyenin güce etkisi: seviye 1 = ×1, her seviye +%2 (seviye 30 = ×1.58) */
export const LEVEL_POWER_PER_LEVEL = 0.02;
export const levelScale = (level: number): number => 1 + LEVEL_POWER_PER_LEVEL * (Math.max(MIN_GEAR_LEVEL, Math.min(MAX_GEAR_LEVEL, Math.floor(level))) - 1);

/** Element bonusu: kuşanılan her parça için %1 × bu katsayı (Sıradan 0.25 ... Mistik 1.5) */
export const ELEMENT_BONUS_PER_PIECE = 0.01;
export const ELEMENT_RARITY_WEIGHT: readonly number[] = [0.25, 0.5, 0.75, 1, 1.25, 1.5];
/** Bir parçanın kendi elementinin büyüsüne verdiği hasar bonusu (0.0025 = %0.25). Seviyeden bağımsızdır. */
export const elementBonusOf = (rarity: Rarity): number => ELEMENT_BONUS_PER_PIECE * ELEMENT_RARITY_WEIGHT[rarity - 1];

/** Nadirliğe göre (1-6) zırh değerleri (hasar azaltma, 0-1), seviye 1'de. Dört parça birlikte tavana yaklaşır (ARMOR_CAP %75). */
export const ARMOR_BY_SLOT: Record<'robe' | 'hat' | 'pants' | 'gloves', readonly number[]> = {
  robe: [0.04, 0.06, 0.09, 0.12, 0.16, 0.2],
  hat: [0.02, 0.035, 0.05, 0.07, 0.09, 0.12],
  pants: [0.03, 0.05, 0.07, 0.1, 0.13, 0.16],
  gloves: [0.015, 0.025, 0.04, 0.055, 0.07, 0.09],
};

/** Çanta kapasitesi (asa, eşya, kuşanılabilir), seviye 1'de; hepsi tam sayı */
export const BAG_BY_RARITY: readonly CarryBonus[] = [
  { wands: 3, goods: 20, gear: 2 },
  { wands: 5, goods: 40, gear: 3 },
  { wands: 8, goods: 70, gear: 5 },
  { wands: 12, goods: 110, gear: 7 },
  { wands: 18, goods: 170, gear: 10 },
  { wands: 26, goods: 250, gear: 14 },
];

/** Ayakkabının yürüme hızına kattığı oran (0.05 = +%5), seviye 1'de */
export const BOOTS_SPEED: readonly number[] = [0.05, 0.08, 0.12, 0.16, 0.2, 0.25];

/** Yüzüğün büyü (çizim) süresine kattığı saniye, seviye 1'de */
export const RING_TIME_SEC: readonly number[] = [0.2, 0.35, 0.5, 0.7, 0.9, 1.2];
/** Kritik şansı (0.02 = %2), yüzük için, seviye 1'de */
export const RING_CRIT: readonly number[] = [0.02, 0.03, 0.045, 0.06, 0.08, 0.1];

/** Faz 6: kolyenin alan gücü (hücre), nadirliğe göre (seviyeyle ölçeklenir) */
export const NECKLACE_AREA: readonly number[] = [12, 20, 28, 38, 50, 64];

/** Yüzük, bileklik, kolye arasında süre ve kritik dağılımı: bileklik kritik, kolye süre ağırlıklıdır. */
export const CRIT_SLOT_WEIGHTS: Record<'ring' | 'bracelet' | 'necklace', { time: number; crit: number }> = {
  ring: { time: 1, crit: 1 },
  bracelet: { time: 0.6, crit: 1.4 },
  necklace: { time: 1.4, crit: 0.6 },
};

/** Yuvaya göre taban fiyat; nadirlik başına ×2.2, seviye başına +%8 */
export const BASE_PRICE: Record<GearSlot, number> = { robe: 60, hat: 40, pants: 50, gloves: 45, bag: 100, ring: 90, bracelet: 85, necklace: 95, boots: 70 };
export const PRICE_PER_RARITY = 2.2;
export const PRICE_PER_LEVEL = 0.08;

export const equipmentId = (slot: GearSlot, element: Element, rarity: Rarity, level = 1): string => `eq-${slot}-${element}-${rarity}-${level}`;

const ID = /^eq-(robe|hat|pants|gloves|bag|ring|bracelet|necklace|boots)-(fire|water|earth|air)-([1-6])(?:-(\d{1,2}))?$/;

export function parseEquipmentId(id: string): { slot: GearSlot; element: Element; rarity: Rarity; level: number } | null {
  const m = ID.exec(id);
  if (!m) return null;
  const level = m[4] === undefined ? 1 : Number(m[4]);
  if (level < MIN_GEAR_LEVEL || level > MAX_GEAR_LEVEL) return null;
  return { slot: m[1] as GearSlot, element: m[2] as Element, rarity: Number(m[3]) as Rarity, level };
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/** Açıklama: elementin büyüsüne verdiği hasar bonusu (sayısal etkiler arayüzde ayrıca gösterilir). */
function describe(element: Element, rarity: Rarity): string {
  return `${ELEMENT_NAMES[element]} büyüsünde hasarı %${round3(elementBonusOf(rarity) * 100)} artırır.`;
}

export function makeEquipment(slot: GearSlot, element: Element, rarity: Rarity, level = 1): ItemDef {
  const i = rarity - 1;
  const scale = levelScale(level);
  const item: ItemDef = {
    id: equipmentId(slot, element, rarity, level),
    name: `${RARITY_NAMES[rarity]} ${ELEMENT_NAMES[element]} ${SLOT_ITEM_NAMES[slot]}`,
    description: describe(element, rarity),
    price: Math.round(BASE_PRICE[slot] * PRICE_PER_RARITY ** i * (1 + PRICE_PER_LEVEL * (level - 1))),
    slot,
    element,
    rarity,
    level,
  };
  if (slot === 'robe' || slot === 'hat' || slot === 'pants' || slot === 'gloves') item.armor = round3(ARMOR_BY_SLOT[slot][i] * scale);
  if (slot === 'bag') {
    const b = BAG_BY_RARITY[i];
    item.carry = { wands: Math.round(b.wands * scale), goods: Math.round(b.goods * scale), gear: Math.round(b.gear * scale) };
  }
  if (slot === 'boots') item.speed = round3(BOOTS_SPEED[i] * scale);
  if (slot === 'ring' || slot === 'bracelet' || slot === 'necklace') {
    const w = CRIT_SLOT_WEIGHTS[slot];
    item.timeBonus = round3(RING_TIME_SEC[i] * w.time * scale);
    item.crit = round3(RING_CRIT[i] * w.crit * scale);
    if (slot === 'necklace') item.areaCells = Math.round(NECKLACE_AREA[i] * scale);
  }
  return item;
}

/** Tüm ekipman: 9 × 4 × 6 × 30 = 6480 eşya. */
export const EQUIPMENT: readonly ItemDef[] = GEAR_SLOT_LIST.flatMap((slot) =>
  ELEMENTS.flatMap((element) => RARITIES.flatMap((rarity) => Array.from({ length: MAX_GEAR_LEVEL }, (_, l) => makeEquipment(slot, element, rarity, l + 1)))),
);

/**
 * Eski kayıtlardaki zırh eşyaları (Task 21'e kadar) yeni eşyalara dönüşür. Tılsım yuvası kalktı; tılsımlar yüzük olur.
 * Eski ÇANTALAR dönüşmez: aynen kalır (aşağıda `LEGACY_BAGS`), kendi kapasitesini korur.
 */
export const LEGACY_ITEMS: Readonly<Record<string, string>> = {
  'cirak-cuppesi': 'eq-robe-earth-1-1',
  'gezgin-cuppesi': 'eq-robe-air-2-1',
  'bekci-cuppesi': 'eq-robe-earth-3-1',
  'yun-sapka': 'eq-hat-earth-1-1',
  'tilsimli-sapka': 'eq-hat-air-2-1',
  'tas-tilsim': 'eq-ring-earth-1-1',
  'ruzgar-tilsimi': 'eq-ring-air-2-1',
};
export const LEGACY_SLOTS: Readonly<Record<string, GearSlot>> = { amulet: 'ring' };

/** Eski kimlikleri güncel kimliğe çevirir: adı değişmiş eşyalar ve seviyesiz ekipman (Task 36 öncesi) seviye 1 olur. */
export function migrateItemId(id: string): string {
  if (LEGACY_ITEMS[id]) return LEGACY_ITEMS[id];
  const m = /^(eq-[a-z]+-(?:fire|water|earth|air)-[1-6])$/.exec(id);
  return m ? `${m[1]}-1` : id;
}

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
