import { MERCHANTS, type MerchantDef, type MerchantKind } from '../economy/merchants';
import type { WorldMap } from './generateMap';

/** Tüccarın haritadaki durduğu karo. */
export interface MerchantSpot {
  merchant: MerchantDef;
  tileX: number;
  tileY: number;
}

/**
 * Şehir merkezinin üstünde, surların içinde dururlar: tüccar sağda, asacı solda, hancı ortada (üstte) (kapıdan merkeze giden yol açık kalır).
 */
const OFFSETS: Record<MerchantKind, { x: number; y: number }> = {
  merchant: { x: 3, y: -2 },
  wandsmith: { x: -3, y: -2 },
  innkeeper: { x: 0, y: -4 },
};

export function merchantSpots(map: WorldMap): MerchantSpot[] {
  return MERCHANTS.flatMap((merchant) => {
    const loc = map.locations.find((l) => l.id === merchant.locationId);
    const o = OFFSETS[merchant.kind];
    return loc ? [{ merchant, tileX: loc.x + o.x, tileY: loc.y + o.y }] : [];
  });
}
