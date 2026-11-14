import { describe, expect, it } from 'vitest';
import { ARMOR_CAP } from '../battle/damage/config';
import { ELEMENTS } from '../battle/damage/elements';
import { runBattle, type BattleIO } from '../battle/flow/controller';
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
  EQUIPMENT,
  GEAR_ELEMENT_MATCH,
  GEAR_SLOT_LIST,
  LEGACY_ITEMS,
  RING_TIME_SEC,
  equipmentId,
  makeEquipment,
  migrateItemId,
  parseEquipmentId,
} from './equipment';
import { bootsSpeed, gearEffects } from './gearEffects';
import { GearStock, generateGearStock } from './gearStock';
import { getItem, itemCategory } from './items';
import { PlayerState } from './player';

describe('ekipman kataloğu: 6 yuva × 4 element × 6 nadirlik = 144', () => {
  it('144 eşya, kimlikler benzersiz, hepsi katalogda', () => {
    expect(EQUIPMENT).toHaveLength(144);
    expect(GEAR_SLOT_LIST.length * ELEMENTS.length * RARITIES.length).toBe(144);
    expect(new Set(EQUIPMENT.map((i) => i.id)).size).toBe(144);
    expect(new Set(EQUIPMENT.map((i) => i.name)).size).toBe(144);
    for (const i of EQUIPMENT) expect(getItem(i.id)).toBe(i);
  });

  it('altı yuva: Cüppe, Şapka, Pantalon, Çanta, Yüzük, Ayakkabı', () => {
    expect([...GEAR_SLOT_LIST]).toEqual(['robe', 'hat', 'pants', 'bag', 'ring', 'boots']);
    for (const slot of GEAR_SLOT_LIST) expect(EQUIPMENT.filter((i) => i.slot === slot)).toHaveLength(24);
  });

  it('kimlik özellikleri taşır ve okunur', () => {
    const i = makeEquipment('pants', 'water', 4);
    expect(i.id).toBe('eq-pants-water-4');
    expect(parseEquipmentId(i.id)).toEqual({ slot: 'pants', element: 'water', rarity: 4 });
    expect(i.name).toBe('Destansı Su Pantolonu');
    expect(parseEquipmentId('eq-pants-water-7')).toBeNull();
    expect(parseEquipmentId('eq-hat-wind-1')).toBeNull();
    expect(equipmentId('ring', 'air', 6)).toBe('eq-ring-air-6');
  });

  it('her yuvanın kendi etkisi var, diğer etkiler yok', () => {
    for (const i of EQUIPMENT) {
      const has = { armor: i.armor !== undefined, carry: i.carry !== undefined, speed: i.speed !== undefined, time: i.timeBonus !== undefined };
      expect(has).toEqual({
        armor: ARMOR_SLOTS.includes(i.slot!),
        carry: i.slot === 'bag',
        speed: i.slot === 'boots',
        time: i.slot === 'ring',
      });
    }
  });

  it('nadirlik arttıkça her etki ve fiyat artar (her yuva, her element)', () => {
    for (const slot of GEAR_SLOT_LIST) {
      for (const el of ELEMENTS) {
        for (let r = 2; r <= 6; r++) {
          const lo = makeEquipment(slot, el, (r - 1) as 1);
          const hi = makeEquipment(slot, el, r as 2);
          expect(hi.price, `${slot}/${el}/${r}`).toBeGreaterThan(lo.price);
          if (hi.armor !== undefined) expect(hi.armor).toBeGreaterThan(lo.armor!);
          if (hi.speed !== undefined) expect(hi.speed).toBeGreaterThan(lo.speed!);
          if (hi.timeBonus !== undefined) expect(hi.timeBonus).toBeGreaterThan(lo.timeBonus!);
          if (hi.carry) for (const k of ['wands', 'goods', 'gear'] as const) expect(hi.carry[k]).toBeGreaterThan(lo.carry![k]);
        }
      }
    }
  });

  it('element aynı yuvada etkiyi değiştirmez (bonus bağlamdan gelir)', () => {
    for (const slot of GEAR_SLOT_LIST) {
      for (let r = 1; r <= 6; r++) {
        const stats = ELEMENTS.map((e) => {
          const i = makeEquipment(slot, e, r as 1);
          return JSON.stringify([i.armor, i.carry, i.speed, i.timeBonus, i.price]);
        });
        expect(new Set(stats).size).toBe(1);
      }
    }
  });

  it('zırh: cüppe en çok, şapka en az; üç parçanın toplamı sınırı aşmaz (eşleşirse bile)', () => {
    for (let i = 0; i < 6; i++) {
      expect(ARMOR_BY_SLOT.robe[i]).toBeGreaterThan(ARMOR_BY_SLOT.pants[i]);
      expect(ARMOR_BY_SLOT.pants[i]).toBeGreaterThan(ARMOR_BY_SLOT.hat[i]);
    }
    const max = ARMOR_BY_SLOT.robe[5] + ARMOR_BY_SLOT.hat[5] + ARMOR_BY_SLOT.pants[5];
    expect(max).toBeLessThan(ARMOR_CAP);
    expect(max * GEAR_ELEMENT_MATCH).toBeLessThanOrEqual(ARMOR_CAP);
  });

  it('yüzük, zırh parçalarından daha çok büyü süresi verir (zırh parçası süre vermez)', () => {
    for (const t of RING_TIME_SEC) expect(t).toBeGreaterThan(0);
    for (const i of EQUIPMENT.filter((e) => ARMOR_SLOTS.includes(e.slot!))) expect(i.timeBonus).toBeUndefined();
    expect(RING_TIME_SEC[5]).toBeGreaterThan(1);
  });

  it('çanta kapasiteleri tam sayı; ayakkabı hızı makul; ayakkabı hızı artar', () => {
    for (const b of BAG_BY_RARITY) for (const v of Object.values(b)) expect(Number.isInteger(v)).toBe(true);
    expect(BAG_BY_RARITY[0]).toEqual({ wands: 3, goods: 20, gear: 2 });
    for (const s of BOOTS_SPEED) expect(s).toBeLessThanOrEqual(0.5);
  });

  it('çanta ve ekipman "gear" kategorisinde, ağırlık olarak sayılır', () => {
    for (const i of EQUIPMENT) expect(itemCategory(i)).toBe('gear');
  });
});

describe('eski ekipmanın dönüşümü', () => {
  it('eski kimliklerin hepsi yeni katalogda bir eşyaya çıkar', () => {
    for (const [old, now] of Object.entries(LEGACY_ITEMS)) {
      expect(getItem(old), old).toBeUndefined();
      expect(getItem(now), now).toBeDefined();
      expect(migrateItemId(old)).toBe(now);
    }
    expect(migrateItemId('sifali-ot')).toBe('sifali-ot'); // eski olmayan değişmez
  });
});

describe('tur başına element bonusu', () => {
  it('eşleşen elementteki zırh parçası %50 daha çok zırh verir', () => {
    const eq = { robe: 'eq-robe-fire-3', hat: 'eq-hat-water-3' }; // 0.09 ateş, 0.05 su
    expect(gearEffects(eq).armor).toBeCloseTo(0.14); // element yok: taban
    expect(gearEffects(eq, 'fire').armor).toBeCloseTo(0.09 * 1.5 + 0.05);
    expect(gearEffects(eq, 'water').armor).toBeCloseTo(0.09 + 0.05 * 1.5);
    expect(gearEffects(eq, 'earth').armor).toBeCloseTo(0.14); // eşleşen yok
  });

  it('tam set aynı element: o elementte %50 daha çok zırh, diğerinde taban', () => {
    const eq = { robe: 'eq-robe-earth-6', hat: 'eq-hat-earth-6', pants: 'eq-pants-earth-6' };
    const base = 0.2 + 0.12 + 0.16;
    expect(gearEffects(eq, 'earth').armor).toBeCloseTo(base * 1.5);
    expect(gearEffects(eq, 'fire').armor).toBeCloseTo(base);
  });

  it('toplam zırh üst sınırı aşmaz', () => {
    const eq = { robe: 'eq-robe-fire-6', hat: 'eq-hat-fire-6', pants: 'eq-pants-fire-6' };
    expect(gearEffects(eq, 'fire').armor).toBeLessThanOrEqual(ARMOR_CAP);
  });

  it('yüzük büyü süresi verir, eşleşen elementte %50 daha uzun', () => {
    const eq = { ring: 'eq-ring-air-4' };
    expect(gearEffects(eq).timeBonusSec).toBeCloseTo(0.7);
    expect(gearEffects(eq, 'air').timeBonusSec).toBeCloseTo(0.7 * 1.5);
    expect(gearEffects(eq, 'water').timeBonusSec).toBeCloseTo(0.7);
  });

  it('cüppe, şapka, pantalon dışı yuvalar zırha, yüzük dışı yuvalar süreye katkı vermez', () => {
    const eq = { bag: 'eq-bag-fire-6', boots: 'eq-boots-fire-6' };
    expect(gearEffects(eq, 'fire')).toEqual({ armor: 0, timeBonusSec: 0 });
    expect(gearEffects({})).toEqual({ armor: 0, timeBonusSec: 0 });
  });

  it('ayakkabı yürüme hızı verir', () => {
    expect(bootsSpeed({})).toBe(0);
    expect(bootsSpeed({ boots: 'eq-boots-earth-3' })).toBeCloseTo(0.12);
  });

  it('PlayerState: armor taban, gearFor(element) eşleşmeli, speedBonus ayakkabıdan', () => {
    const p = new PlayerState();
    for (const id of ['eq-robe-fire-4', 'eq-ring-fire-2', 'eq-boots-fire-5']) {
      p.addItem(id);
      p.equip(id);
    }
    expect(p.armor).toBeCloseTo(0.12);
    expect(p.gearFor('fire').armor).toBeCloseTo(0.18);
    expect(p.gearFor('water').armor).toBeCloseTo(0.12);
    expect(p.gearFor('fire').timeBonusSec).toBeCloseTo(0.35 * 1.5);
    expect(p.speedBonus).toBeCloseTo(0.2);
    expect(p.gearResolver('fire').armor).toBeCloseTo(0.18);
  });
});

describe('savaşa bağlantı', () => {
  const good = () => analyzeStrokes(buildShape('circle', 128, 128, 75, 2400));
  const none = () => analyzeStrokes([]);

  async function run(engine: BattleEngine, element: 'fire' | 'water' = 'fire') {
    const draws: { role: string; limitSec: number | undefined }[] = [];
    const stop = new AbortController();
    let damage = 0;
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
        stop.abort();
      },
      announceEnd: async () => {},
    };
    await runBattle(engine, io, { signal: stop.signal });
    return { damage, draws };
  }
  const duel = (b: object = {}, a: object = {}) =>
    new BattleEngine([{ name: 'A', team: 0, control: 'bot', ...a }, { name: 'B', team: 1, control: 'bot', ...b }]);
  const player = (...ids: string[]) => {
    const p = new PlayerState();
    for (const id of ids) {
      p.addItem(id);
      p.equip(id);
    }
    return p;
  };

  it('savunanın zırhı hasarı azaltır; eşleşen elementte daha çok', async () => {
    const base = (await run(duel())).damage;
    const p = player('eq-robe-fire-6', 'eq-hat-fire-6', 'eq-pants-fire-6');
    const fire = (await run(duel({ gear: p.gearResolver }), 'fire')).damage;
    const water = (await run(duel({ gear: p.gearResolver }), 'water')).damage;
    expect(water).toBeLessThan(base); // taban zırh
    expect(fire).toBeLessThan(water); // eşleşme: %50 daha çok zırh
  });

  it('yüzük çizim süresini uzatır; eşleşen elementte daha çok; saldıran ve savunan için', async () => {
    const p = player('eq-ring-fire-6');
    const matched = await run(duel({ gear: p.gearResolver }, { gear: p.gearResolver }), 'fire');
    const other = await run(duel({ gear: p.gearResolver }, { gear: p.gearResolver }), 'water');
    expect(matched.draws[0].limitSec).toBeCloseTo(3 + 1.2 * 1.5, 6);
    expect(matched.draws[1].limitSec).toBeCloseTo(3 + 1.2 * 1.5, 6);
    expect(other.draws[0].limitSec).toBeCloseTo(3 + 1.2, 6);
  });

  it('ekipmansız savaşçı eskisi gibi: sabit zırh ve 3 sn', async () => {
    const r = await run(duel({ armor: 0.4 }));
    const plain = await run(duel());
    expect(r.damage).toBeLessThan(plain.damage);
    expect(r.draws.map((d) => d.limitSec)).toEqual([3, 3]);
  });

  it('süre asa ve yüzükten birlikte gelir', async () => {
    const p = player('eq-ring-fire-2');
    const wands = (): ReturnType<typeof import('../wands/inventory').neutralWand> => ({ powerMultiplier: 1, takenMultiplier: 1, timeBonusSec: 0.5, wandId: null });
    const r = await run(duel({}, { gear: p.gearResolver, wands }), 'fire');
    expect(r.draws[0].limitSec).toBeCloseTo(3 + 0.5 + 0.35 * 1.5, 6);
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
    expect(slots.size).toBe(6);
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
    player.addGold(100_000);
    return { clock, player, stock: new GearStock('tuccar-kazim', () => clock.t) };
  };

  it('satın alma: eşya gelir, altın düşer, yeri boş kalır; tekrar alınamaz', () => {
    const { player, stock } = setup();
    const e = stock.entries()[0];
    const r = stock.buy(0, player);
    expect(r).toEqual({ ok: true, price: e.price });
    expect(player.count(e.itemId)).toBe(1);
    expect(player.gold).toBe(100_000 - e.price);
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
    player.spendGold(100_000);
    expect(stock.buy(1, player)).toMatchObject({ ok: false });
    expect(stock.buy(9, player)).toMatchObject({ ok: false });
    expect(player.inventory()).toEqual([]);
    player.addGold(100_000);
    player.setGuards({ room: () => 0, canChangeGear: () => null });
    expect(stock.buy(1, player)).toMatchObject({ ok: false });
    expect(player.gold).toBe(100_000);
  });

  it('fiyat çarpanı (ahlak) uygulanır', () => {
    const { player, stock } = setup();
    const e = stock.entries()[2];
    const r = stock.buy(2, player, 0.85);
    expect(r).toMatchObject({ ok: true, price: Math.max(1, Math.round(e.price * 0.85)) });
  });
});
