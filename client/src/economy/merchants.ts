export type MerchantKind = 'merchant' | 'wandsmith';

export interface MerchantDef {
  id: string;
  name: string;
  /** `merchant`: ekipman, ticari mal, ganimet ve görevler. `wandsmith`: asa alır ve satar. */
  kind: MerchantKind;
  /** Bulunduğu şehir (world/locations.ts kimliği) */
  locationId: string;
  greeting: string;
  /** Asacının şehre göre fiyat farkı (0.9 ile 1.1 arası); tüccarlarda yok */
  wandPriceFactor?: number;
}

/**
 * Şehir tüccarları (Task 26): her şehirde bir tüccar ve bir asacı bulunur. Köylerde tüccar yoktur. Ekipman, ticari mal
 * ve görev tüccardan; asa alım satımı asacıdan yapılır.
 */
export const MERCHANTS: readonly MerchantDef[] = [
  {
    id: 'tuccar-kazim',
    name: 'Tüccar Kazım',
    kind: 'merchant',
    locationId: 'ignis',
    greeting: 'Ignis kervanları artık geri geliyor! Baharat ucuz, ekipman sağlam. Bak, beğen.',
  },
  {
    id: 'asaci-ember',
    name: 'Asacı Ember',
    kind: 'wandsmith',
    locationId: 'ignis',
    greeting: 'Asa ateşle yoğrulur evladım. Sıcak sıcak, yeni gelenler var.',
    wandPriceFactor: 1,
  },
  {
    id: 'tuccar-nesrin',
    name: 'Tüccar Nesrin',
    kind: 'merchant',
    locationId: 'abyss',
    greeting: 'Tapınağın rüzgârı malımı hafifletir, fiyatımı değil. Ne lazım?',
  },
  {
    id: 'asaci-sefa',
    name: 'Asacı Sefa',
    kind: 'wandsmith',
    locationId: 'abyss',
    greeting: 'Abyss asaları incedir, hafiftir, bir de biraz pahalıdır. Hoş geldin.',
    wandPriceFactor: 1.1,
  },
  {
    id: 'tuccar-boran',
    name: 'Tüccar Boran',
    kind: 'merchant',
    locationId: 'stone-heart',
    greeting: 'Kale duvarı kalın, pazarlığım ince. Buyur.',
  },
  {
    id: 'asaci-dagdelen',
    name: 'Asacı Dağdelen',
    kind: 'wandsmith',
    locationId: 'stone-heart',
    greeting: 'Taştan çıkan asa sağlam olur. Burada fiyatlar da biraz yumuşak.',
    wandPriceFactor: 0.9,
  },
  {
    id: 'tuccar-deniz',
    name: 'Tüccar Deniz',
    kind: 'merchant',
    locationId: 'still-crystal',
    greeting: 'Durgun sular derindir, fiyatlar da. İnci istersen önce bak.',
  },
  {
    id: 'asaci-damla',
    name: 'Asacı Damla',
    kind: 'wandsmith',
    locationId: 'still-crystal',
    greeting: 'Su asayı yumuşatır, ustayı sabırlı yapar. Seç, dene.',
    wandPriceFactor: 1.05,
  },
];

export function getMerchant(id: string): MerchantDef | undefined {
  return MERCHANTS.find((m) => m.id === id);
}

/** Asacının asa fiyatı çarpanı (yoksa 1) */
export function wandPriceFactorOf(merchant: MerchantDef): number {
  return merchant.wandPriceFactor ?? 1;
}
