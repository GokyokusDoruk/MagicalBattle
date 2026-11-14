import type { Element } from '../battle/damage/elements';
import { EQUIPMENT, GEAR_SLOT_LIST, LEGACY_BAGS, SLOT_LABELS } from './equipment';

/** Ekipman yuvaları (Task 36): Cüppe, Şapka, Pantalon, Eldiven, Çanta, Yüzük, Bileklik, Kolye, Ayakkabı */
export type GearSlot = 'robe' | 'hat' | 'pants' | 'gloves' | 'bag' | 'ring' | 'bracelet' | 'necklace' | 'boots';

export const GEAR_SLOTS: readonly GearSlot[] = GEAR_SLOT_LIST;

export const SLOT_NAMES: Record<GearSlot, string> = SLOT_LABELS;

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
  /** Ekipmansa elementi (renk ve bonus): ateş kırmızı, su mavi, toprak kahverengi, hava beyaz. Eski çantalarda yoktur. */
  element?: Element;
  /** Ekipmansa nadirlik (1-6) */
  rarity?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Ekipmansa seviye (1-30); oyuncu bu seviyeye gelmeden kuşanamaz. Eski çantalarda yoktur. */
  level?: number;
  /** Yüzük, bileklik ve kolyeyse kritik vuruş şansı (0.05 = %5) */
  crit?: number;
  /** Zırh parçasıysa (cüppe, şapka, pantalon) toplam zırha katkısı (0-1, hasar azaltma) */
  armor?: number;
  /** Çantaysa kapasiteye kattıkları */
  carry?: CarryBonus;
  /** Ayakkabıysa yürüme hızına kattığı oran (0.1 = +%10) */
  speed?: number;
  /** Yüzükse büyü süresine kattığı saniye */
  timeBonus?: number;
  /** Can iksiriyse verdiği can (kullanma, kalıcı can geldiğinde açılır) */
  heal?: number;
}

/**
 * Eşya kataloğu: ganimet, can iksirleri, 144 ekipman ve 5 eski çanta (bkz. equipment.ts).
 * Ganimet (ot, kristal...) yalnızca satılır ve görevlerde kullanılır.
 */
export const ITEMS: readonly ItemDef[] = [
  // Ganimet
  { id: 'sifali-ot', name: 'Şifalı Ot', description: 'Yolların kenarında biten mis kokulu ot.', price: 8 },
  { id: 'kristal-parcasi', name: 'Kristal Parçası', description: 'Kumsalda bulunan, içinde ışık dönen küçük bir parça.', price: 22 },
  { id: 'ates-tozu', name: 'Ateş Tozu', description: 'Dokununca ısınan kızıl toz.', price: 15 },
  { id: 'kurt-postu', name: 'Kurt Postu', description: 'Kalın ve sıcak tutan bir post.', price: 35 },

  // Ticari mallar (Task 26): şehir tüccarlarından alınır, fiyatı şehre göre değişir (bkz. trade.ts)
  { id: 'kor-baharati', name: 'Kor Baharatı', description: 'Ignis kervanlarının kızıl baharatı. Ateş şehrinde bol, uzakta pahalıdır.', price: 30 },
  { id: 'bulut-ipegi', name: 'Bulut İpeği', description: 'Abyss rahiplerinin dokuduğu, havadan hafif ipek.', price: 40 },
  { id: 'tas-cevheri', name: 'Taş Cevheri', description: 'Stone Heart madenlerinin ağır, damarlı cevheri.', price: 50 },
  { id: 'derin-inci', name: 'Derin İnci', description: 'Still Crystal dalgıçlarının çıkardığı mavi inci.', price: 70 },

  // Can iksirleri: çantada eşya yeri kaplar
  { id: 'iksir-kucuk', name: 'Küçük Can İksiri', description: 'Küçük bir şişede kırmızı sıvı. 60 can yeniler.', price: 25, heal: 60 },
  { id: 'iksir-orta', name: 'Can İksiri', description: 'Yaraları hızla kapatan iksir. 150 can yeniler.', price: 60, heal: 150 },
  { id: 'iksir-buyuk', name: 'Büyük Can İksiri', description: 'Neredeyse ölüyü ayağa kaldıran iksir. 300 can yeniler.', price: 120, heal: 300 },

  // Ekipman: 6 yuva x 4 element x 6 nadirlik
  ...EQUIPMENT,

  // Eski çantalar (Task 21): kendi özelliklerini korur, elementi yoktur
  ...LEGACY_BAGS,
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

/** Ekipmanın "değeri": aynı yuvada yeni alınan eşya daha nadirse (eşitse daha yüksek seviyeliyse) otomatik kuşanılır. */
export function gearValue(item: ItemDef): number {
  return (item.rarity ?? 0) + (item.level ?? 0) / 100;
}
