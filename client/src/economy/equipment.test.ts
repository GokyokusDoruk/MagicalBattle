import { describe, expect, it } from 'vitest';
import { ARMOR_CAP, CRIT_CAP } from '../battle/damage/config';
import { ELEMENTS } from '../battle/damage/elements';
import { runBattle, type BattleIO , type TurnReport } from '../battle/flow/controller';
import { BattleEngine } from '../battle/flow/engine';
import { buildShape } from '../battle/flow/shapes';
import { analyzeStrokes } from '../battle/gesture/analyze';
import { RARITIES } from '../wands/catalog';
import { ROTATION_MS, STOCK_SIZE } from '../wands/stock';
import {
  ARMOR_BY_SLOT,
  ARMOR_SLOTS,
  BAG_BY_RARITY,
  BOOTS_SPEED,
  CRIT_SLOTS,
  ELEMENT_RARITY_WEIGHT,
  EQUIPMENT,
  GEAR_SLOT_LIST,
  LEGACY_ITEMS,
  MAX_GEAR_LEVEL,
  RING_CRIT,
  RING_TIME_SEC,
  elementBonusOf,
  equipmentId,
  levelScale,
  makeEquipment,
  migrateItemId,
  parseEquipmentId,
} from './equipment';
import { bootsSpeed, gearEffects } from './gearEffects';
import { GearStock, generateGearStock } from './gearStock';
import { getItem, itemCategory } from './items';
import { PlayerState } from './player';

describe('ekipman kataloğu: 9 yuva × 4 element × 6 nadirlik × 30 seviye = 6480', () => {
  it('6480 eşya, kimlikler benzersiz, hepsi katalogda', () => {
    expect(EQUIPMENT).toHaveLength(6480);
    expect(GEAR_SLOT_LIST.length * ELEMENTS.length * RARITIES.length * MAX_GEAR_LEVEL).toBe(6480);
    expect(new Set(EQUIPMENT.map((i) => i.id)).size).toBe(6480);
    for (const i of EQUIPMENT.slice(0, 400)) expect(getItem(i.id)).toBe(i);
  });

  it('dokuz yuva: Cüppe, Şapka, Pantalon, Eldiven, Çanta, Yüzük, Bileklik, Kolye, Ayakkabı', () => {
    expect([...GEAR_SLOT_LIST]).toEqual(['robe', 'hat', 'pants', 'gloves', 'bag', 'ring', 'bracelet', 'necklace', 'boots']);
    for (const slot of GEAR_SLOT_LIST) expect(EQUIPMENT.filter((i) => i.slot === slot)).toHaveLength(720);
  });

  it('kimlik özellikleri ve seviyeyi taşır ve okunur; seviyesiz eski kimlik seviye 1 sayılır', () => {
    const i = makeEquipment('pants', 'water', 4, 12);
    expect(i.id).toBe('eq-pants-water-4-12');
    expect(parseEquipmentId(i.id)).toEqual({ slot: 'pants', element: 'water', rarity: 4, level: 12 });
    expect(i.name).toBe('Destansı Su Pantolonu');
    expect(i.level).toBe(12);
    expect(parseEquipmentId('eq-pants-water-4')).toMatchObject({ level: 1 });
    expect(parseEquipmentId('eq-pants-water-7-1')).toBeNull();
    expect(parseEquipmentId('eq-pants-water-4-31')).toBeNull();
    expect(parseEquipmentId('eq-pants-water-4-0')).toBeNull();
    expect(parseEquipmentId('eq-hat-wind-1-1')).toBeNull();
    expect(equipmentId('ring', 'air', 6)).toBe('eq-ring-air-6-1');
    expect(parseEquipmentId('eq-necklace-fire-2-30')).toMatchObject({ slot: 'necklace', level: 30 });
  });

  it('her yuvanın kendi etkisi var, diğer etkiler yok', () => {
    for (const i of EQUIPMENT.filter((e) => e.level === 5 && e.rarity === 3)) {
      const has = { armor: i.armor !== undefined, carry: i.carry !== undefined, speed: i.speed !== undefined, time: i.timeBonus !== undefined, crit: i.crit !== undefined };
      expect(has).toEqual({
        armor: ARMOR_SLOTS.includes(i.slot!),
        carry: i.slot === 'bag',
        speed: i.slot === 'boots',
        time: CRIT_SLOTS.includes(i.slot!),
        crit: CRIT_SLOTS.includes(i.slot!),
      });
    }
  });

  it('nadirlik ve seviye arttıkça her etki ve fiyat artar', () => {
    for (const slot of GEAR_SLOT_LIST) {
      const lo = makeEquipment(slot, 'fire', 3, 1);
      const hiR = makeEquipment(slot, 'fire', 4, 1);
      const hiL = makeEquipment(slot, 'fire', 3, 20);
      for (const hi of [hiR, hiL]) {
        expect(hi.price, slot).toBeGreaterThan(lo.price);
        if (hi.armor !== undefined) expect(hi.armor).toBeGreaterThan(lo.armor!);
        if (hi.speed !== undefined) expect(hi.speed).toBeGreaterThan(lo.speed!);
        if (hi.timeBonus !== undefined) expect(hi.timeBonus).toBeGreaterThan(lo.timeBonus!);
        if (hi.crit !== undefined) expect(hi.crit).toBeGreaterThan(lo.crit!);
        if (hi.carry) for (const k of ['wands', 'goods', 'gear'] as const) expect(hi.carry[k]).toBeGreaterThanOrEqual(lo.carry![k]);
      }
    }
    expect(levelScale(1)).toBe(1);
    expect(levelScale(30)).toBeCloseTo(1.58);
  });

  it('element aynı yuvada etkiyi değiştirmez (bonus kuşanılınca, büyünün elementine göre gelir)', () => {
    for (const slot of GEAR_SLOT_LIST) {
      const stats = ELEMENTS.map((e) => {
        const i = makeEquipment(slot, e, 4, 9);
        return JSON.stringify([i.armor, i.carry, i.speed, i.timeBonus, i.crit, i.price]);
      });
      expect(new Set(stats).size).toBe(1);
    }
  });

  it('zırh: cüppe en çok, eldiven en az; dört parçanın seviye 1 toplamı sınırın altında', () => {
    for (let i = 0; i < 6; i++) {
      expect(ARMOR_BY_SLOT.robe[i]).toBeGreaterThan(ARMOR_BY_SLOT.pants[i]);
      expect(ARMOR_BY_SLOT.pants[i]).toBeGreaterThan(ARMOR_BY_SLOT.hat[i]);
      expect(ARMOR_BY_SLOT.hat[i]).toBeGreaterThan(ARMOR_BY_SLOT.gloves[i]);
    }
    const max = ARMOR_BY_SLOT.robe[5] + ARMOR_BY_SLOT.hat[5] + ARMOR_BY_SLOT.pants[5] + ARMOR_BY_SLOT.gloves[5];
    expect(max).toBeLessThan(ARMOR_CAP);
  });

  it('bileklik kritik ağırlıklı, kolye süre ağırlıklı, yüzük dengeli', () => {
    const r = makeEquipment('ring', 'fire', 4, 1);
    const b = makeEquipment('bracelet', 'fire', 4, 1);
    const n = makeEquipment('necklace', 'fire', 4, 1);
    expect(b.crit!).toBeGreaterThan(r.crit!);
    expect(r.crit!).toBeGreaterThan(n.crit!);
    expect(n.timeBonus!).toBeGreaterThan(r.timeBonus!);
    expect(r.timeBonus!).toBeGreaterThan(b.timeBonus!);
    expect(r.crit).toBeCloseTo(RING_CRIT[3]);
    expect(r.timeBonus).toBeCloseTo(RING_TIME_SEC[3]);
  });

  it('çanta kapasiteleri tam sayı; ayakkabı hızı makul', () => {
    for (const i of EQUIPMENT.filter((e) => e.slot === 'bag')) for (const v of Object.values(i.carry!)) expect(Number.isInteger(v)).toBe(true);
    expect(BAG_BY_RARITY[0]).toEqual({ wands: 3, goods: 20, gear: 2 });
    for (const s of BOOTS_SPEED) expect(s).toBeLessThanOrEqual(0.5);
  });

  it('çanta ve ekipman "gear" kategorisinde, ağırlık olarak sayılır', () => {
    for (const i of EQUIPMENT.slice(0, 300)) expect(itemCategory(i)).toBe('gear');
  });
});

describe('eski ekipmanın dönüşümü', () => {
  it('eski kimliklerin hepsi yeni katalogda bir eşyaya çıkar', () => {
    for (const [old, now] of Object.entries(LEGACY_ITEMS)) {
      expect(getItem(old), old).toBeUndefined();
      expect(getItem(now), now).toBeDefined();
      expect(migrateItemId(old)).toBe(now);
    }
    expect(migrateItemId('tas-cevheri')).toBe('tas-cevheri'); // eski olmayan değişmez
  });

  it('seviyesiz ekipman kimliği (Task 36 öncesi) seviye 1 olur; seviyeli kimlik aynen kalır', () => {
    expect(migrateItemId('eq-robe-fire-3')).toBe('eq-robe-fire-3-1');
    expect(migrateItemId('eq-robe-fire-3-7')).toBe('eq-robe-fire-3-7');
    expect(getItem(migrateItemId('eq-boots-air-6'))).toBeDefined();
  });
});

describe('element bonusu: kuşanılan her parça kendi elementinin büyüsünü artırır', () => {
  it('parça başına %1 × nadirlik katsayısı', () => {
    expect([...ELEMENT_RARITY_WEIGHT]).toEqual([0.25, 0.5, 0.75, 1, 1.25, 1.5]);
    expect(elementBonusOf(1)).toBeCloseTo(0.0025);
    expect(elementBonusOf(4)).toBeCloseTo(0.01);
    expect(elementBonusOf(6)).toBeCloseTo(0.015);
  });

  it('4 Destansı ateş parçası ateş büyüsünde +%4, 4 Sıradan +%1; başka elementte yok', () => {
    const four = (r: 1 | 4): Record<string, string> => ({
      robe: equipmentId('robe', 'fire', r),
      hat: equipmentId('hat', 'fire', r),
      pants: equipmentId('pants', 'fire', r),
      gloves: equipmentId('gloves', 'fire', r),
    });
    expect(gearEffects(four(4), 'fire').damageBonus).toBeCloseTo(0.04);
    expect(gearEffects(four(1), 'fire').damageBonus).toBeCloseTo(0.01);
    expect(gearEffects(four(4), 'water').damageBonus).toBe(0);
    expect(gearEffects(four(4)).damageBonus).toBe(0); // element yoksa bonus yok
  });

  it('karışık elementler: her element kendi parçalarının bonusunu alır; 9 Mistik parça +%13.5', () => {
    const mixed = { robe: equipmentId('robe', 'fire', 6), hat: equipmentId('hat', 'water', 4), ring: equipmentId('ring', 'fire', 2) };
    expect(gearEffects(mixed, 'fire').damageBonus).toBeCloseTo(0.015 + 0.005);
    expect(gearEffects(mixed, 'water').damageBonus).toBeCloseTo(0.01);
    const all = Object.fromEntries(GEAR_SLOT_LIST.map((s) => [s, equipmentId(s, 'air', 6)]));
    expect(gearEffects(all, 'air').damageBonus).toBeCloseTo(0.135);
  });

  it('zırh element eşleşmesinden etkilenmez (eski ×1.5 kuralı kalktı)', () => {
    const eq = { robe: equipmentId('robe', 'fire', 3), hat: equipmentId('hat', 'water', 3) };
    expect(gearEffects(eq, 'fire').armor).toBeCloseTo(0.14);
    expect(gearEffects(eq, 'water').armor).toBeCloseTo(0.14);
    expect(gearEffects(eq).armor).toBeCloseTo(0.14);
  });
});

describe('ekipman etkileri', () => {
  it('dört zırh parçası toplanır, üst sınırı aşmaz', () => {
    const eq = { robe: equipmentId('robe', 'fire', 3), gloves: equipmentId('gloves', 'earth', 3) };
    expect(gearEffects(eq).armor).toBeCloseTo(0.09 + 0.04);
    const max = Object.fromEntries(ARMOR_SLOTS.map((s) => [s, equipmentId(s, 'fire', 6, 30)]));
    expect(gearEffects(max).armor).toBeCloseTo(ARMOR_CAP);
  });

  it('yüzük, bileklik, kolye kritik şansını ve büyü süresini toplar; şans CRIT_CAP ile sınırlı', () => {
    const eq = { ring: equipmentId('ring', 'air', 4), bracelet: equipmentId('bracelet', 'water', 4), necklace: equipmentId('necklace', 'fire', 4) };
    const rb = makeEquipment('ring', 'air', 4);
    const bb = makeEquipment('bracelet', 'water', 4);
    const nb = makeEquipment('necklace', 'fire', 4);
    expect(gearEffects(eq).crit).toBeCloseTo(rb.crit! + bb.crit! + nb.crit!);
    expect(gearEffects(eq).timeBonusSec).toBeCloseTo(rb.timeBonus! + bb.timeBonus! + nb.timeBonus!);
    expect(CRIT_CAP).toBe(0.75);
  });

  it('çanta ve ayakkabı zırha, süreye ve kritiğe katkı vermez', () => {
    const eq = { bag: equipmentId('bag', 'fire', 6), boots: equipmentId('boots', 'fire', 6) };
    expect(gearEffects(eq, 'fire')).toMatchObject({ armor: 0, timeBonusSec: 0, crit: 0 });
    expect(gearEffects({})).toEqual({ armor: 0, timeBonusSec: 0, crit: 0, damageBonus: 0, areaCells: 0 });
  });

  it('kolye alan gücü verir (Faz 6): nadirlik arttıkça büyür, diğer yuvalar vermez', () => {
    const area = (r: 1 | 6) => gearEffects({ necklace: equipmentId('necklace', 'fire', r) }).areaCells!;
    expect(area(1)).toBeGreaterThan(0);
    expect(area(6)).toBeGreaterThan(area(1));
    expect(gearEffects({ ring: equipmentId('ring', 'fire', 6) }).areaCells).toBe(0);
  });

  it('ayakkabı yürüme hızı verir', () => {
    expect(bootsSpeed({})).toBe(0);
    expect(bootsSpeed({ boots: equipmentId('boots', 'earth', 3) })).toBeCloseTo(0.12);
  });

  it('PlayerState: seviye şartı kuşanmayı engeller; seviye yetince kuşanılır', () => {
    const p = new PlayerState();
    const high = equipmentId('robe', 'fire', 4, 10);
    p.addItem(high);
    expect(p.equip(high)).toBe(false);
    expect(p.lastBlockReason).toMatch(/10\. seviye/);
    p.addXp(50 * 9 * 10); // seviye 10
    expect(p.level).toBe(10);
    expect(p.equip(high)).toBe(true);
    expect(p.armor).toBeCloseTo(makeEquipment('robe', 'fire', 4, 10).armor!);
  });

  it('PlayerState: armor, gearFor(element), speedBonus ekipmandan', () => {
    const p = new PlayerState();
    for (const id of [equipmentId('robe', 'fire', 4), equipmentId('ring', 'fire', 2), equipmentId('boots', 'fire', 5)]) {
      p.addItem(id);
      p.equip(id);
    }
    expect(p.armor).toBeCloseTo(0.12);
    expect(p.gearFor('fire').damageBonus).toBeCloseTo(0.01 + 0.005 + 0.0125);
    expect(p.gearFor('water').damageBonus).toBe(0);
    expect(p.gearFor('fire').timeBonusSec).toBeCloseTo(0.35);
    expect(p.speedBonus).toBeCloseTo(0.2);
    expect(p.gearResolver('fire').armor).toBeCloseTo(0.12);
  });
});

describe('savaşa bağlantı', () => {
  const good = () => analyzeStrokes(buildShape('circle', 128, 128, 75, 2400));
  const none = () => analyzeStrokes([]);

  async function run(engine: BattleEngine, element: 'fire' | 'water' = 'fire', random?: () => number) {
    const draws: { role: string; limitSec: number | undefined }[] = [];
    const stop = new AbortController();
    let damage = 0;
    let critical = false;
    let breakdown: TurnReport['breakdown'] = null;
    const io: BattleIO = {
      announceTurn: async () => {},
      chooseElement: async () => element,
      revealRound: async () => {},
      draw: async (_r, role, _g, limitSec) => {
        draws.push({ role, limitSec });
        return role === 'attack' ? good() : none();
      },
      play: async (r) => {
        damage = r.damage;
        critical = r.critical;
        breakdown = r.breakdown;
        stop.abort();
      },
      announceEnd: async () => {},
    };
    await runBattle(engine, io, { signal: stop.signal, random });
    return { damage, draws, critical, breakdown: breakdown as TurnReport['breakdown'] };
  }
  const duel = (b: object = {}, a: object = {}) =>
    new BattleEngine([{ name: 'A', team: 0, control: 'bot', ...a }, { name: 'B', team: 1, control: 'bot', ...b }]);
  const player = (...ids: string[]) => {
    const p = new PlayerState();
    p.addXp(50 * 29 * 30); // seviye 30: hiçbir seviye şartı takılmaz
    for (const id of ids) {
      p.addItem(id);
      p.equip(id);
    }
    return p;
  };

  it('savunanın zırhı hasarı azaltır (element eşleşmesinden bağımsız)', async () => {
    const base = (await run(duel())).damage;
    const p = player(equipmentId('robe', 'fire', 6), equipmentId('hat', 'fire', 6), equipmentId('pants', 'fire', 6), equipmentId('gloves', 'fire', 6));
    const fire = (await run(duel({ gear: p.gearResolver }), 'fire')).damage;
    const water = (await run(duel({ gear: p.gearResolver }), 'water')).damage;
    expect(water).toBeLessThan(base);
    expect(fire).toBeLessThan(base);
    expect(fire).toBe(water);
  });

  it('kendi elementindeki ekipman saldırı hasarını artırır; başka elementte artırmaz', async () => {
    const base = (await run(duel())).damage;
    // Çizim süresi uzatan parçalar (yüzük, bileklik, kolye) hariç: süre uzayınca aceleyle çizim cezası hasarı etkiler
    const p = player(...(['robe', 'hat', 'pants', 'gloves', 'boots'] as const).map((s) => equipmentId(s, 'fire', 6)));
    const fire = (await run(duel({}, { gear: p.gearResolver }), 'fire')).damage;
    const water = (await run(duel({}, { gear: p.gearResolver }), 'water')).damage;
    expect(fire).toBeGreaterThan(base);
    expect(water).toBe(base);
    expect(fire / base).toBeCloseTo(1 + 0.015 * 5, 1);
  });

  it('kritik vuruş: şans ekipmandan gelir, hasar ×1.5; zar sabitlenebilir', async () => {
    const p = player(equipmentId('ring', 'fire', 6), equipmentId('bracelet', 'fire', 6), equipmentId('necklace', 'fire', 6));
    const chance = p.gearFor('fire').crit;
    expect(chance).toBeGreaterThan(0.1);
    const miss = await run(duel({}, { gear: p.gearResolver }), 'fire', () => 0.999);
    const hit = await run(duel({}, { gear: p.gearResolver }), 'fire', () => 0);
    expect(miss.critical).toBe(false);
    expect(hit.critical).toBe(true);
    // Faz 3: hasarlar küçüldüğü için yuvarlama payı büyür; çarpan yuvarlamadan önceki değerle ölçülür
    expect(hit.breakdown!.afterCrit / miss.breakdown!.afterCrit).toBeCloseTo(1.5, 5);
    // Ekipmansız savaşçı asla kritik vurmaz
    expect((await run(duel(), 'fire', () => 0)).critical).toBe(false);
  });

  it('yüzük, bileklik ve kolye çizim süresini toplayarak uzatır (saldıran ve savunan için)', async () => {
    const p = player(equipmentId('ring', 'fire', 6), equipmentId('bracelet', 'fire', 6), equipmentId('necklace', 'fire', 6));
    const t = p.gearFor('fire').timeBonusSec;
    const r = await run(duel({ gear: p.gearResolver }, { gear: p.gearResolver }), 'fire');
    expect(r.draws[0].limitSec).toBeCloseTo(3 + t, 6);
    expect(r.draws[1].limitSec).toBeCloseTo(3 + t, 6);
  });

  it('ekipmansız savaşçı eskisi gibi: sabit zırh ve 3 sn', async () => {
    const r = await run(duel({ armor: 0.4 }));
    const plain = await run(duel());
    expect(r.damage).toBeLessThan(plain.damage);
    expect(r.draws.map((d) => d.limitSec)).toEqual([3, 3]);
  });

  it('süre asa ve ekipmandan birlikte gelir', async () => {
    const p = player(equipmentId('ring', 'fire', 2));
    const wands = (): ReturnType<typeof import('../wands/inventory').neutralWand> => ({ powerMultiplier: 1, takenMultiplier: 1, timeBonusSec: 0.5, wandId: null });
    const r = await run(duel({}, { gear: p.gearResolver, wands }), 'fire');
    expect(r.draws[0].limitSec).toBeCloseTo(3 + 0.5 + 0.35, 6);
  });
});

describe('tüccarın ekipman stoğu', () => {
  it('5 eşya, tam 1 Nadir (pahalı), diğerleri Sıradan ya da Gelişmiş', () => {
    for (let rotation = 0; rotation < 40; rotation++) {
      const stock = generateGearStock('tuccar-kazim', rotation);
      expect(stock).toHaveLength(STOCK_SIZE);
      expect(stock.filter((e) => e.rare)).toHaveLength(1);
      for (const e of stock) {
        const item = getItem(e.itemId)!;
        expect(item.slot).toBeDefined();
        if (e.rare) {
          expect(item.rarity).toBe(3);
          expect(e.price).toBeGreaterThan(item.price);
        } else {
          expect([1, 2]).toContain(item.rarity);
          expect(e.price).toBe(item.price);
        }
      }
    }
  });

  it('yuva ve element rastgele: geniş çeşitlilik', () => {
    const slots = new Set<string>();
    const els = new Set<string>();
    for (let r = 0; r < 60; r++) {
      for (const e of generateGearStock('tuccar-nesrin', r)) {
        const i = getItem(e.itemId)!;
        slots.add(i.slot!);
        els.add(i.element!);
      }
    }
    expect(slots.size).toBe(9);
    expect(els.size).toBe(4);
  });

  it('aynı tohumla aynı stok; farklı dönem ya da tüccarda farklı', () => {
    expect(generateGearStock('a', 3)).toEqual(generateGearStock('a', 3));
    expect(generateGearStock('a', 3)).not.toEqual(generateGearStock('a', 4));
    expect(generateGearStock('a', 3)).not.toEqual(generateGearStock('b', 3));
  });

  const setup = () => {
    const clock = { t: 0 };
    const player = new PlayerState();
    player.addMoney('kor', 100_000);
    return { clock, player, stock: new GearStock('tuccar-kazim', () => clock.t) };
  };

  it('satın alma: eşya gelir, altın düşer, yeri boş kalır; tekrar alınamaz', () => {
    const { player, stock } = setup();
    const e = stock.entries()[0];
    const r = stock.buy(0, player);
    expect(r).toEqual({ ok: true, price: e.price });
    expect(player.count(e.itemId)).toBe(1);
    expect(player.balance('kor')).toBe(100_000 - e.price);
    expect(stock.entries()[0].sold).toBe(true);
    expect(stock.buy(0, player)).toMatchObject({ ok: false });
  });

  it('5 dakika dolunca stok yenilenir ve satılanlar geri gelir', () => {
    const { clock, player, stock } = setup();
    const before = stock.entries();
    stock.buy(0, player);
    clock.t = ROTATION_MS - 1;
    expect(stock.entries()[0].sold).toBe(true);
    clock.t = ROTATION_MS;
    const after = stock.entries();
    expect(after.map((e) => e.itemId)).not.toEqual(before.map((e) => e.itemId));
    expect(after.every((e) => !e.sold)).toBe(true);
    expect(stock.rotationIndex).toBe(1);
  });

  it('kalan süre geri sayar', () => {
    const { clock, stock } = setup();
    expect(stock.timeLeftMs()).toBe(ROTATION_MS);
    clock.t = 90_000;
    expect(stock.timeLeftMs()).toBe(ROTATION_MS - 90_000);
  });

  it('altın yetmezse, çanta doluysa ya da olmayan sıra için hiçbir şey değişmez', () => {
    const { player, stock } = setup();
    player.spendMoney('kor', 100_000);
    expect(stock.buy(1, player)).toMatchObject({ ok: false });
    expect(stock.buy(9, player)).toMatchObject({ ok: false });
    expect(player.inventory()).toEqual([]);
    player.addMoney('kor', 100_000);
    player.setGuards({ room: () => 0, canChangeGear: () => null });
    expect(stock.buy(1, player)).toMatchObject({ ok: false });
    expect(player.balance('kor')).toBe(100_000);
  });

  it('fiyat çarpanı (ahlak) uygulanır', () => {
    const { player, stock } = setup();
    const e = stock.entries()[2];
    const r = stock.buy(2, player, 0.85);
    expect(r).toMatchObject({ ok: true, price: Math.max(1, Math.round(e.price * 0.85)) });
  });
});
