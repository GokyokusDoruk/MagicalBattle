import { describe, expect, it } from 'vitest';
import { MERCHANTS, wandPriceFactorOf } from '../economy/merchants';
import { wandIdOf, wandPrice, type Rarity } from './catalog';
import { WandInventory } from './inventory';
import { WAND_SELL_RATIO, sellWand, wandBuyPrice, wandSellPrice } from './shop';

const wand = (rarity: Rarity, level: number): string => wandIdOf({ element: 'fire', role: 'attack', rarity, level });

describe('asacı', () => {
  it('her şehirde bir asacı var, fiyat farkı en çok yüzde 10', () => {
    const smiths = MERCHANTS.filter((m) => m.kind === 'wandsmith');
    expect(smiths).toHaveLength(4);
    for (const s of smiths) {
      const f = wandPriceFactorOf(s);
      expect(f).toBeGreaterThanOrEqual(0.9);
      expect(f).toBeLessThanOrEqual(1.1);
    }
    expect(new Set(smiths.map((s) => wandPriceFactorOf(s))).size).toBeGreaterThan(1);
    expect(wandPriceFactorOf(MERCHANTS.find((m) => m.kind === 'merchant')!)).toBe(1);
  });

  it('satış fiyatı değerin yarısı, şehir farkı ve ahlak çarpanı uygulanır', () => {
    const id = wand(3, 10);
    const value = wandPrice(3, 10);
    expect(wandSellPrice(id)).toBe(Math.floor(value * WAND_SELL_RATIO));
    expect(wandSellPrice(id, 1.1)).toBeGreaterThan(wandSellPrice(id, 0.9));
    expect(wandSellPrice(id, 1, 1.15)).toBeGreaterThan(wandSellPrice(id));
    expect(wandBuyPrice(100, 1.1, 1)).toBe(110);
    expect(wandBuyPrice(100, 0.9, 0.9)).toBe(81);
  });

  it('asa asacıdan, aynı asanın satış fiyatından her zaman pahalıya alınır (kâr döngüsü yok)', () => {
    for (const f of [0.9, 1, 1.05, 1.1])
      for (const f2 of [0.9, 1, 1.05, 1.1]) {
        expect(wandBuyPrice(wandPrice(2, 8), f), `${f}/${f2}`).toBeGreaterThan(wandSellPrice(wand(2, 8), f2));
      }
  });

  it('asa satmak: asa gider, altın gelir; kuşanılı son kopya ve olmayan asa satılamaz', () => {
    const inv = new WandInventory();
    inv.add(wand(1, 1));
    inv.add(wand(2, 5));
    let gold = 0;
    const g = { add: (n: number) => (gold += n) };
    expect(inv.equipped).toBe(wand(1, 1));
    expect(sellWand(inv, g, wand(1, 1)).ok).toBe(false); // kuşanılı
    expect(sellWand(inv, g, wand(6, 30)).ok).toBe(false); // sahip değil
    const r = sellWand(inv, g, wand(2, 5), 1.1);
    expect(r.ok).toBe(true);
    expect(inv.count(wand(2, 5))).toBe(0);
    expect(gold).toBe(wandSellPrice(wand(2, 5), 1.1));
  });

  it('kuşanılı asadan fazla kopya varsa fazlası satılır', () => {
    const inv = new WandInventory();
    inv.add(wand(1, 1), 2);
    const g = { add: () => {} };
    expect(sellWand(inv, g, wand(1, 1)).ok).toBe(true);
    expect(inv.count(wand(1, 1))).toBe(1);
    expect(sellWand(inv, g, wand(1, 1)).ok).toBe(false);
  });
});
