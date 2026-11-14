import { describe, expect, it } from 'vitest';
import { cityAt } from '../save/cityEntry';
import { generateMap, reachableSet } from '../world/generateMap';
import { mulberry32 } from '../world/rng';
import { getItem } from '../economy/items';
import { parseEquipmentId } from '../economy/equipment';
import { parseWandId } from '../wands/catalog';
import { CHEST_COUNT, CHEST_GUARDS, chestGuards, generateChests, rollChestLoot } from './chests';
import { rollLoot } from './loot';

const map = generateMap();
const chests = generateChests(map);

describe('sandık yerleşimi', () => {
  it('istenen sayıda, yürünebilir, surların dışında ve benzersizdir', () => {
    expect(chests).toHaveLength(CHEST_COUNT);
    const reach = reachableSet(map, map.spawn);
    for (const c of chests) {
      expect(reach.has(c.tileY * map.width + c.tileX)).toBe(true);
      expect(cityAt(map.locations, c.tileX, c.tileY)).toBeNull();
    }
    expect(new Set(chests.map((c) => c.id)).size).toBe(CHEST_COUNT);
  });

  it('aynı tohum aynı yerleşimi verir; kayıtta tutulacak kimlikler boşluksuzdur', () => {
    expect(generateChests(map)).toEqual(chests);
    for (const c of chests) expect(c.id).toMatch(/^[a-z0-9-]+$/);
  });

  it('iki muhafız vardır ve sandığın elementindedir', () => {
    const g = chestGuards(chests[0]);
    expect(g).toHaveLength(CHEST_GUARDS);
    expect(g.every((x) => x.element === chests[0].element && x.tier === chests[0].tier)).toBe(true);
  });
});

describe('sandık ganimeti', () => {
  it('her zaman bir ekipman verir; her şey geçerlidir', () => {
    const rand = mulberry32(2);
    for (let i = 0; i < 300; i++) {
      const c = chests[i % chests.length];
      const l = rollChestLoot(c, 6, 1, rand);
      const gear = Object.keys(l.items).filter((id) => parseEquipmentId(id));
      expect(gear).toHaveLength(1);
      for (const id of Object.keys(l.items)) expect(getItem(id)).toBeDefined();
      for (const id of Object.keys(l.wands)) expect(parseWandId(id)).not.toBeNull();
      expect(l.gold).toBeGreaterThan(0);
    }
  });

  it('düşman ganimetinden daha cömerttir (altın, ekipman, asa)', () => {
    const c = { element: 'fire' as const, tier: 2 as const };
    const r1 = mulberry32(5);
    const r2 = mulberry32(5);
    let chestWands = 0;
    let foeWands = 0;
    let chestGear = 0;
    let foeGear = 0;
    let rarityChest = 0;
    let rarityFoe = 0;
    for (let i = 0; i < 4000; i++) {
      const a = rollChestLoot(c, 5, 1, r1);
      const b = rollLoot(c.element, c.tier, 5, 1, r2);
      chestWands += Object.keys(a.wands).length;
      foeWands += Object.keys(b.wands).length;
      for (const id of Object.keys(a.items)) {
        const p = parseEquipmentId(id);
        if (p) {
          chestGear++;
          rarityChest += p.rarity;
        }
      }
      for (const id of Object.keys(b.items)) {
        const p = parseEquipmentId(id);
        if (p) {
          foeGear++;
          rarityFoe += p.rarity;
        }
      }
      expect(a.gold).toBeGreaterThan(b.gold);
    }
    expect(chestWands).toBeGreaterThan(foeWands * 3);
    expect(chestGear).toBeGreaterThan(foeGear * 3);
    expect(rarityChest / chestGear).toBeGreaterThan(rarityFoe / foeGear);
  });
});

describe('sandık kademeleri', () => {
  it('dört kademeden de sandık vardır', () => {
    for (const t of [1, 2, 3, 4]) expect(chests.filter((c) => c.tier === t).length).toBeGreaterThanOrEqual(2);
  });
});
