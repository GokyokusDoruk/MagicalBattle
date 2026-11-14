import { describe, expect, it } from 'vitest';
import { ELEMENTS } from '../battle/damage/elements';
import { PlayerState } from '../economy/player';
import { getItem } from '../economy/items';
import { parseEquipmentId } from '../economy/equipment';
import { GroundLoot } from '../world/groundLoot';
import { generateMap, reachableSet } from '../world/generateMap';
import { cityAt } from '../save/cityEntry';
import { mulberry32 } from '../world/rng';
import { WandInventory } from '../wands/inventory';
import { parseWandId } from '../wands/catalog';
import { applyLoot } from './applyLoot';
import { ENEMY_KINDS, TIERS, enemyFighters, enemyStats } from './catalog';
import { DROP_CHANCE, RARITY_WEIGHTS, rarityOdds, rollLoot } from './loot';
import { ENEMY_COUNT, EnemyBoard, generateEnemySpots, tierAt } from './spots';

describe('düşman sayıları', () => {
  it('kademe yükseldikçe güçlenir ve boss Vael\'den zayıf kalır', () => {
    const hp = TIERS.map((t) => enemyStats('fire', t).hp);
    expect([...hp].sort((a, b) => a - b)).toEqual(hp);
    expect(hp[0]).toBeLessThan(310);
    expect(enemyStats('fire', 1).basePower).toBeLessThan(115);
  });

  it('savaşta oyuncu mevcut canıyla, düşman tam canla başlar', () => {
    const f = enemyFighters('water', 2, { name: 'Ben', level: 3, hp: 120, armor: 0 });
    expect(f).toHaveLength(2);
    expect(f[0]).toMatchObject({ team: 0, hp: 120 });
    expect(f[1]).toMatchObject({ team: 1, control: 'bot', maxHp: enemyStats('water', 2).hp });
  });
});

describe('ganimet', () => {
  it('nadirlik arttıkça düşme olasılığı azalır', () => {
    for (const tier of TIERS) {
      const odds = rarityOdds(tier);
      for (let r = 1; r < 6; r++) expect(odds[r as 1]).toBeGreaterThan(odds[(r + 1) as 2]);
      expect(Object.values(odds).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    }
    expect(RARITY_WEIGHTS[1]).toBeGreaterThan(RARITY_WEIGHTS[6]);
  });

  it('yüksek kademede yüksek nadirliğin payı artar ama yine de nadirdir', () => {
    expect(rarityOdds(4)[4]).toBeGreaterThan(rarityOdds(1)[4]);
    expect(rarityOdds(4)[1]).toBeGreaterThan(rarityOdds(4)[4]);
  });

  it('her zaman altın ve XP verir; eşyalar geçerli kimliklerdir', () => {
    const rand = mulberry32(7);
    for (let i = 0; i < 300; i++) {
      const l = rollLoot(ELEMENTS[i % 4], TIERS[i % 4], 5, 1, rand);
      expect(l.money).toBeGreaterThan(0);
      expect(l.xp).toBeGreaterThan(0);
      for (const id of Object.keys(l.items)) expect(getItem(id)).toBeDefined();
      for (const id of Object.keys(l.wands)) expect(parseWandId(id)).not.toBeNull();
    }
  });

  it('ekipman düşmesi bekleneni verir ve Destansı+ nadirdir; karanlık yolda daha çok düşer', () => {
    const count = (rate: number): { gear: number; epic: number; fights: number } => {
      const rand = mulberry32(11);
      let gear = 0;
      let epic = 0;
      const fights = 20000;
      for (let i = 0; i < fights; i++) {
        const l = rollLoot('fire', 2, 5, rate, rand);
        for (const id of Object.keys(l.items)) {
          const p = parseEquipmentId(id);
          if (!p) continue;
          gear++;
          if (p.rarity >= 4) epic++;
        }
      }
      return { gear, epic, fights };
    };
    const base = count(1);
    const dark = count(1.3);
    expect(base.gear / base.fights).toBeCloseTo(DROP_CHANCE.gear, 1);
    expect(base.epic / base.gear).toBeLessThan(0.15);
    expect(base.epic).toBeGreaterThan(0);
    expect(dark.gear).toBeGreaterThan(base.gear * 1.15);
  });

  it('asa seviyesi oyuncu seviyesi + 2 ile sınırlıdır', () => {
    const rand = mulberry32(3);
    let seen = 0;
    for (let i = 0; i < 4000; i++) {
      for (const id of Object.keys(rollLoot('air', 3, 4, 1.3, rand).wands)) {
        seen++;
        expect(parseWandId(id)!.level).toBeLessThanOrEqual(6);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('ganimeti uygulama', () => {
  const setup = () => {
    const hero = new PlayerState();
    const wands = new WandInventory();
    const now = 0;
    const ground = new GroundLoot(() => now);
    return { hero, wands, ground };
  };

  it('altın, XP ve eşya çantaya girer', () => {
    const { hero, wands, ground } = setup();
    const out = applyLoot({ money: 30, xp: 20, items: { 'kor-baharati': 2 }, wands: {} }, hero, wands, ground, 5, 5, 'kor');
    expect(hero.balance('kor')).toBe(30);
    expect(hero.count('kor-baharati')).toBe(2);
    expect(out).toMatchObject({ taken: 2, dropped: 0 });
    expect(ground.piles()).toHaveLength(0);
  });

  it('sığmayan eşya savaş karosunda yerde kalır', () => {
    const { hero, wands, ground } = setup();
    hero.setGuards({ room: (id: string) => (id === 'kor-baharati' ? 1 : 0) } as never);
    const out = applyLoot({ money: 0, xp: 0, items: { 'kor-baharati': 3, 'bulut-ipegi': 1 }, wands: {} }, hero, wands, ground, 8, 9, 'kor');
    expect(hero.count('kor-baharati')).toBe(1);
    expect(out).toMatchObject({ taken: 1, dropped: 3 });
    const pile = ground.piles()[0];
    expect(pile).toMatchObject({ tileX: 8, tileY: 9, items: { 'kor-baharati': 2, 'bulut-ipegi': 1 } });
  });

  it('asa düşünce asa envanterine girer', () => {
    const { hero, wands, ground } = setup();
    const id = 'wand-fire-attack-3-4';
    applyLoot({ money: 0, xp: 0, items: {}, wands: { [id]: 1 } }, hero, wands, ground, 1, 1, 'kor');
    expect(wands.count(id)).toBe(1);
  });
});

describe('düşman yerleşimi', () => {
  const map = generateMap();
  const spots = generateEnemySpots(map);

  it('istenen sayıda, yürünebilir, surların dışında ve benzersizdir', () => {
    expect(spots.length).toBe(ENEMY_COUNT);
    const reach = reachableSet(map, map.spawn);
    for (const s of spots) {
      expect(reach.has(s.tileY * map.width + s.tileX)).toBe(true);
      expect(cityAt(map.locations, s.tileX, s.tileY)).toBeNull();
      expect(s.tier).toBe(tierAt(map, s.tileX, s.tileY));
    }
    expect(new Set(spots.map((s) => s.id)).size).toBe(spots.length);
  });

  it('dört elementten ve her kademeden düşman vardır', () => {
    expect(new Set(spots.map((s) => s.element)).size).toBe(4);
    expect(new Set(spots.map((s) => s.tier)).size).toBeGreaterThanOrEqual(3);
  });

  it('aynı tohum aynı yerleşimi verir', () => {
    expect(generateEnemySpots(map)).toEqual(spots);
  });
});

describe('EnemyBoard', () => {
  it('yenilen düşman süre dolunca geri gelir', () => {
    let t = 0;
    const board = new EnemyBoard(() => t, 1000);
    expect(board.isActive('d-1')).toBe(true);
    board.defeat('d-1');
    expect(board.isActive('d-1')).toBe(false);
    t = 999;
    expect(board.isActive('d-1')).toBe(false);
    t = 1000;
    expect(board.isActive('d-1')).toBe(true);
    expect(board.isActive('d-2')).toBe(true);
  });
});

describe('kademe dağılımı', () => {
  it('dört kademenin hepsinden düşman vardır', () => {
    const map = generateMap();
    const tiers = new Set(generateEnemySpots(map).map((s) => s.tier));
    expect([...tiers].sort()).toEqual([1, 2, 3, 4]);
  });
});

import { MAX_PIECES, difficultyMultiplier } from './loot';
import { isTradeGood } from '../economy/trade';

describe('ganimet v2', () => {
  it('zorluk çarpanı: eşit seviyede 1, güçlü düşmanda artar, zayıfta azalır, sınırlıdır', () => {
    expect(difficultyMultiplier(10, 10)).toBeCloseTo(1);
    expect(difficultyMultiplier(20, 10)).toBeCloseTo(1.3);
    expect(difficultyMultiplier(5, 10)).toBeCloseTo(0.85);
    expect(difficultyMultiplier(1, 30)).toBeCloseTo(0.71, 2);
    expect(difficultyMultiplier(0, 1000)).toBeCloseTo(0.7, 2);
    expect(difficultyMultiplier(100, 1)).toBeCloseTo(1.6);
  });

  it('para ve XP her zaman düşer; zorlu savaş daha çok para ve XP verir', () => {
    const rand = mulberry32(1);
    const easy = rollLoot('fire', 2, 30, 1, rand);
    const hard = rollLoot('fire', 2, 1, 1, rand);
    expect(easy.money).toBeGreaterThan(0);
    expect(easy.xp).toBeGreaterThan(0);
    expect(hard.money).toBeGreaterThan(easy.money);
    expect(hard.xp).toBeGreaterThan(easy.xp);
  });

  it('ganimet yalnızca ticari mal, ekipman ve asa içerir (iksir ve eski ganimet eşyaları yok)', () => {
    const rand = mulberry32(8);
    for (let i = 0; i < 2000; i++) {
      const l = rollLoot(ELEMENTS[i % 4], TIERS[i % 4], 8, 1.3, rand);
      for (const id of Object.keys(l.items)) expect(isTradeGood(id) || parseEquipmentId(id) !== null, id).toBe(true);
    }
  });

  it('bir savaştan en çok 2 parça (ekipman + asa) düşer; ikisi de görülür', () => {
    const rand = mulberry32(21);
    let two = 0;
    let twoGear = 0;
    let twoWand = 0;
    for (let i = 0; i < 40000; i++) {
      const l = rollLoot('air', 4, 5, 1.6, rand);
      const gear = Object.entries(l.items).filter(([id]) => parseEquipmentId(id) !== null).reduce((n, [, c]) => n + c, 0);
      const wands = Object.values(l.wands).reduce((a, b) => a + b, 0);
      expect(gear + wands).toBeLessThanOrEqual(MAX_PIECES);
      if (gear + wands === 2) two++;
      if (gear === 2) twoGear++;
      if (wands === 2) twoWand++;
    }
    expect(two).toBeGreaterThan(0);
    expect(twoGear).toBeGreaterThan(0);
    expect(twoWand).toBeGreaterThan(0);
  });

  it('maden bonusu daha çok ticari mal getirir', () => {
    const count = (opts: { goodsBonus?: boolean }): number => {
      const rand = mulberry32(5);
      let goods = 0;
      for (let i = 0; i < 5000; i++) goods += Object.entries(rollLoot('earth', 2, 5, 1, rand, opts).items).filter(([id]) => isTradeGood(id)).reduce((n, [, c]) => n + c, 0);
      return goods;
    };
    expect(count({ goodsBonus: true })).toBeGreaterThan(count({}) * 1.2);
  });

  it('düşman malı elementinin ticari malıdır', () => {
    expect(ENEMY_KINDS.fire.material).toBe('kor-baharati');
    expect(ENEMY_KINDS.air.material).toBe('bulut-ipegi');
    expect(ENEMY_KINDS.earth.material).toBe('tas-cevheri');
    expect(ENEMY_KINDS.water.material).toBe('derin-inci');
  });
});
