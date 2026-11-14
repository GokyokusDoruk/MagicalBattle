import { describe, expect, it } from 'vitest';
import { LOCATIONS } from '../world/locations';
import {
  CONVERT_LOSS,
  CURRENCIES,
  CURRENCY_ELEMENT,
  ELEMENT_CURRENCY,
  MAX_MONEY,
  cityCurrency,
  convertedAmount,
  currencyAt,
  formatMoney,
  locationCurrency,
  sanitizeWallet,
} from './currency';
import { PlayerState } from './player';
import { buyItem, sell } from './shop';
import { buyGood, sellGood } from './trade';

describe('para birimleri', () => {
  it('dört birim, her biri bir elementin birimi ve tersine çevrilebilir', () => {
    expect(CURRENCIES).toEqual(['kor', 'ciy', 'tunc', 'tuy']);
    for (const c of CURRENCIES) expect(ELEMENT_CURRENCY[CURRENCY_ELEMENT[c]]).toBe(c);
    expect(ELEMENT_CURRENCY).toEqual({ fire: 'kor', water: 'ciy', earth: 'tunc', air: 'tuy' });
  });

  it('şehirler kendi elementinin birimiyle çalışır', () => {
    expect(cityCurrency('ignis')).toBe('kor');
    expect(cityCurrency('still-crystal')).toBe('ciy');
    expect(cityCurrency('stone-heart')).toBe('tunc');
    expect(cityCurrency('abyss')).toBe('tuy');
  });

  it('köyde iki birimden biri çıkar, ikisi de görülür; arenada Kor', () => {
    const ash = LOCATIONS.find((l) => l.id === 'ash')!; // ateş + hava
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(locationCurrency(ash, () => (i % 2 === 0 ? 0.1 : 0.9)));
    expect([...seen].sort()).toEqual(['kor', 'tuy']);
    expect(locationCurrency({ elements: [] })).toBe('kor');
  });

  it('açık dünyada en yakın şehrin birimi geçerlidir', () => {
    const ignis = LOCATIONS.find((l) => l.id === 'ignis')!;
    const still = LOCATIONS.find((l) => l.id === 'still-crystal')!;
    expect(currencyAt(LOCATIONS, ignis.x + 3, ignis.y + 3)).toBe('kor');
    expect(currencyAt(LOCATIONS, still.x - 2, still.y - 4)).toBe('ciy');
  });
});

describe('çevirme', () => {
  it('her çevirmede %25 kayıp: 100 → 75, aşağı yuvarlanır', () => {
    expect(CONVERT_LOSS).toBe(0.25);
    expect(convertedAmount(100)).toBe(75);
    expect(convertedAmount(10)).toBe(7);
    expect(convertedAmount(1)).toBe(0);
    expect(convertedAmount(0)).toBe(0);
    expect(convertedAmount(-5)).toBe(0);
  });

  it('gidip gelmek kaybettirir (arbitraj yok)', () => {
    expect(convertedAmount(convertedAmount(1000))).toBeLessThan(1000 * 0.6);
  });
});

describe('cüzdan ve oyuncu', () => {
  it('birimler birbirinden bağımsızdır; harcamada yeterli bakiye gerekir', () => {
    const p = new PlayerState();
    p.addMoney('kor', 100);
    p.addMoney('ciy', 30);
    expect(p.wallet).toEqual({ kor: 100, ciy: 30, tunc: 0, tuy: 0 });
    expect(p.spendMoney('ciy', 31)).toBe(false);
    expect(p.spendMoney('tunc', 1)).toBe(false);
    expect(p.spendMoney('kor', 40)).toBe(true);
    expect(p.balance('kor')).toBe(60);
    expect(p.balance('ciy')).toBe(30);
  });

  it('bakiye üst sınırı vardır', () => {
    const p = new PlayerState();
    p.addMoney('tuy', MAX_MONEY * 2);
    expect(p.balance('tuy')).toBe(MAX_MONEY);
  });

  it('kayıt: cüzdan yazılır ve okunur; eski altın Kor olur; bozuk değerler temizlenir', () => {
    const p = new PlayerState();
    p.addMoney('tuy', 12);
    const snap = p.snapshot();
    const q = new PlayerState();
    q.restore(snap);
    expect(q.wallet).toEqual({ kor: 0, ciy: 0, tunc: 0, tuy: 12 });
    const legacy = new PlayerState();
    legacy.restore({ gold: 250 } as never);
    expect(legacy.wallet).toEqual({ kor: 250, ciy: 0, tunc: 0, tuy: 0 });
    expect(sanitizeWallet({ kor: -5, ciy: 'x', tunc: 1.9, tuy: 1e12 })).toEqual({ kor: 0, ciy: 0, tunc: 1, tuy: MAX_MONEY });
    expect(sanitizeWallet(null)).toEqual({ kor: 0, ciy: 0, tunc: 0, tuy: 0 });
  });

  it('dükkân ve ticaret yalnızca şehrin biriminden öder', () => {
    const p = new PlayerState();
    p.addMoney('kor', 1000);
    expect(buyItem(p, 'iksir-kucuk', 25, 'ciy').ok).toBe(false); // Çiy yok
    expect(buyItem(p, 'iksir-kucuk', 25, 'kor').ok).toBe(true);
    expect(p.balance('kor')).toBe(975);
    expect(sell(p, 'iksir-kucuk', 1, 1, 'tunc').ok).toBe(true); // Tunç'ta satılınca Tunç kazanılır
    expect(p.balance('tunc')).toBeGreaterThan(0);
    expect(p.balance('kor')).toBe(975);
    // Ticaret: Ignis'te Kor, Abyss'te Tüy
    expect(buyGood(p, 'ignis', 'kor-baharati', 1).ok).toBe(true);
    expect(p.balance('kor')).toBeLessThan(975);
    expect(sellGood(p, 'abyss', 'kor-baharati', 1).ok).toBe(true);
    expect(p.balance('tuy')).toBeGreaterThan(0);
  });

  it('para biçimi birimi yazar', () => {
    expect(formatMoney(1250, 'kor')).toMatch(/Kor$/);
    expect(formatMoney(5, 'tuy')).toBe('5 Tüy');
  });
});
