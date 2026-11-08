import { describe, expect, it } from 'vitest';
import { ARMOR_CAP } from '../battle/damage/config';
import { GEAR_SLOTS, ITEMS, getItem, isGear } from './items';
import { MAX_LEVEL, levelForXp, levelProgress, xpToReach } from './leveling';
import { MERCHANTS, getMerchant } from './merchants';
import { MAX_GOLD, MAX_STACK, PlayerState } from './player';
import { buy, buyPrice, sell, sellPrice } from './shop';

describe('katalog', () => {
  it('kimlikler benzersiz, fiyatlar pozitif', () => {
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    for (const i of ITEMS) {
      expect(i.price).toBeGreaterThan(0);
      expect(i.name.length).toBeGreaterThan(0);
    }
  });

  it('ekipmanın yeri ve zırhı var, zırh sınırlı; ganimette ikisi de yok', () => {
    for (const i of ITEMS) {
      if (isGear(i)) {
        expect(GEAR_SLOTS).toContain(i.slot);
        expect(i.armor).toBeGreaterThan(0);
        expect(i.armor).toBeLessThan(0.4);
      } else {
        expect(i.armor).toBeUndefined();
      }
    }
  });

  it('her yerin en iyi ekipmanı birlikte zırh sınırını aşmaz', () => {
    const best = GEAR_SLOTS.map((s) => Math.max(...ITEMS.filter((i) => i.slot === s).map((i) => i.armor ?? 0)));
    expect(best.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(ARMOR_CAP);
  });

  it('daha pahalı ekipman aynı yerde daha çok zırh verir (fiyat mantıklı)', () => {
    for (const slot of GEAR_SLOTS) {
      const gear = ITEMS.filter((i) => i.slot === slot).sort((a, b) => a.price - b.price);
      for (let k = 1; k < gear.length; k++) expect(gear[k].armor!).toBeGreaterThan(gear[k - 1].armor!);
    }
  });

  it('tüccarların sattığı her şey katalogda bir ekipman', () => {
    for (const m of MERCHANTS) {
      expect(m.stock.length).toBeGreaterThan(0);
      for (const id of m.stock) expect(isGear(getItem(id)!)).toBe(true);
    }
    expect(getMerchant('tuccar-kazim')?.locationId).toBe('ash');
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
    p.addGold(100);
    expect(p.spendGold(30)).toBe(true);
    expect(p.gold).toBe(70);
    expect(p.spendGold(71)).toBe(false);
    expect(p.gold).toBe(70);
    p.addGold(MAX_GOLD * 2);
    expect(p.gold).toBe(MAX_GOLD);
  });

  it('geçersiz miktarları yok sayar (negatif, NaN, kesirli)', () => {
    const p = new PlayerState();
    p.addGold(-50);
    p.addGold(Number.NaN);
    expect(p.gold).toBe(0);
    p.addGold(10.9);
    expect(p.gold).toBe(10);
    expect(p.spendGold(-1)).toBe(false);
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
    expect(p.addItem('sifali-ot', 3)).toBe(true);
    expect(p.addItem('yok-boyle-esya')).toBe(false);
    expect(p.removeItem('sifali-ot', 5)).toBe(false);
    expect(p.removeItem('sifali-ot', 2)).toBe(true);
    expect(p.count('sifali-ot')).toBe(1);
    p.removeItem('sifali-ot');
    expect(p.inventory()).toEqual([]);
  });

  it('yığın sınırı aşılmaz', () => {
    const p = new PlayerState();
    p.addItem('sifali-ot', 5000);
    expect(p.count('sifali-ot')).toBe(MAX_STACK);
  });

  it('ekipman kuşanılır, aynı yerdekinin yerine geçer, toplam zırh toplanır', () => {
    const p = new PlayerState();
    p.addItem('cirak-cuppesi');
    p.addItem('gezgin-cuppesi');
    p.addItem('tas-tilsim');
    expect(p.equip('cirak-cuppesi')).toBe(true);
    expect(p.armor).toBeCloseTo(0.05);
    p.equip('gezgin-cuppesi');
    expect(p.equipped.robe).toBe('gezgin-cuppesi');
    p.equip('tas-tilsim');
    expect(p.armor).toBeCloseTo(0.14);
    p.unequip('robe');
    expect(p.armor).toBeCloseTo(0.04);
  });

  it('sahip olunmayan ya da ganimet olan eşya kuşanılamaz', () => {
    const p = new PlayerState();
    expect(p.equip('cirak-cuppesi')).toBe(false);
    p.addItem('sifali-ot');
    expect(p.equip('sifali-ot')).toBe(false);
  });

  it('snapshot/restore her şeyi geri getirir', () => {
    const a = new PlayerState();
    a.addGold(250);
    a.addXp(320);
    a.addItem('sifali-ot', 4);
    a.addItem('bekci-cuppesi');
    a.equip('bekci-cuppesi');
    const b = new PlayerState();
    b.restore(a.snapshot());
    expect(b.snapshot()).toEqual(a.snapshot());
    expect(b.level).toBe(3);
    expect(b.armor).toBeCloseTo(0.18);
  });

  it('restore bozuk ya da hileli kaydı temizler', () => {
    const p = new PlayerState();
    p.restore({
      gold: -5,
      xp: Number.NaN,
      items: { 'sifali-ot': 99999, 'sahte-esya': 5, 'kristal-parcasi': -3, 'yun-sapka': 1.9 },
      equipped: { robe: 'yun-sapka', hat: 'tilsimli-sapka', amulet: 'tas-tilsim' }, // yanlış yer, sahip değil, sahip değil
    });
    expect(p.gold).toBe(0);
    expect(p.xp).toBe(0);
    expect(p.count('sifali-ot')).toBe(MAX_STACK);
    expect(p.count('sahte-esya')).toBe(0);
    expect(p.count('kristal-parcasi')).toBe(0);
    expect(p.count('yun-sapka')).toBe(1);
    expect(p.equipped).toEqual({}); // hiçbiri geçerli değil
    p.restore(undefined);
    expect(p.snapshot()).toEqual({ gold: 0, xp: 0, items: {}, equipped: {} });
  });

  it('değişince dinleyiciler çağrılır', () => {
    const p = new PlayerState();
    let n = 0;
    p.onChange(() => n++);
    p.addGold(5);
    p.addItem('sifali-ot');
    p.addXp(5);
    expect(n).toBe(3);
  });
});

describe('alışveriş', () => {
  const kazim = getMerchant('tuccar-kazim')!;

  it('satın alma altını düşer, ekipmanı verir ve boş yerse kuşandırır', () => {
    const p = new PlayerState();
    p.addGold(100);
    const r = buy(p, kazim, 'cirak-cuppesi');
    expect(r).toEqual({ ok: true, price: 60 });
    expect(p.gold).toBe(40);
    expect(p.count('cirak-cuppesi')).toBe(1);
    expect(p.equipped.robe).toBe('cirak-cuppesi');
  });

  it('yetersiz altında reddeder ve hiçbir şey değişmez', () => {
    const p = new PlayerState();
    p.addGold(59);
    expect(buy(p, kazim, 'cirak-cuppesi')).toMatchObject({ ok: false });
    expect(p.gold).toBe(59);
    expect(p.count('cirak-cuppesi')).toBe(0);
  });

  it('tüccarda olmayan eşyayı ve ikinci kopyayı satmaz', () => {
    const p = new PlayerState();
    p.addGold(5000);
    expect(buy(p, kazim, 'bekci-cuppesi')).toMatchObject({ ok: false }); // başka tüccarda
    expect(buy(p, kazim, 'sifali-ot')).toMatchObject({ ok: false }); // ganimet satılmaz
    buy(p, kazim, 'yun-sapka');
    const gold = p.gold;
    expect(buy(p, kazim, 'yun-sapka')).toMatchObject({ ok: false, reason: expect.stringContaining('zaten') });
    expect(p.gold).toBe(gold);
  });

  it('yeni ekipman daha çok zırh veriyorsa kuşanılır, vermiyorsa eskisi kalır', () => {
    const p = new PlayerState();
    p.addGold(10000);
    const nesrin = getMerchant('tuccar-nesrin')!;
    buy(p, nesrin, 'gezgin-cuppesi'); // .10
    buy(p, kazim, 'cirak-cuppesi'); // .05, daha zayıf
    expect(p.equipped.robe).toBe('gezgin-cuppesi');
    expect(p.count('cirak-cuppesi')).toBe(1);
  });

  it('ganimet yarı fiyatına satılır, altın gelir, eşya düşer', () => {
    const p = new PlayerState();
    p.addItem('kristal-parcasi', 3);
    const r = sell(p, 'kristal-parcasi', 2);
    expect(r).toEqual({ ok: true, price: 22 }); // 11 × 2
    expect(p.gold).toBe(22);
    expect(p.count('kristal-parcasi')).toBe(1);
  });

  it('olmayan eşya ve fazla adet satılamaz; kuşanılan ekipman önce çıkarılmalı', () => {
    const p = new PlayerState();
    expect(sell(p, 'sifali-ot')).toMatchObject({ ok: false });
    p.addItem('sifali-ot', 1);
    expect(sell(p, 'sifali-ot', 2)).toMatchObject({ ok: false });
    p.addGold(100);
    buy(p, kazim, 'yun-sapka');
    expect(sell(p, 'yun-sapka')).toMatchObject({ ok: false, reason: expect.stringContaining('çıkar') });
    p.unequip('hat');
    expect(sell(p, 'yun-sapka')).toMatchObject({ ok: true, price: 20 });
  });

  it('geçersiz adet ve eşya reddedilir', () => {
    const p = new PlayerState();
    p.addItem('sifali-ot', 5);
    expect(sell(p, 'sifali-ot', 0)).toMatchObject({ ok: false });
    expect(sell(p, 'sifali-ot', -2)).toMatchObject({ ok: false });
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
});
