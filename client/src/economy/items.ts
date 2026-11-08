export type GearSlot = 'robe' | 'hat' | 'amulet';

export const GEAR_SLOTS: readonly GearSlot[] = ['robe', 'hat', 'amulet'];

export const SLOT_NAMES: Record<GearSlot, string> = { robe: 'Cüppe', hat: 'Şapka', amulet: 'Tılsım' };

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
