import { gearValue, getItem, isGear } from './items';
import type { Currency } from './currency';
import { CURRENCY_NAMES } from './currency';
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
 * Verilen fiyata bir eşya satın alır: çantada yer olmalı, para yetmeli (yoksa hiçbir şey değişmez). Aynı eşyadan birden
 * fazla alınabilir. Ekipman, o yuvada hiçbir şey giyilmiyorsa ya da yenisi daha nadirse otomatik kuşanılır.
 */
export function buyItem(player: PlayerState, itemId: string, price: number, currency: Currency = 'kor'): TradeResult {
  const item = getItem(itemId);
  if (!item) return { ok: false, reason: 'Böyle bir eşya yok.' };
  if (player.roomFor(itemId) < 1) return { ok: false, reason: 'Çantanda bunun için yer yok. Önce bir şey sat ya da at.' };
  if (!player.spendMoney(currency, price)) return { ok: false, reason: `Yeterli ${CURRENCY_NAMES[currency]} yok.` };

  player.addItem(itemId);
  if (item.slot) {
    const current = player.equipped[item.slot];
    const currentValue = current ? gearValue(getItem(current)!) : -1;
    if (gearValue(item) > currentValue) player.equip(itemId);
  }
  return { ok: true, price };
}

/**
 * Çantadan eşya satar. Giyilen kopya satılamaz (önce çıkarılmalı); aynı eşyadan fazla kopya varsa fazlası satılır.
 */
export function sell(player: PlayerState, itemId: string, count = 1, sellMultiplier = 1, currency: Currency = 'kor'): TradeResult {
  const item = getItem(itemId);
  const n = Math.floor(count);
  if (!item || !(n > 0)) return { ok: false, reason: 'Geçersiz eşya.' };
  if (player.count(itemId) < n) return { ok: false, reason: 'Bundan yeterince yok.' };
  if (isGear(item) && player.isEquipped(itemId) && player.count(itemId) - n < 1) {
    return { ok: false, reason: 'Önce ekipmanı çıkarmalısın.' };
  }

  const total = sellPrice(item.price, sellMultiplier) * n;
  player.removeItem(itemId, n);
  player.addMoney(currency, total);
  return { ok: true, price: total };
}
