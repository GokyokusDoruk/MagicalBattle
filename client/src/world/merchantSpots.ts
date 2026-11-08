import { MERCHANTS, type MerchantDef } from '../economy/merchants';
import type { WorldMap } from './generateMap';

/** Tüccarın haritadaki durduğu karo. */
export interface MerchantSpot {
  merchant: MerchantDef;
  tileX: number;
  tileY: number;
}

/** Tüccar, köy merkezinin biraz sağ üstünde durur (yol köy merkezine gelir, tezgâh yolun dışında kalır). */
const OFFSET = { x: 3, y: -2 };

export function merchantSpots(map: WorldMap): MerchantSpot[] {
  return MERCHANTS.flatMap((merchant) => {
    const loc = map.locations.find((l) => l.id === merchant.locationId);
    return loc ? [{ merchant, tileX: loc.x + OFFSET.x, tileY: loc.y + OFFSET.y }] : [];
  });
}
