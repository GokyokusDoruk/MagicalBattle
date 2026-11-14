import type { Element } from '../battle/damage/elements';
import { getLocation } from '../world/locations';
import { getItem } from './items';
import type { PlayerState } from './player';
import type { TradeResult } from './shop';

/**
 * Ticari mallar (Task 26): her şehir bir elementin malını ucuza satar, uzaktaki elementin malını pahalıya alır.
 * Fiyat çarpanı, malın elementinin şehrin elementine halka üzerindeki uzaklığına bağlıdır
 * (ateş → hava → toprak → su → ateş). Ucuza alıp uzak şehirde satmak kâr bırakır; mallar çantadaki "eşya" yerini kaplar.
 */

export interface TradeGood {
  id: string;
  element: Element;
}

export const TRADE_GOODS: readonly TradeGood[] = [
  { id: 'kor-baharati', element: 'fire' },
  { id: 'bulut-ipegi', element: 'air' },
  { id: 'tas-cevheri', element: 'earth' },
  { id: 'derin-inci', element: 'water' },
];

const RING: readonly Element[] = ['fire', 'air', 'earth', 'water'];

/** Halkadaki uzaklık: 0 (aynı), 1 (komşu), 2 (karşı) */
export function ringDistance(a: Element, b: Element): number {
  const d = Math.abs(RING.indexOf(a) - RING.indexOf(b));
  return Math.min(d, RING.length - d);
}

/** Mal şehrin kendi elementindeyse ucuz, komşuysa normal, karşıdaysa pahalı */
export const DISTANCE_MULTIPLIER: readonly number[] = [0.7, 1.0, 1.4];
/** Tüccar malı, o şehirdeki fiyatın bu oranından alır (aradaki fark tüccarın payıdır) */
export const TRADE_SELL_RATIO = 0.8;

export function getTradeGood(id: string): TradeGood | undefined {
  return TRADE_GOODS.find((g) => g.id === id);
}

export function isTradeGood(id: string): boolean {
  return getTradeGood(id) !== undefined;
}

/** Bir malın şehirdeki fiyat çarpanı; şehir ya da mal bilinmiyorsa 1. */
export function cityGoodMultiplier(cityId: string, goodId: string): number {
  const good = getTradeGood(goodId);
  const city = getLocation(cityId);
  const here = city.elements[0];
  if (!good || !here) return 1;
  return DISTANCE_MULTIPLIER[ringDistance(good.element, here)];
}

/** Şehirde malın alış fiyatı (oyuncu öder). `moralityBuy`: ahlak indirimi çarpanı. */
export function tradeBuyPrice(cityId: string, goodId: string, moralityBuy = 1): number {
  const base = getItem(goodId)?.price ?? 0;
  return Math.max(1, Math.round(base * cityGoodMultiplier(cityId, goodId) * moralityBuy));
}

/** Şehirde malın satış fiyatı (adet başına, oyuncu alır). `moralitySell`: ahlak satış çarpanı. */
export function tradeSellPrice(cityId: string, goodId: string, moralitySell = 1): number {
  const base = getItem(goodId)?.price ?? 0;
  return Math.max(1, Math.floor(base * cityGoodMultiplier(cityId, goodId) * TRADE_SELL_RATIO * moralitySell));
}

export function buyGood(player: PlayerState, cityId: string, goodId: string, count = 1, moralityBuy = 1): TradeResult {
  const n = Math.floor(count);
  if (!isTradeGood(goodId) || !(n > 0)) return { ok: false, reason: 'Böyle bir mal yok.' };
  if (player.roomFor(goodId) < n) return { ok: false, reason: 'Çantanda bu mal için yer yok. Önce bir şey sat ya da at.' };
  const total = tradeBuyPrice(cityId, goodId, moralityBuy) * n;
  if (!player.spendGold(total)) return { ok: false, reason: 'Yeterli altın yok.' };
  player.addItem(goodId, n);
  return { ok: true, price: total };
}

export function sellGood(player: PlayerState, cityId: string, goodId: string, count = 1, moralitySell = 1): TradeResult {
  const n = Math.floor(count);
  if (!isTradeGood(goodId) || !(n > 0)) return { ok: false, reason: 'Böyle bir mal yok.' };
  if (player.count(goodId) < n) return { ok: false, reason: 'Bundan yeterince yok.' };
  const total = tradeSellPrice(cityId, goodId, moralitySell) * n;
  player.removeItem(goodId, n);
  player.addGold(total);
  return { ok: true, price: total };
}
