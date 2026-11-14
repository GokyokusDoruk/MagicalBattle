import { describe, expect, it } from 'vitest';
import { ELEMENTS } from '../battle/damage/elements';
import { LOCATIONS } from '../world/locations';
import { getItem, itemCategory } from './items';
import { PlayerState } from './player';
import {
  DISTANCE_MULTIPLIER,
  TRADE_GOODS,
  TRADE_SELL_RATIO,
  buyGood,
  cityGoodMultiplier,
  ringDistance,
  sellGood,
  tradeBuyPrice,
  tradeSellPrice,
} from './trade';

const CITIES = LOCATIONS.filter((l) => l.kind === 'city');

describe('ticari mallar', () => {
  it('dört mal var, her element için bir tane, hepsi eşya kategorisinde', () => {
    expect(TRADE_GOODS).toHaveLength(4);
    expect(new Set(TRADE_GOODS.map((g) => g.element))).toEqual(new Set(ELEMENTS));
    for (const g of TRADE_GOODS) {
      const item = getItem(g.id)!;
      expect(item).toBeDefined();
      expect(itemCategory(item)).toBe('goods');
      expect(item.slot).toBeUndefined();
    }
  });

  it('halka uzaklığı: ateş-hava 1, ateş-su 1, ateş-toprak 2', () => {
    expect(ringDistance('fire', 'fire')).toBe(0);
    expect(ringDistance('fire', 'air')).toBe(1);
    expect(ringDistance('fire', 'water')).toBe(1);
    expect(ringDistance('fire', 'earth')).toBe(2);
  });

  it('şehir kendi elementinin malını ucuza, karşı elementinkini pahalıya satar', () => {
    expect(cityGoodMultiplier('ignis', 'kor-baharati')).toBe(DISTANCE_MULTIPLIER[0]);
    expect(cityGoodMultiplier('ignis', 'tas-cevheri')).toBe(DISTANCE_MULTIPLIER[2]);
    expect(cityGoodMultiplier('ignis', 'bulut-ipegi')).toBe(DISTANCE_MULTIPLIER[1]);
    expect(cityGoodMultiplier('still-crystal', 'derin-inci')).toBe(0.7);
    expect(cityGoodMultiplier('ignis', 'bilinmeyen')).toBe(1);
  });

  it('her malın şehirler arasında farklı fiyatı var (ticaret mümkün)', () => {
    for (const g of TRADE_GOODS) {
      const prices = new Set(CITIES.map((c) => tradeBuyPrice(c.id, g.id)));
      expect(prices.size, g.id).toBeGreaterThan(1);
    }
  });

  it('ucuz şehirde alıp karşı şehirde satmak kâr bırakır; aynı şehirde alıp satmak zarar', () => {
    for (const g of TRADE_GOODS) {
      const cheap = CITIES.find((c) => cityGoodMultiplier(c.id, g.id) === DISTANCE_MULTIPLIER[0])!;
      const dear = CITIES.find((c) => cityGoodMultiplier(c.id, g.id) === DISTANCE_MULTIPLIER[2])!;
      expect(tradeSellPrice(dear.id, g.id), g.id).toBeGreaterThan(tradeBuyPrice(cheap.id, g.id));
      expect(tradeSellPrice(cheap.id, g.id), g.id).toBeLessThan(tradeBuyPrice(cheap.id, g.id));
    }
  });

  it('satış fiyatı şehirdeki alış fiyatının yaklaşık yüzde 80 i', () => {
    for (const c of CITIES)
      for (const g of TRADE_GOODS) {
        const buy = tradeBuyPrice(c.id, g.id);
        expect(tradeSellPrice(c.id, g.id)).toBeLessThanOrEqual(Math.ceil(buy * TRADE_SELL_RATIO) + 1);
        expect(tradeSellPrice(c.id, g.id)).toBeGreaterThanOrEqual(Math.floor(buy * TRADE_SELL_RATIO) - 1);
      }
  });

  it('ahlak çarpanları alış ve satışı etkiler', () => {
    expect(tradeBuyPrice('ignis', 'tas-cevheri', 0.9)).toBeLessThan(tradeBuyPrice('ignis', 'tas-cevheri'));
    expect(tradeSellPrice('ignis', 'tas-cevheri', 1.15)).toBeGreaterThan(tradeSellPrice('ignis', 'tas-cevheri'));
  });

  it('satın alma: altın düşer, mal eklenir; altın ya da yer yetmezse hiçbir şey değişmez', () => {
    const p = new PlayerState();
    p.addMoney('kor', 500);
    const r = buyGood(p, 'ignis', 'kor-baharati', 3);
    expect(r.ok).toBe(true);
    expect(p.count('kor-baharati')).toBe(3);
    expect(p.balance('kor')).toBe(500 - tradeBuyPrice('ignis', 'kor-baharati') * 3);

    const poor = new PlayerState();
    expect(buyGood(poor, 'ignis', 'kor-baharati', 1).ok).toBe(false);
    expect(poor.count('kor-baharati')).toBe(0);

    const rich = new PlayerState();
    rich.addMoney('kor', 1_000_000);
    const room = rich.roomFor('kor-baharati');
    expect(buyGood(rich, 'ignis', 'kor-baharati', room + 1).ok).toBe(false);
    expect(rich.balance('kor')).toBe(1_000_000);
  });

  it('satış: mal düşer, altın artar; olmayan mal satılmaz', () => {
    const p = new PlayerState();
    p.addMoney('kor', 500);
    buyGood(p, 'ignis', 'tas-cevheri', 2); // Ignis'te Kor ile alınır
    const r = sellGood(p, 'still-crystal', 'tas-cevheri', 2); // Still Crystal'da Çiy ile satılır
    expect(r.ok).toBe(true);
    expect(p.count('tas-cevheri')).toBe(0);
    expect(p.balance('ciy')).toBe(tradeSellPrice('still-crystal', 'tas-cevheri') * 2);
    expect(sellGood(p, 'ignis', 'tas-cevheri', 1).ok).toBe(false);
  });

  it('ateş şehrinden alınan ateş malı, karşı (toprak) şehirde komşu (su) şehirden daha çok kazandırır', () => {
    const run = (sellCity: string): number => {
      const p = new PlayerState();
      p.addMoney('kor', 1000);
      buyGood(p, 'ignis', 'kor-baharati', 10);
      sellGood(p, sellCity, 'kor-baharati', 10);
      // Satış geliri, satılan şehrin biriminde birikir
      return p.balance(sellCity === 'still-crystal' ? 'ciy' : 'tunc');
    };
    const near = run('still-crystal'); // su: ateşe komşu
    const far = run('stone-heart'); // toprak: ateşin karşısı
    expect(far).toBeGreaterThan(near);
  });
});
