import { ELEMENTS } from '../battle/damage/elements';
import { mulberry32 } from '../world/rng';
import { MAX_WAND_LEVEL, ROLES, getWand, makeWand, wandPrice, type Rarity } from './catalog';
import type { Result, WandInventory } from './inventory';

/**
 * Tüccarın asa stoğu: 5 asa, **5 dakikada bir** yenilenir. En çok **1 Nadir** asa bulunur (pahalı); diğerleri Sıradan
 * ya da Gelişmiş. Elementleri, rolleri ve seviyeleri rastgeledir. Satın alınan asanın yeri bir sonraki yenilemeye
 * kadar boş kalır. Süre oyun süresiyle sayılır (oyun açıkken).
 */

export const STOCK_SIZE = 5;
export const ROTATION_MS = 5 * 60 * 1000;
/** Nadir asanın fiyat çarpanı (pahalı) */
export const RARE_PREMIUM = 1.5;
/** Stoktaki asaların seviyesi 1 ile oyuncu seviyesi + bu kadar arasındadır (biraz üstü de çıkar, hedef olur) */
export const LEVEL_HEADROOM = 5;
/** Stoktaki en yüksek nadirlik (Nadir) */
export const STOCK_MAX_RARITY: Rarity = 3;
/** Nadir olmayan asaların Sıradan olma olasılığı (kalanı Gelişmiş) */
export const COMMON_SHARE = 0.6;

export interface StockEntry {
  /** Stoktaki sıra (0-4) */
  slot: number;
  wandId: string;
  /** Taban fiyat (ahlak fiyat çarpanı satın alırken ayrıca uygulanır) */
  price: number;
  /** Nadir (pahalı) asa mı */
  rare: boolean;
}

export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Bir yenileme dönemi için stok (aynı tohumla hep aynı). Tam 1 Nadir asa, diğerleri Sıradan/Gelişmiş. */
export function generateStock(merchantId: string, rotation: number, playerLevel: number): StockEntry[] {
  const rand = mulberry32(hash(`${merchantId}:${rotation}`));
  const cap = Math.min(MAX_WAND_LEVEL, Math.max(1, Math.floor(playerLevel)) + LEVEL_HEADROOM);
  const rareSlot = Math.floor(rand() * STOCK_SIZE);
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
  return Array.from({ length: STOCK_SIZE }, (_, slot) => {
    const rare = slot === rareSlot;
    const rarity: Rarity = rare ? STOCK_MAX_RARITY : rand() < COMMON_SHARE ? 1 : 2;
    const wand = makeWand({ element: pick(ELEMENTS), role: pick(ROLES), rarity, level: 1 + Math.floor(rand() * cap) });
    const price = Math.round(wandPrice(wand.rarity, wand.level) * (rare ? RARE_PREMIUM : 1));
    return { slot, wandId: wand.id, price, rare };
  });
}

export const rotationOf = (nowMs: number): number => Math.floor(nowMs / ROTATION_MS);

/** Tüccarın şu anki stoğu ve satın alma. Yenileme zamanı gelince stok kendiliğinden değişir. */
export class WandStock {
  private rotation = -1;
  private entriesNow: StockEntry[] = [];
  private readonly sold = new Set<number>();

  constructor(
    private readonly merchantId: string,
    private readonly now: () => number,
    private readonly playerLevel: () => number,
  ) {}

  private refresh(): void {
    const r = rotationOf(this.now());
    if (r === this.rotation) return;
    this.rotation = r;
    this.entriesNow = generateStock(this.merchantId, r, this.playerLevel());
    this.sold.clear();
  }

  /** Şu anki 5 asa; satılanlar `sold: true`. */
  entries(): (StockEntry & { sold: boolean })[] {
    this.refresh();
    return this.entriesNow.map((e) => ({ ...e, sold: this.sold.has(e.slot) }));
  }

  /** Yenileme dönemi (stok değişince arayüzün yeniden çizmesi için) */
  get rotationIndex(): number {
    this.refresh();
    return this.rotation;
  }

  /** Bir sonraki yenilemeye kalan süre (ms) */
  timeLeftMs(): number {
    this.refresh();
    return ROTATION_MS - (this.now() % ROTATION_MS);
  }

  /** Stoktaki asayı satın alır: altın yetmeli, çantada yer olmalı. Başarısızsa hiçbir şey değişmez. */
  buy(
    slot: number,
    inventory: WandInventory,
    gold: { balance: () => number; spend: (n: number) => boolean },
    priceMultiplier = 1,
  ): Result<{ price: number; wandId: string }> {
    this.refresh();
    const entry = this.entriesNow[slot];
    if (!entry) return { ok: false, reason: 'Böyle bir asa yok.' };
    if (this.sold.has(slot)) return { ok: false, reason: 'Bu asa satıldı. Stok yenilenince yeni asalar gelir.' };
    if (!getWand(entry.wandId)) return { ok: false, reason: 'Böyle bir asa yok.' };
    const price = Math.max(1, Math.round(entry.price * priceMultiplier));
    if (!inventory.canAdd(entry.wandId, 1)) return { ok: false, reason: 'Çantanda asa için yer yok.' };
    if (gold.balance() < price || !gold.spend(price)) return { ok: false, reason: 'Yeterli altının yok.' };
    inventory.add(entry.wandId, 1);
    this.sold.add(slot);
    return { ok: true, price, wandId: entry.wandId };
  }
}
