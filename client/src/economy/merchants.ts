export interface MerchantDef {
  id: string;
  name: string;
  /** Tüccarın bulunduğu köy (world/locations.ts kimliği) */
  locationId: string;
  greeting: string;
}

/** Açık köylerdeki tüccarlar. Ganimeti hepsi alır; ekipman farklıdır. */
export const MERCHANTS: readonly MerchantDef[] = [
  {
    id: 'tuccar-kazim',
    name: 'Tüccar Kazım',
    locationId: 'ash',
    greeting: 'Hoş geldin yolcu! Kervanlar gelmiyor ama elimdekiler sağlam. Bak, beğen.',
  },
  {
    id: 'tuccar-nesrin',
    name: 'Tüccar Nesrin',
    locationId: 'vine',
    greeting: 'Asmaların arasından geçen herkese bir indirimim vardır... yani olurdu. Ne lazım?',
  },
  {
    id: 'tuccar-boran',
    name: 'Tüccar Boran',
    locationId: 'marsh',
    greeting: 'Sis içinde iş yapmak zor, ama sisin de sevenleri var. Buyur.',
  },
];

export function getMerchant(id: string): MerchantDef | undefined {
  return MERCHANTS.find((m) => m.id === id);
}
