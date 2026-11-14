import { describe, expect, it } from 'vitest';
import { ELEMENTS } from '../battle/damage/elements';
import { powerFactor } from '../battle/damage/calculate';
import { runBattle, type BattleIO, type TurnReport } from '../battle/flow/controller';
import { BattleEngine } from '../battle/flow/engine';
import { buildShape } from '../battle/flow/shapes';
import { analyzeStrokes } from '../battle/gesture/analyze';
import {
  ELEMENT_MATCH,
  MAX_WAND_LEVEL,
  PRICE_PER_LEVEL,
  RARITIES,
  ROLES,
  allWands,
  describeWand,
  getWand,
  makeWand,
  normalizeWandId,
  parseWandId,
  wandEffect,
  wandIdOf,
  wandPrice,
  wandStrength,
  type Rarity,
  type WandRole,
} from './catalog';
import { WandInventory } from './inventory';
import { LEVEL_HEADROOM, RARE_PREMIUM, ROTATION_MS, STOCK_SIZE, WandStock, generateStock, rotationOf } from './stock';

const id = (e: (typeof ELEMENTS)[number], r: WandRole, rarity: Rarity, level: number) => wandIdOf({ element: e, role: r, rarity, level });

describe('katalog: asa kimliği ve özellikleri', () => {
  it('4 element × 2 rol × 6 nadirlik × 30 seviye = 1440 asa, kimlikler benzersiz', () => {
    const all = allWands();
    expect(all).toHaveLength(1440);
    expect(new Set(all.map((w) => w.id)).size).toBe(1440);
    expect(ELEMENTS.length * ROLES.length * RARITIES.length * MAX_WAND_LEVEL).toBe(1440);
  });

  it('kimlik özellikleri taşır ve geri okunur', () => {
    const w = makeWand({ element: 'earth', role: 'defense', rarity: 4, level: 12 });
    expect(w.id).toBe('wand-earth-defense-4-12');
    expect(parseWandId(w.id)).toEqual({ element: 'earth', role: 'defense', rarity: 4, level: 12 });
    expect(getWand(w.id)).toBe(w);
    expect(w.name).toBe('Destansı Toprak Savunma Asası');
  });

  it('eski seviyesiz kimlik seviye 1 sayılır; geçersiz kimlikler reddedilir', () => {
    expect(parseWandId('wand-fire-attack-3')).toEqual({ element: 'fire', role: 'attack', rarity: 3, level: 1 });
    expect(normalizeWandId('wand-fire-attack-3')).toBe('wand-fire-attack-3-1');
    expect(normalizeWandId('wand-fire-attack-3-7')).toBe('wand-fire-attack-3-7');
    for (const bad of ['wand-fire-attack-7-1', 'wand-fire-attack-3-0', 'wand-fire-attack-3-31', 'wand-wind-attack-1-1', 'wand-fire-heal-1-1', 'sihir', '']) {
      expect(parseWandId(bad), bad).toBeNull();
      expect(getWand(bad)).toBeUndefined();
    }
  });

  it('güç göstergesi nadirlik ve seviyeyle artar; Sıradan Sv1 = 0', () => {
    expect(wandStrength(1, 1)).toBe(0);
    for (const r of RARITIES) for (let l = 2; l <= MAX_WAND_LEVEL; l++) expect(wandStrength(r, l)).toBeGreaterThan(wandStrength(r, l - 1));
    for (let r = 2; r <= 6; r++) expect(wandStrength(r as Rarity, 10)).toBeGreaterThan(wandStrength((r - 1) as Rarity, 10));
  });

  it('rol dengesi: saldırı asası saldırıda %25 güçlü, savunmada %25 zayıf; savunma asasında tersi', () => {
    const a = makeWand({ element: 'fire', role: 'attack', rarity: 1, level: 1 });
    const d = makeWand({ element: 'fire', role: 'defense', rarity: 1, level: 1 });
    expect(a.attackMultiplier).toBeCloseTo(1.25, 6);
    expect(a.defenseMultiplier).toBeCloseTo(0.75, 6);
    expect(d.attackMultiplier).toBeCloseTo(0.75, 6);
    expect(d.defenseMultiplier).toBeCloseTo(1.25, 6);
  });

  it('seviye ve nadirlik saldırıyı, savunmayı ve büyü süresini birlikte artırır', () => {
    for (const role of ROLES) {
      const low = makeWand({ element: 'air', role, rarity: 2, level: 3 });
      const hi = makeWand({ element: 'air', role, rarity: 2, level: 20 });
      const rare = makeWand({ element: 'air', role, rarity: 5, level: 3 });
      for (const better of [hi, rare]) {
        expect(better.attackMultiplier).toBeGreaterThan(low.attackMultiplier);
        expect(better.defenseMultiplier).toBeGreaterThan(low.defenseMultiplier);
        expect(better.timeBonusSec).toBeGreaterThan(low.timeBonusSec);
      }
    }
    expect(makeWand({ element: 'fire', role: 'attack', rarity: 1, level: 1 }).timeBonusSec).toBe(0);
  });

  it('element eşleşirse hasar %50 artar; yalnız saldırı aşamasında', () => {
    const w = makeWand({ element: 'fire', role: 'attack', rarity: 1, level: 1 });
    const match = wandEffect(w, 'fire', 'attack');
    const other = wandEffect(w, 'water', 'attack');
    expect(match.elementMatch).toBe(true);
    expect(other.elementMatch).toBe(false);
    expect(match.powerMultiplier / other.powerMultiplier).toBeCloseTo(ELEMENT_MATCH, 6);
    expect(ELEMENT_MATCH).toBe(1.5);
    expect(match.powerMultiplier).toBeCloseTo(1.25 * 1.5, 6);
    // savunmada hasar çarpanı yok, alınan hasar savunma gücünün tersi
    const def = wandEffect(w, 'fire', 'defense');
    expect(def.powerMultiplier).toBe(1);
    expect(def.takenMultiplier).toBeCloseTo(1 / 0.75, 6);
  });

  it('savunma asası alınan hasarı azaltır, saldırı asası artırır', () => {
    const d = wandEffect(makeWand({ element: 'earth', role: 'defense', rarity: 1, level: 1 }), 'water', 'defense');
    const a = wandEffect(makeWand({ element: 'earth', role: 'attack', rarity: 1, level: 1 }), 'water', 'defense');
    expect(d.takenMultiplier).toBeLessThan(1);
    expect(a.takenMultiplier).toBeGreaterThan(1);
  });

  it('büyü süresi güç göstergesinin 2 katı kadar saniye; hem saldırıda hem savunmada aynı', () => {
    const w = makeWand({ element: 'fire', role: 'attack', rarity: 6, level: 30 });
    expect(w.timeBonusSec).toBeCloseTo(2 * wandStrength(6, 30), 2);
    expect(wandEffect(w, 'fire', 'attack').timeBonusSec).toBe(w.timeBonusSec);
    expect(wandEffect(w, 'fire', 'defense').timeBonusSec).toBe(w.timeBonusSec);
  });

  it('fiyat nadirlik ve seviyeyle artar', () => {
    for (let l = 1; l <= MAX_WAND_LEVEL; l += 7) {
      for (let r = 1; r < 6; r++) expect(wandPrice((r + 1) as Rarity, l)).toBeGreaterThan(wandPrice(r as Rarity, l));
    }
    expect(wandPrice(1, 11)).toBeGreaterThan(wandPrice(1, 1));
    expect(PRICE_PER_LEVEL).toBeGreaterThan(0);
  });

  it('açıklama dört satır: saldırı, savunma, süre, element', () => {
    expect(describeWand(makeWand({ element: 'water', role: 'defense', rarity: 3, level: 9 }))).toHaveLength(4);
  });
});

describe('WandInventory: kuşanma ve seviye şartı', () => {
  const setup = (level: number) => {
    const inv = new WandInventory();
    const state = { level };
    inv.setLevelProvider(() => state.level);
    return { inv, state };
  };

  it('boşken eklenen kullanılabilir asa kendiliğinden kuşanılır', () => {
    const { inv } = setup(10);
    inv.add(id('fire', 'attack', 2, 5));
    expect(inv.equipped).toBe(id('fire', 'attack', 2, 5));
    inv.add(id('water', 'attack', 3, 5)); // zaten bir asa kuşanılı: değişmez
    expect(inv.equipped).toBe(id('fire', 'attack', 2, 5));
  });

  it('seviyesi yetmeyen asa kendiliğinden kuşanılmaz ve elle de kuşanılamaz', () => {
    const { inv, state } = setup(5);
    const high = id('fire', 'attack', 1, 12);
    inv.add(high);
    expect(inv.equipped).toBeNull();
    expect(inv.usable(high)).toBe(false);
    expect(inv.equip(high)).toBe(false);
    expect(inv.lastBlockReason).toBe('Bu asayı kullanmak için 12. seviye gerekiyor.');
    state.level = 12; // seviyeye gelince kullanılır
    expect(inv.equip(high)).toBe(true);
    expect(inv.equipped).toBe(high);
  });

  it('yüksek seviye oyuncu düşük seviye asayı kullanabilir', () => {
    const { inv } = setup(25);
    inv.add(id('earth', 'defense', 1, 3));
    expect(inv.equipped).not.toBeNull();
    expect(inv.effects('earth', 'defense').takenMultiplier).toBeLessThan(1);
  });

  it('seviye yetmeyen kuşanılı asa etkisizdir', () => {
    const { inv, state } = setup(10);
    inv.add(id('fire', 'attack', 2, 8));
    expect(inv.effects('fire', 'attack').powerMultiplier).toBeGreaterThan(1);
    state.level = 3; // (kayıt/hile) seviye düşmüş gibi
    expect(inv.effects('fire', 'attack')).toMatchObject({ powerMultiplier: 1, takenMultiplier: 1, timeBonusSec: 0, wandId: null });
  });

  it('aynı anda tek asa kuşanılır; yenisini kuşanınca eskisi çantada kalır', () => {
    const { inv } = setup(30);
    const a = id('fire', 'attack', 1, 1);
    const b = id('water', 'defense', 2, 4);
    inv.add(a);
    inv.add(b);
    expect(inv.equip(b)).toBe(true);
    expect(inv.equipped).toBe(b);
    expect(inv.isEquipped(a)).toBe(false);
    expect(inv.count(a)).toBe(1);
  });

  it('sahip olunmayan ya da bilinmeyen asa kuşanılmaz', () => {
    const { inv } = setup(30);
    expect(inv.equip(id('fire', 'attack', 1, 1))).toBe(false);
    expect(inv.lastBlockReason).toBe('Bu asaya sahip değilsin.');
    expect(inv.equip('sahte')).toBe(false);
  });

  it('çıkarınca etki kalkar', () => {
    const { inv } = setup(30);
    inv.add(id('air', 'attack', 3, 10));
    expect(inv.unequip()).toBe(true);
    expect(inv.equipped).toBeNull();
    expect(inv.effects('air', 'attack').wandId).toBeNull();
    expect(inv.unequip()).toBe(false);
  });

  it('kuşanılı asa çantada yer kaplamaz; çıkarmak yer ister', () => {
    const { inv } = setup(30);
    inv.setLimit((c) => c <= 2);
    inv.add(id('fire', 'attack', 1, 1)); // kuşanılır, 0 taşınan
    expect(inv.carried).toBe(0);
    expect(inv.add(id('fire', 'attack', 1, 2), 2)).toBe(true); // 2 taşınan
    expect(inv.add(id('fire', 'attack', 1, 3))).toBe(false); // sığmaz
    expect(inv.unequip()).toBe(false); // çıkarınca 3 taşınan olur
    expect(inv.lastBlockReason).toBe('Çantanda asa için yer yok.');
  });

  it('değişince dinleyicilere haber verir', () => {
    const { inv } = setup(30);
    let n = 0;
    inv.onChange(() => n++);
    inv.add(id('fire', 'attack', 1, 1));
    inv.unequip();
    expect(n).toBe(2);
  });
});

describe('WandInventory: sıralama ve kayıt', () => {
  it('liste: kuşanılan önce, sonra nadirlik ve seviyeye göre', () => {
    const inv = new WandInventory();
    inv.add(id('fire', 'attack', 1, 3));
    inv.add(id('fire', 'attack', 4, 2));
    inv.add(id('water', 'attack', 4, 9));
    expect(inv.owned().map((w) => w.id)).toEqual([id('fire', 'attack', 1, 3), id('water', 'attack', 4, 9), id('fire', 'attack', 4, 2)]);
  });

  it('kayıt bire bir geri yüklenir', () => {
    const inv = new WandInventory();
    inv.add(id('fire', 'attack', 3, 11), 2);
    inv.add(id('air', 'defense', 1, 4), 7);
    const snap = inv.snapshot();
    const other = new WandInventory();
    other.restore(snap);
    expect(other.snapshot()).toEqual(snap);
  });

  it('bozuk kayıt temizlenir', () => {
    const inv = new WandInventory();
    inv.restore({
      wands: { [id('fire', 'attack', 2, 5)]: 1, [id('water', 'attack', 1, 2)]: 2.9, sahte: 5, [id('air', 'attack', 1, 1)]: -3, [id('earth', 'defense', 1, 1)]: 99999 },
      wandEquipped: id('earth', 'attack', 1, 1), // sahip değil
    });
    expect(inv.count('sahte')).toBe(0);
    expect(inv.count(id('water', 'attack', 1, 2))).toBe(2);
    expect(inv.count(id('air', 'attack', 1, 1))).toBe(0);
    expect(inv.count(id('earth', 'defense', 1, 1))).toBe(999);
    expect(inv.equipped).toBeNull();
    inv.restore(undefined);
    expect(inv.owned()).toEqual([]);
  });

  it('eski (v5) kayıt: seviyesiz kimlikler seviye 1 olur, 8 yuvadan en nadir asa kuşanılır', () => {
    const inv = new WandInventory();
    inv.restore({
      wands: { 'wand-fire-attack-3': 2, 'wand-air-defense-1': 7, 'wand-fire-attack-3-1': 1 },
      wandsEquipped: { 'fire-attack': 'wand-fire-attack-3', 'air-defense': 'wand-air-defense-1' },
    });
    expect(inv.count('wand-fire-attack-3-1')).toBe(3); // eski ve yeni aynı asa, toplanır
    expect(inv.count('wand-air-defense-1-1')).toBe(7);
    expect(inv.equipped).toBe('wand-fire-attack-3-1');
  });
});

describe('tüccar stoğu', () => {
  it('5 asa: tam 1 Nadir (pahalı), diğerleri Sıradan ya da Gelişmiş', () => {
    for (let rotation = 0; rotation < 40; rotation++) {
      const stock = generateStock('tuccar-kazim', rotation, 10);
      expect(stock).toHaveLength(STOCK_SIZE);
      expect(stock.filter((e) => e.rare)).toHaveLength(1);
      for (const e of stock) {
        const w = getWand(e.wandId)!;
        if (e.rare) expect(w.rarity).toBe(3);
        else expect([1, 2]).toContain(w.rarity);
        expect(e.slot).toBe(stock.indexOf(e));
      }
    }
  });

  it('nadir asa pahalıdır (çarpan uygulanır)', () => {
    const rare = generateStock('x', 3, 10).find((e) => e.rare)!;
    const w = getWand(rare.wandId)!;
    expect(rare.price).toBe(Math.round(wandPrice(w.rarity, w.level) * RARE_PREMIUM));
    expect(rare.price).toBeGreaterThan(wandPrice(w.rarity, w.level));
  });

  it('element, rol ve seviye rastgele: geniş bir çeşitlilik çıkar', () => {
    const seen = { el: new Set<string>(), role: new Set<string>(), lvl: new Set<number>() };
    for (let r = 0; r < 60; r++) {
      for (const e of generateStock('tuccar-nesrin', r, 12)) {
        const w = getWand(e.wandId)!;
        seen.el.add(w.element);
        seen.role.add(w.role);
        seen.lvl.add(w.level);
      }
    }
    expect(seen.el.size).toBe(4);
    expect(seen.role.size).toBe(2);
    expect(seen.lvl.size).toBeGreaterThan(8);
  });

  it('seviye 1 ile oyuncu seviyesi + 5 (en çok 30) arasındadır', () => {
    for (let r = 0; r < 40; r++) {
      for (const e of generateStock('t', r, 4)) expect(getWand(e.wandId)!.level).toBeLessThanOrEqual(4 + LEVEL_HEADROOM);
      for (const e of generateStock('t', r, 29)) expect(getWand(e.wandId)!.level).toBeLessThanOrEqual(MAX_WAND_LEVEL);
    }
  });

  it('aynı tohumla aynı stok, farklı dönemde ya da tüccarda farklı', () => {
    expect(generateStock('a', 5, 10)).toEqual(generateStock('a', 5, 10));
    expect(generateStock('a', 5, 10)).not.toEqual(generateStock('a', 6, 10));
    expect(generateStock('a', 5, 10)).not.toEqual(generateStock('b', 5, 10));
  });

  const setupStock = (startMs = 0) => {
    const clock = { t: startMs };
    const inv = new WandInventory();
    const wallet = { gold: 10_000 };
    const gold = { balance: () => wallet.gold, spend: (n: number) => (n <= wallet.gold ? ((wallet.gold -= n), true) : false) };
    const stock = new WandStock('tuccar-kazim', () => clock.t, () => 10);
    return { clock, inv, wallet, gold, stock };
  };

  it('satın alma: asa envantere girer, altın düşer, yeri boş kalır', () => {
    const { inv, wallet, gold, stock } = setupStock();
    const entry = stock.entries()[0];
    const r = stock.buy(0, inv, gold);
    expect(r).toEqual({ ok: true, price: entry.price, wandId: entry.wandId });
    expect(wallet.gold).toBe(10_000 - entry.price);
    expect(inv.count(entry.wandId)).toBe(1);
    expect(stock.entries()[0].sold).toBe(true);
    expect(stock.buy(0, inv, gold)).toMatchObject({ ok: false });
    expect(wallet.gold).toBe(10_000 - entry.price);
  });

  it('satılan asa 5 dakika dolunca yenilenir: yeni stok gelir', () => {
    const { clock, inv, gold, stock } = setupStock();
    const before = stock.entries();
    stock.buy(0, inv, gold);
    clock.t = ROTATION_MS - 1;
    expect(stock.entries().map((e) => e.wandId)).toEqual(before.map((e) => e.wandId)); // henüz aynı
    expect(stock.entries()[0].sold).toBe(true);
    clock.t = ROTATION_MS;
    const after = stock.entries();
    expect(after.map((e) => e.wandId)).not.toEqual(before.map((e) => e.wandId));
    expect(after.every((e) => !e.sold)).toBe(true);
    expect(rotationOf(clock.t)).toBe(1);
  });

  it('kalan süre geri sayar ve yenilenince başa döner', () => {
    const { clock, stock } = setupStock();
    expect(stock.timeLeftMs()).toBe(ROTATION_MS);
    clock.t = 60_000;
    expect(stock.timeLeftMs()).toBe(ROTATION_MS - 60_000);
    clock.t = ROTATION_MS + 1000;
    expect(stock.timeLeftMs()).toBe(ROTATION_MS - 1000);
  });

  it('altın yetmezse, çanta doluysa ya da olmayan sıra için hiçbir şey değişmez', () => {
    const { inv, wallet, gold, stock } = setupStock();
    wallet.gold = 0;
    expect(stock.buy(1, inv, gold)).toMatchObject({ ok: false, reason: 'Yeterli altının yok.' });
    wallet.gold = 10_000;
    inv.setLimit(() => false);
    expect(stock.buy(1, inv, gold)).toMatchObject({ ok: false, reason: 'Çantanda asa için yer yok.' });
    expect(stock.buy(9, inv, gold)).toMatchObject({ ok: false });
    expect(wallet.gold).toBe(10_000);
    expect(inv.owned()).toEqual([]);
  });

  it('fiyat çarpanı (ahlak) uygulanır', () => {
    const { inv, wallet, gold, stock } = setupStock();
    const e = stock.entries()[2];
    const r = stock.buy(2, inv, gold, 0.85);
    expect(r).toMatchObject({ ok: true, price: Math.max(1, Math.round(e.price * 0.85)) });
    expect(wallet.gold).toBe(10_000 - Math.max(1, Math.round(e.price * 0.85)));
  });

  it('her tüccarın stoğu ayrıdır', () => {
    const clock = { t: 0 };
    const a = new WandStock('tuccar-kazim', () => clock.t, () => 10);
    const b = new WandStock('tuccar-boran', () => clock.t, () => 10);
    expect(a.entries().map((e) => e.wandId)).not.toEqual(b.entries().map((e) => e.wandId));
  });
});

describe('savaş akışına bağlantı', () => {
  const good = () => analyzeStrokes(buildShape('circle', 128, 128, 75, 2400));
  const none = () => analyzeStrokes([]);

  function run(engine: BattleEngine, element: 'fire' | 'water' = 'fire') {
    const reports: TurnReport[] = [];
    const draws: { role: string; limitSec: number | undefined }[] = [];
    const stop = new AbortController();
    const io: BattleIO = {
      announceTurn: async () => {},
      chooseElement: async () => element,
      revealRound: async () => {},
      draw: async (_r, role, _g, limitSec) => {
        draws.push({ role, limitSec });
        return role === 'attack' ? good() : none();
      },
      play: async (r) => void (reports.push(r), stop.abort()),
      announceEnd: async () => {},
    };
    return runBattle(engine, io, { signal: stop.signal }).then(() => ({ report: reports[0], draws }));
  }
  const duel = (a: object = {}, b: object = {}) =>
    new BattleEngine([{ name: 'A', team: 0, control: 'bot', ...a }, { name: 'B', team: 1, control: 'bot', ...b }]);
  const withWand = (wandId: string, level = 30) => {
    const inv = new WandInventory();
    inv.setLevelProvider(() => level);
    inv.add(wandId);
    return inv.resolver;
  };

  it('asasız savaşçı eskisi gibi: temel süre 3 sn', async () => {
    const { draws } = await run(duel());
    expect(draws.map((d) => d.limitSec)).toEqual([3, 3]);
  });

  it('saldırı asası hasarı %25 artırır; element eşleşirse %50 daha', async () => {
    const plain = (await run(duel())).report.damage;
    const w = id('fire', 'attack', 1, 1); // B = 0: tam ×1.25
    const noMatch = (await run(duel({ wands: withWand(w) }), 'water')).report.damage;
    const match = (await run(duel({ wands: withWand(w) }), 'fire')).report.damage;
    // Ateş saldıran, su savunan (aynı element savunanın su büyüsü ile karşılaşır): oranlara bakılır
    expect(noMatch).toBeGreaterThan(0);
    expect(match / (await run(duel(), 'fire')).report.damage).toBeCloseTo(1.25 * 1.5, 1);
    expect(plain).toBeGreaterThan(0);
  });

  it('savunan saldırı asası taşırsa savunması zayıflar, savunma asası taşırsa güçlenir', async () => {
    const base = (await run(duel())).report.damage;
    const weak = (await run(duel({}, { wands: withWand(id('fire', 'attack', 1, 1)) }))).report.damage;
    const strong = (await run(duel({}, { wands: withWand(id('fire', 'defense', 1, 1)) }))).report.damage;
    expect(weak / base).toBeCloseTo(1 / 0.75, 1);
    expect(strong / base).toBeCloseTo(1 / 1.25, 1);
  });

  it('seviye ve nadirlik savunmayı da artırır', async () => {
    const lowD = (await run(duel({}, { wands: withWand(id('fire', 'defense', 1, 1)) }))).report.damage;
    const highD = (await run(duel({}, { wands: withWand(id('fire', 'defense', 5, 25)) }))).report.damage;
    expect(highD).toBeLessThan(lowD);
  });

  it('büyü süresi uzar: asa saldıran ve savunan için çizim süresini artırır', async () => {
    const w = id('fire', 'attack', 6, 30);
    const { draws } = await run(duel({ wands: withWand(w) }, { wands: withWand(id('fire', 'defense', 4, 20)) }));
    const atk = makeWand({ element: 'fire', role: 'attack', rarity: 6, level: 30 }).timeBonusSec;
    const def = makeWand({ element: 'fire', role: 'defense', rarity: 4, level: 20 }).timeBonusSec;
    expect(draws[0]).toEqual({ role: 'attack', limitSec: 3 + atk });
    expect(draws[1]).toEqual({ role: 'defense', limitSec: 3 + def });
    expect(atk).toBeGreaterThan(0);
  });

  it('seviye yetmeyen asa savaşta etkisiz: süre ve hasar değişmez', async () => {
    const inv = new WandInventory();
    inv.setLevelProvider(() => 2);
    inv.add(id('fire', 'attack', 6, 30));
    expect(inv.equipped).toBeNull(); // zaten kuşanılamadı
    const { draws } = await run(duel({ wands: inv.resolver }));
    expect(draws[0].limitSec).toBe(3);
  });

  it('çaba normalleştirmesi tanınan süreye göre: uzun süreyle aynı kullanım oranı aynı gücü verir', () => {
    const t = analyzeStrokes(buildShape('circle', 128, 128, 75, 1500)).metrics; // 1.5 sn
    const short = powerFactor(t, 0, 3).effort;
    const long = powerFactor(analyzeStrokes(buildShape('circle', 128, 128, 75, 3000)).metrics, 0, 6).effort;
    expect(long).toBeCloseTo(short, 1);
    expect(powerFactor(t, 0, 6).effort).toBeLessThan(short); // aynı çizim, daha uzun sürede acele sayılır
  });
});
