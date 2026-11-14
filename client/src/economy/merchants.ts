export type MerchantKind = 'merchant' | 'wandsmith' | 'innkeeper';

export interface MerchantDef {
  id: string;
  name: string;
  /** `merchant`: ekipman, ticari mal ve ganimet. `wandsmith`: asa alır ve satar. `innkeeper` (han): bedava can, iksir ve görevler. */
  kind: MerchantKind;
  /** Bulunduğu şehir (world/locations.ts kimliği) */
  locationId: string;
  greeting: string;
  /** Asacının şehre göre fiyat farkı (0.9 ile 1.1 arası); tüccarlarda yok */
  wandPriceFactor?: number;
}

/**
 * Şehir esnafı (Task 26-27): her şehirde bir tüccar, bir asacı ve bir hancı bulunur. Köylerde esnaf yoktur. Ekipman ve ticari mal
 * tüccardan, asa alım satımı asacıdan; bedava can, iksir ve görevler hancıdadır.
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
  { id: 'hanci-ayse', name: 'Hancı Ayşe', kind: 'innkeeper', locationId: 'ignis', greeting: 'Hoş geldin! Ateşin başına otur, yaraların sarılsın. Han bedava, çorba benden.' },
  { id: 'hanci-yildiz', name: 'Hancı Yıldız', kind: 'innkeeper', locationId: 'abyss', greeting: 'Tapınağın gölgesinde dinlenmek ruhu da yeniler. Odan hazır.' },
  { id: 'hanci-tolga', name: 'Hancı Tolga', kind: 'innkeeper', locationId: 'stone-heart', greeting: 'Taş duvar, kalın yorgan. Yatağa geç, sabaha dipdiri kalkarsın.' },
  { id: 'hanci-su', name: 'Hancı Su', kind: 'innkeeper', locationId: 'still-crystal', greeting: 'Durgun suyun sesiyle uyunur. Dinlen, can hep burada dolar.' },
];

export function getMerchant(id: string): MerchantDef | undefined {
  return MERCHANTS.find((m) => m.id === id);
}

/** Asacının asa fiyatı çarpanı (yoksa 1) */
export function wandPriceFactorOf(merchant: MerchantDef): number {
  return merchant.wandPriceFactor ?? 1;
}
