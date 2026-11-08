export type GearSlot = 'robe' | 'hat' | 'amulet' | 'bag';

export const GEAR_SLOTS: readonly GearSlot[] = ['robe', 'hat', 'amulet', 'bag'];

export const SLOT_NAMES: Record<GearSlot, string> = { robe: 'Cüppe', hat: 'Şapka', amulet: 'Tılsım', bag: 'Çanta' };

/** Çantanın kapasiteye kattığı adetler (hepsi tam sayı). Giyilen ekipman ve kuşanılı asalar sayılmaz. */
export interface CarryBonus {
  /** Taşınan asa sayısı */
  wands: number;
  /** Ticari eşya ve iksir sayısı */
  goods: number;
  /** Çantada taşınan (giyilmeyen) ekipman sayısı */
  gear: number;
}

export const NO_BONUS: CarryBonus = { wands: 0, goods: 0, gear: 0 };

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  /** Tüccarın satış fiyatı (ekipman) ya da taban değer (ganimet). Tüccar fiyatın yarısını öder. */
  price: number;
  /** Ekipmansa takıldığı yer */
  slot?: GearSlot;
  /** Ekipmansa toplam zırha katkısı (0-1, hasar azaltma). Baş/gövde ayrımı yoktur. */
  armor?: number;
  /** Çantaysa (slot 'bag') kapasiteye kattıkları */
  carry?: CarryBonus;
  /** Can iksiriyse verdiği can (kullanma, kalıcı can geldiğinde açılır) */
  heal?: number;
  /** Çanta nadirliği (1-5), yalnızca çantalarda */
  tier?: 1 | 2 | 3 | 4 | 5;
}

/**
 * Eşya kataloğu. Ganimet (ot, kristal...) yalnızca satılır ve görevlerde kullanılır;
 * ekipman satın alınır, kuşanılır ve toplam zırhı artırır.
 */
export const ITEMS: readonly ItemDef[] = [
  // Ganimet
  { id: 'sifali-ot', name: 'Şifalı Ot', description: 'Yolların kenarında biten mis kokulu ot.', price: 8 },
  { id: 'kristal-parcasi', name: 'Kristal Parçası', description: 'Kumsalda bulunan, içinde ışık dönen küçük bir parça.', price: 22 },
  { id: 'ates-tozu', name: 'Ateş Tozu', description: 'Dokununca ısınan kızıl toz.', price: 15 },
  { id: 'kurt-postu', name: 'Kurt Postu', description: 'Kalın ve sıcak tutan bir post.', price: 35 },

  // Çantalar: kuşanılınca taşıma kapasitesini artırır
  { id: 'kucuk-canta', name: 'Küçük Çanta', description: 'Kumaştan, omuza asılan sade bir çanta.', price: 100, slot: 'bag', carry: { wands: 3, goods: 20, gear: 2 }, tier: 1 },
  { id: 'deri-canta', name: 'Deri Çanta', description: 'Kalın deriden, dikişleri sağlam bir çanta.', price: 300, slot: 'bag', carry: { wands: 5, goods: 40, gear: 3 }, tier: 2 },
  { id: 'gezgin-cantasi', name: 'Gezgin Çantası', description: 'Uzun yolculuklar için bölmelere ayrılmış çanta.', price: 800, slot: 'bag', carry: { wands: 8, goods: 70, gear: 5 }, tier: 3 },
  { id: 'usta-cantasi', name: 'Usta Çantası', description: 'Bir usta tüccarın büyü işlemeli çantası.', price: 2000, slot: 'bag', carry: { wands: 12, goods: 110, gear: 7 }, tier: 4 },
  { id: 'efsunlu-canta', name: 'Efsunlu Çanta', description: 'İçi dışından büyük, efsunlu bir çanta.', price: 5000, slot: 'bag', carry: { wands: 18, goods: 170, gear: 10 }, tier: 5 },

  // Can iksirleri: çantada eşya yeri kaplar
  { id: 'iksir-kucuk', name: 'Küçük Can İksiri', description: 'Küçük bir şişede kırmızı sıvı. 60 can yeniler.', price: 25, heal: 60 },
  { id: 'iksir-orta', name: 'Can İksiri', description: 'Yaraları hızla kapatan iksir. 150 can yeniler.', price: 60, heal: 150 },
  { id: 'iksir-buyuk', name: 'Büyük Can İksiri', description: 'Neredeyse ölüyü ayağa kaldıran iksir. 300 can yeniler.', price: 120, heal: 300 },

  // Cüppeler
  { id: 'cirak-cuppesi', name: 'Çırak Cüppesi', description: 'Sade ama sağlam, Bekçi çıraklarının giydiği cüppe.', price: 60, slot: 'robe', armor: 0.05 },
  { id: 'gezgin-cuppesi', name: 'Gezgin Cüppesi', description: 'Uzun yolların tozunu görmüş, dayanıklı bir cüppe.', price: 180, slot: 'robe', armor: 0.1 },
  { id: 'bekci-cuppesi', name: 'Bekçi Cüppesi', description: 'Eski Düzen Bekçilerinin mühürlü cüppesi.', price: 520, slot: 'robe', armor: 0.18 },

  // Şapkalar
  { id: 'yun-sapka', name: 'Yün Şapka', description: 'Kafayı sıcak tutan örme şapka.', price: 40, slot: 'hat', armor: 0.03 },
  { id: 'tilsimli-sapka', name: 'Tılsımlı Şapka', description: 'İçine koruyucu bir rün işlenmiş.', price: 150, slot: 'hat', armor: 0.07 },

  // Tılsımlar
  { id: 'tas-tilsim', name: 'Taş Tılsım', description: 'Elde ağır, bedende hafif bir güven verir.', price: 90, slot: 'amulet', armor: 0.04 },
  { id: 'ruzgar-tilsimi', name: 'Rüzgâr Tılsımı', description: 'Darbelerin yönünü saptıran hafif bir tılsım.', price: 260, slot: 'amulet', armor: 0.08 },
];

const BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

export function getItem(id: string): ItemDef | undefined {
  return BY_ID.get(id);
}

export function isGear(item: ItemDef): boolean {
  return item.slot !== undefined;
}

/** Envanter kategorisi: giyilebilen her şey "gear", geri kalan (ganimet, iksir) "goods". Asalar ayrı sayılır. */
export function itemCategory(item: ItemDef): 'gear' | 'goods' {
  return item.slot ? 'gear' : 'goods';
}

export function isBag(item: ItemDef): boolean {
  return item.slot === 'bag';
}

export function isPotion(item: ItemDef): boolean {
  return item.heal !== undefined;
}

/** Ekipmanın "değeri": zırh ya da çantanın kapasitesi (yeni alınan eşya daha iyiyse otomatik kuşanılır). */
export function gearValue(item: ItemDef): number {
  if (item.carry) return item.carry.wands * 10 + item.carry.goods + item.carry.gear * 10;
  return item.armor ?? 0;
}
