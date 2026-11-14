import { ELEMENTS } from '../battle/damage/elements';
import { mulberry32 } from '../world/rng';
import { COMMON_SHARE, RARE_PREMIUM, ROTATION_MS, STOCK_MAX_RARITY, STOCK_SIZE, hash, rotationOf } from '../wands/stock';
import type { Rarity } from '../wands/catalog';
import { GEAR_SLOT_LIST, equipmentId } from './equipment';
import { buyItem, type TradeResult } from './shop';
import type { Currency } from './currency';
import type { PlayerState } from './player';
import { getItem } from './items';

/**
 * Tüccarın ekipman stoğu: 5 eşya, **5 dakikada bir** yenilenir. Tam **1 Nadir** eşya vardır (pahalı, ×1.5); diğerleri
 * Sıradan ya da Gelişmiş. Yuva ve element rastgeledir. Satın alınan eşyanın yeri bir sonraki yenilemeye kadar boş kalır.
 * Süre oyun süresiyle sayılır (oyun açıkken). Asa stoğuyla aynı kuralları paylaşır (wands/stock.ts).
 */

export interface GearStockEntry {
  slot: number;
  itemId: string;
  /** Taban fiyat (ahlak çarpanı satın alırken ayrıca uygulanır) */
  price: number;
  rare: boolean;
}

export function generateGearStock(merchantId: string, rotation: number): GearStockEntry[] {
  const rand = mulberry32(hash(`gear:${merchantId}:${rotation}`));
  const rareSlot = Math.floor(rand() * STOCK_SIZE);
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
  return Array.from({ length: STOCK_SIZE }, (_, slot) => {
    const rare = slot === rareSlot;
    const rarity: Rarity = rare ? STOCK_MAX_RARITY : rand() < COMMON_SHARE ? 1 : 2;
    const item = getItem(equipmentId(pick(GEAR_SLOT_LIST), pick(ELEMENTS), rarity))!;
    return { slot, itemId: item.id, price: Math.round(item.price * (rare ? RARE_PREMIUM : 1)), rare };
  });
}

export class GearStock {
  private rotation = -1;
  private entriesNow: GearStockEntry[] = [];
  private readonly sold = new Set<number>();

  constructor(
    private readonly merchantId: string,
    private readonly now: () => number,
  ) {}

  private refresh(): void {
    const r = rotationOf(this.now());
    if (r === this.rotation) return;
    this.rotation = r;
    this.entriesNow = generateGearStock(this.merchantId, r);
    this.sold.clear();
  }

  entries(): (GearStockEntry & { sold: boolean })[] {
    this.refresh();
    return this.entriesNow.map((e) => ({ ...e, sold: this.sold.has(e.slot) }));
  }

  /** Bir sonraki yenilemeye kalan süre (ms) */
  timeLeftMs(): number {
    this.refresh();
    return ROTATION_MS - (this.now() % ROTATION_MS);
  }

  /** Yenileme dönemi (stok değişince arayüzün yeniden çizmesi için) */
  get rotationIndex(): number {
    this.refresh();
    return this.rotation;
  }

  buy(slot: number, player: PlayerState, priceMultiplier = 1, currency: Currency = 'kor'): TradeResult {
    this.refresh();
    const entry = this.entriesNow[slot];
    if (!entry) return { ok: false, reason: 'Böyle bir eşya yok.' };
    if (this.sold.has(slot)) return { ok: false, reason: 'Bu eşya satıldı. Stok yenilenince yenileri gelir.' };
    const price = Math.max(1, Math.round(entry.price * priceMultiplier));
    const r = buyItem(player, entry.itemId, price, currency);
    if (r.ok) this.sold.add(slot);
    return r;
  }
}
