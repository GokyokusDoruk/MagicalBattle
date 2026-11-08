import { getItem, isGear } from './items';
import type { MerchantDef } from './merchants';
import type { PlayerState } from './player';

export type TradeResult = { ok: true; price: number } | { ok: false; reason: string };

/** Tüccarın ödediği oran: eşyanın değerinin yarısı. */
export const SELL_RATIO = 0.5;

/** Satın alma fiyatı. `multiplier`: ahlak sistemindeki indirim/zam (Task 18); 1 = etkisiz. */
export function buyPrice(price: number, multiplier = 1): number {
  return Math.max(1, Math.round(price * multiplier));
}

/** Satış fiyatı (adet başına). `multiplier`: ahlak sistemindeki satış değeri çarpanı. */
export function sellPrice(price: number, multiplier = 1): number {
  return Math.max(1, Math.floor(price * SELL_RATIO * multiplier));
}

/**
 * Tüccardan ekipman satın alır. Ekipman tektir (aynısından ikinci kez alınmaz). Yeni ekipman, aynı yerdeki
 * ekipmandan daha çok zırh veriyorsa ya da o yer boşsa otomatik kuşanılır.
 */
export function buy(player: PlayerState, merchant: MerchantDef, itemId: string, priceMultiplier = 1): TradeResult {
  const item = getItem(itemId);
  if (!item || !merchant.stock.includes(itemId)) return { ok: false, reason: 'Bu tüccarda böyle bir şey yok.' };
  if (player.count(itemId) > 0) return { ok: false, reason: 'Bu ekipmana zaten sahipsin.' };
  const price = buyPrice(item.price, priceMultiplier);
  if (!player.spendGold(price)) return { ok: false, reason: 'Yeterli altının yok.' };

  player.addItem(itemId);
  if (item.slot) {
    const current = player.equipped[item.slot];
    const currentArmor = current ? (getItem(current)?.armor ?? 0) : -1;
    if ((item.armor ?? 0) > currentArmor) player.equip(itemId);
  }
  return { ok: true, price };
}

/** Çantadan eşya satar. Kuşanılan ekipman önce çıkarılmalıdır. */
export function sell(player: PlayerState, itemId: string, count = 1, sellMultiplier = 1): TradeResult {
  const item = getItem(itemId);
  const n = Math.floor(count);
  if (!item || !(n > 0)) return { ok: false, reason: 'Geçersiz eşya.' };
  if (player.count(itemId) < n) return { ok: false, reason: 'Bundan yeterince yok.' };
  if (isGear(item) && player.isEquipped(itemId)) return { ok: false, reason: 'Önce ekipmanı çıkarmalısın.' };

  const total = sellPrice(item.price, sellMultiplier) * n;
  player.removeItem(itemId, n);
  player.addGold(total);
  return { ok: true, price: total };
}
