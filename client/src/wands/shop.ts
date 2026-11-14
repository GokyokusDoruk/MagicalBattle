import { getWand, wandPrice } from './catalog';
import type { Result, WandInventory } from './inventory';

/** Asacı, bir asanın değerinin yarısını öder (ekipman satışıyla aynı oran). */
export const WAND_SELL_RATIO = 0.5;

/** Asanın değeri (tabandaki fiyat; şehir ve ahlak çarpanları ayrıca uygulanır) */
export function wandValue(wandId: string): number {
  const w = getWand(wandId);
  return w ? wandPrice(w.rarity, w.level) : 0;
}

/** Asacının asayı alış fiyatı. `cityFactor`: şehir farkı (0.9–1.1), `moralitySell`: ahlak satış çarpanı. */
export function wandSellPrice(wandId: string, cityFactor = 1, moralitySell = 1): number {
  return Math.max(1, Math.floor(wandValue(wandId) * WAND_SELL_RATIO * cityFactor * moralitySell));
}

/** Asacının asayı satış fiyatı: stoktaki taban fiyat değil, şehir farkı uygulanmış fiyat */
export function wandBuyPrice(basePrice: number, cityFactor = 1, moralityBuy = 1): number {
  return Math.max(1, Math.round(basePrice * cityFactor * moralityBuy));
}

/** Çantadaki asayı asacıya satar. Kuşanılı asanın son kopyası satılamaz. */
export function sellWand(
  inventory: WandInventory,
  gold: { add: (n: number) => void },
  wandId: string,
  cityFactor = 1,
  moralitySell = 1,
): Result<{ price: number }> {
  if (!getWand(wandId)) return { ok: false, reason: 'Böyle bir asa yok.' };
  if (inventory.count(wandId) < 1) return { ok: false, reason: 'Bu asaya sahip değilsin.' };
  if (inventory.isEquipped(wandId) && inventory.count(wandId) < 2) return { ok: false, reason: 'Kuşanılı asayı satamazsın. Önce başka bir asa kuşan.' };
  const price = wandSellPrice(wandId, cityFactor, moralitySell);
  if (!inventory.remove(wandId, 1)) return { ok: false, reason: 'Asa satılamadı.' };
  gold.add(price);
  return { ok: true, price };
}
