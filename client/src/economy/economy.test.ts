import { describe, expect, it } from 'vitest';
import { LEGACY_BAGS } from './equipment';
import { GEAR_SLOTS, ITEMS, getItem, isGear } from './items';
import { MAX_LEVEL, levelForXp, levelProgress, xpToReach } from './leveling';
import { MERCHANTS, getMerchant } from './merchants';
import { LOCATIONS } from '../world/locations';
import { MAX_STACK, PlayerState } from './player';
import { MAX_MONEY } from './currency';
import { buyItem, buyPrice, sell, sellPrice } from './shop';

describe('katalog', () => {
  it('kimlikler benzersiz, fiyatlar pozitif', () => {
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    for (const i of ITEMS) {
      expect(i.price).toBeGreaterThan(0);
      expect(i.name.length).toBeGreaterThan(0);
    }
  });

  it('ekipmanın yeri, elementi ve nadirliği var; ganimette hiçbiri yok', () => {
    for (const i of ITEMS) {
      if (isGear(i)) {
        expect(GEAR_SLOTS).toContain(i.slot);
        if (!LEGACY_BAGS.some((b) => b.id === i.id)) expect(i.element).toBeDefined(); // eski çantaların elementi yoktur
        expect(i.rarity).toBeGreaterThanOrEqual(1);
        expect(i.rarity).toBeLessThanOrEqual(6);
      } else {
        expect(i.armor).toBeUndefined();
        expect(i.element).toBeUndefined();
        expect(i.rarity).toBeUndefined();
      }
    }
  });

  it('tüccarlar şehirlerde: her şehirde bir tüccar, bir asacı ve bir hancı, Ignis tüccarı Kazım', () => {
    for (const city of LOCATIONS.filter((l) => l.kind === 'city')) {
      expect(MERCHANTS.filter((m) => m.locationId === city.id && m.kind === 'merchant')).toHaveLength(1);
      expect(MERCHANTS.filter((m) => m.locationId === city.id && m.kind === 'wandsmith')).toHaveLength(1);
      expect(MERCHANTS.filter((m) => m.locationId === city.id && m.kind === 'innkeeper')).toHaveLength(1);
    }
    // Köylerde yalnızca yan görev veren kişi vardır (han, tüccar ve asacı yok)
    for (const m of MERCHANTS) {
      const kind = LOCATIONS.find((l) => l.id === m.locationId)?.kind;
      expect(kind === 'city' || (kind === 'village' && m.kind === 'questgiver'), m.id).toBe(true);
    }
    for (const v of LOCATIONS.filter((l) => l.kind === 'village')) {
      expect(MERCHANTS.filter((m) => m.locationId === v.id)).toHaveLength(1);
      expect(MERCHANTS.find((m) => m.locationId === v.id)?.kind).toBe('questgiver');
    }
    expect(getMerchant('tuccar-kazim')?.locationId).toBe('ignis');
    expect(getMerchant('yok')).toBeUndefined();
  });
});

describe('seviye', () => {
  it('eğri: 1→0, 2→100, 3→300, 4→600 XP', () => {
    expect([1, 2, 3, 4].map(xpToReach)).toEqual([0, 100, 300, 600]);
  });

  it('XP\'den seviye, sınırlarda doğru', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(299)).toBe(2);
    expect(levelForXp(300)).toBe(3);
    expect(levelForXp(1e12)).toBe(MAX_LEVEL);
    expect(levelForXp(-5)).toBe(1);
    expect(levelForXp(Number.NaN)).toBe(1);
  });

  it('seviye ilerlemesi: oran ve kalan XP', () => {
    expect(levelProgress(0)).toMatchObject({ level: 1, into: 0, needed: 100, ratio: 0 });
    expect(levelProgress(150)).toMatchObject({ level: 2, into: 50, needed: 200, ratio: 0.25 });
    expect(levelProgress(xpToReach(MAX_LEVEL))).toMatchObject({ level: MAX_LEVEL, ratio: 1, needed: 0 });
  });

  it('eğri artan ve her seviye bir öncekinden daha çok XP ister', () => {
    for (let l = 2; l < MAX_LEVEL; l++) {
      expect(xpToReach(l + 1) - xpToReach(l)).toBeGreaterThan(xpToReach(l) - xpToReach(l - 1));
    }
  });
});

describe('PlayerState', () => {
  it('altın ekler ve harcar, yetmezse reddeder, üst sınırı aşmaz', () => {
    const p = new PlayerState();
    p.addMoney('kor', 100);
    expect(p.spendMoney('kor', 30)).toBe(true);
    expect(p.balance('kor')).toBe(70);
    expect(p.spendMoney('kor', 71)).toBe(false);
    expect(p.balance('kor')).toBe(70);
    p.addMoney('kor', MAX_MONEY * 2);
    expect(p.balance('kor')).toBe(MAX_MONEY);
  });

  it('geçersiz miktarları yok sayar (negatif, NaN, kesirli)', () => {
    const p = new PlayerState();
    p.addMoney('kor', -50);
    p.addMoney('kor', Number.NaN);
    expect(p.balance('kor')).toBe(0);
    p.addMoney('kor', 10.9);
    expect(p.balance('kor')).toBe(10);
    expect(p.spendMoney('kor', -1)).toBe(false);
    expect(p.addXp(-5)).toBe(0);
  });

  it('XP seviye atlatır ve atlanan seviye sayısını döndürür', () => {
    const p = new PlayerState();
    expect(p.addXp(50)).toBe(0);
    expect(p.addXp(60)).toBe(1);
    expect(p.level).toBe(2);
    expect(p.addXp(1000)).toBeGreaterThan(1);
  });

  it('eşya ekler ve çıkarır; bilinmeyen eşya ve yetersiz miktar reddedilir', () => {
    const p = new PlayerState();
    expect(p.addItem('tas-cevheri', 3)).toBe(true);
    expect(p.addItem('yok-boyle-esya')).toBe(false);
    expect(p.removeItem('tas-cevheri', 5)).toBe(false);
    expect(p.removeItem('tas-cevheri', 2)).toBe(true);
    expect(p.count('tas-cevheri')).toBe(1);
    p.removeItem('tas-cevheri');
    expect(p.inventory()).toEqual([]);
  });

  it('yığın sınırı aşılmaz', () => {
    const p = new PlayerState();
    p.addItem('tas-cevheri', 5000);
    expect(p.count('tas-cevheri')).toBe(MAX_STACK);
  });

  it('ekipman kuşanılır, aynı yerdekinin yerine geçer, zırh parçaları toplanır', () => {
    const p = new PlayerState();
    p.addItem('eq-robe-earth-1-1');
    p.addItem('eq-robe-earth-3-1');
    p.addItem('eq-hat-earth-2-1');
    expect(p.equip('eq-robe-earth-1-1')).toBe(true);
    expect(p.armor).toBeCloseTo(0.04);
    p.equip('eq-robe-earth-3-1');
    expect(p.equipped.robe).toBe('eq-robe-earth-3-1');
    p.equip('eq-hat-earth-2-1');
    expect(p.armor).toBeCloseTo(0.09 + 0.035);
    p.unequip('robe');
    expect(p.armor).toBeCloseTo(0.035);
  });

  it('sahip olunmayan ya da ganimet olan eşya kuşanılamaz', () => {
    const p = new PlayerState();
    expect(p.equip('eq-robe-earth-1-1')).toBe(false);
    p.addItem('tas-cevheri');
    expect(p.equip('tas-cevheri')).toBe(false);
  });

  it('snapshot/restore her şeyi geri getirir', () => {
    const a = new PlayerState();
    a.addMoney('kor', 250);
    a.addXp(320);
    a.addItem('tas-cevheri', 4);
    a.addItem('eq-robe-fire-4-1');
    a.equip('eq-robe-fire-4-1');
    const b = new PlayerState();
    b.restore(a.snapshot());
    expect(b.snapshot()).toEqual(a.snapshot());
    expect(b.level).toBe(3);
    expect(b.armor).toBeCloseTo(0.12);
  });

  it('restore bozuk ya da hileli kaydı temizler', () => {
    const p = new PlayerState();
    p.restore({
      gold: -5,
      xp: Number.NaN,
      items: { 'tas-cevheri': 99999, 'sahte-esya': 5, 'derin-inci': -3, 'eq-hat-earth-1-1': 1.9 },
      equipped: { robe: 'eq-hat-earth-1-1', hat: 'eq-hat-air-2-1', ring: 'eq-ring-fire-1-1' }, // yanlış yer, sahip değil, sahip değil
    });
    expect(p.balance('kor')).toBe(0);
    expect(p.xp).toBe(0);
    expect(p.count('tas-cevheri')).toBe(MAX_STACK);
    expect(p.count('sahte-esya')).toBe(0);
    expect(p.count('derin-inci')).toBe(0);
    expect(p.count('eq-hat-earth-1-1')).toBe(1);
    expect(p.equipped).toEqual({}); // hiçbiri geçerli değil
    p.restore(undefined);
    expect(p.snapshot()).toEqual({ wallet: { kor: 0, ciy: 0, tunc: 0, tuy: 0 }, xp: 0, items: {}, equipped: {}, hp: null });
  });

  it('eski kayıt: eski zırh kimlikleri yeni eşyalara dönüşür, tılsım yüzük olur; eski çanta aynen kalır', () => {
    const p = new PlayerState();
    p.restore({
      gold: 10,
      xp: 0,
      items: { 'cirak-cuppesi': 1, 'yun-sapka': 1, 'tas-tilsim': 1, 'kucuk-canta': 1, 'tas-cevheri': 2 },
      equipped: { robe: 'cirak-cuppesi', hat: 'yun-sapka', amulet: 'tas-tilsim', bag: 'kucuk-canta' } as never,
    });
    expect(p.count('eq-robe-earth-1-1')).toBe(1);
    expect(p.count('cirak-cuppesi')).toBe(0);
    expect(p.equipped).toEqual({ robe: 'eq-robe-earth-1-1', hat: 'eq-hat-earth-1-1', ring: 'eq-ring-earth-1-1', bag: 'kucuk-canta' }); // çanta dönüşmez
    expect(p.count('kucuk-canta')).toBe(1);
    expect(getItem('kucuk-canta')?.carry).toEqual({ wands: 3, goods: 20, gear: 2 });
    expect(getItem('kucuk-canta')?.element).toBeUndefined();
    expect(p.count('tas-cevheri')).toBe(2);
  });

  it('değişince dinleyiciler çağrılır', () => {
    const p = new PlayerState();
    let n = 0;
    p.onChange(() => n++);
    p.addMoney('kor', 5);
    p.addItem('tas-cevheri');
    p.addXp(5);
    expect(n).toBe(3);
  });
});

describe('alışveriş', () => {
  it('satın alma altını düşer, ekipmanı verir ve boş yerse kuşandırır', () => {
    const p = new PlayerState();
    p.addMoney('kor', 100);
    const r = buyItem(p, 'eq-robe-earth-1-1', 60);
    expect(r).toEqual({ ok: true, price: 60 });
    expect(p.balance('kor')).toBe(40);
    expect(p.count('eq-robe-earth-1-1')).toBe(1);
    expect(p.equipped.robe).toBe('eq-robe-earth-1-1');
  });

  it('yetersiz altında reddeder ve hiçbir şey değişmez', () => {
    const p = new PlayerState();
    p.addMoney('kor', 59);
    expect(buyItem(p, 'eq-robe-earth-1-1', 60)).toMatchObject({ ok: false });
    expect(p.balance('kor')).toBe(59);
    expect(p.count('eq-robe-earth-1-1')).toBe(0);
    expect(buyItem(p, 'yok', 1)).toMatchObject({ ok: false });
  });

  it('aynı eşyadan birden fazla alınabilir', () => {
    const p = new PlayerState();
    p.addMoney('kor', 500);
    buyItem(p, 'eq-hat-fire-1-1', 40);
    expect(buyItem(p, 'eq-hat-fire-1-1', 40)).toMatchObject({ ok: true });
    expect(p.count('eq-hat-fire-1-1')).toBe(2);
  });

  it('daha nadir ekipman kuşanılır, daha az nadir olan eskisini bırakmaz', () => {
    const p = new PlayerState();
    p.addMoney('kor', 10000);
    buyItem(p, 'eq-robe-water-3-1', 1);
    buyItem(p, 'eq-robe-fire-1-1', 1); // daha az nadir
    expect(p.equipped.robe).toBe('eq-robe-water-3-1');
    expect(p.count('eq-robe-fire-1-1')).toBe(1);
    buyItem(p, 'eq-robe-air-4-1', 1); // daha nadir
    expect(p.equipped.robe).toBe('eq-robe-air-4-1');
  });

  it('ganimet yarı fiyatına satılır, altın gelir, eşya düşer', () => {
    const p = new PlayerState();
    p.addItem('derin-inci', 3);
    const r = sell(p, 'derin-inci', 2);
    expect(r).toEqual({ ok: true, price: 70 }); // 35 × 2
    expect(p.balance('kor')).toBe(70);
    expect(p.count('derin-inci')).toBe(1);
  });

  it('olmayan eşya ve fazla adet satılamaz; giyilen tek kopya önce çıkarılmalı', () => {
    const p = new PlayerState();
    expect(sell(p, 'tas-cevheri')).toMatchObject({ ok: false });
    p.addItem('tas-cevheri', 1);
    expect(sell(p, 'tas-cevheri', 2)).toMatchObject({ ok: false });
    p.addMoney('kor', 100);
    buyItem(p, 'eq-hat-earth-1-1', 40); // kuşanılır
    expect(sell(p, 'eq-hat-earth-1-1')).toMatchObject({ ok: false, reason: expect.stringContaining('çıkar') });
    p.unequip('hat');
    expect(sell(p, 'eq-hat-earth-1-1')).toMatchObject({ ok: true, price: 20 });
  });

  it('giyilen eşyadan fazla kopya varsa fazlası satılır', () => {
    const p = new PlayerState();
    p.addItem('eq-hat-earth-1-1', 2);
    p.equip('eq-hat-earth-1-1');
    expect(sell(p, 'eq-hat-earth-1-1', 1)).toMatchObject({ ok: true });
    expect(p.isEquipped('eq-hat-earth-1-1')).toBe(true);
    expect(sell(p, 'eq-hat-earth-1-1', 1)).toMatchObject({ ok: false });
  });

  it('geçersiz adet ve eşya reddedilir', () => {
    const p = new PlayerState();
    p.addItem('tas-cevheri', 5);
    expect(sell(p, 'tas-cevheri', 0)).toMatchObject({ ok: false });
    expect(sell(p, 'tas-cevheri', -2)).toMatchObject({ ok: false });
    expect(sell(p, 'yok')).toMatchObject({ ok: false });
  });

  it('al-sat döngüsünden kâr edilemez (satış fiyatı alış fiyatından düşük)', () => {
    for (const i of ITEMS) expect(sellPrice(i.price)).toBeLessThan(buyPrice(i.price));
  });

  it('ahlak çarpanları fiyatlara uygulanır ama fiyat hiçbir zaman 0\'ın altına inmez', () => {
    expect(buyPrice(100, 0.9)).toBe(90);
    expect(sellPrice(100, 1.2)).toBe(60);
    expect(buyPrice(1, 0.01)).toBe(1);
    expect(sellPrice(1, 0.01)).toBe(1);
  });

  it('getItem ekipmanı bulur', () => {
    expect(getItem('eq-ring-air-6-1')?.timeBonus).toBeGreaterThan(0);
  });
});

describe('kaldırılan ganimet eşyaları (Task 37)', () => {
  it('eski kayıttaki ot, kristal, toz ve post yarı değerinden Kor olur ve çantaya girmez', () => {
    const p = new PlayerState();
    p.restore({ items: { 'sifali-ot': 10, 'kristal-parcasi': 2, 'ates-tozu': 1, 'kurt-postu': 3 } } as never);
    expect(p.count('sifali-ot')).toBe(0);
    expect(p.balance('kor')).toBe(4 * 10 + 11 * 2 + 7 * 1 + 17 * 3);
    expect(p.inventory()).toEqual([]);
  });
});
