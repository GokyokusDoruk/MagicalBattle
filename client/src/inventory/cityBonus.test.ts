import { describe, expect, it } from 'vitest';
import { bootsSpeedIn, LOCATION_BONUS, matchesLocation } from '../economy/gearEffects';
import { PlayerState } from '../economy/player';
import { wandIdOf } from '../wands/catalog';
import { WandInventory } from '../wands/inventory';
import { GROUND_TTL_MS, GroundLoot } from '../world/groundLoot';
import { LOCATIONS, getLocation } from '../world/locations';
import { Carry } from './carry';
import { applyDrop, dropCandidates, remaining, resolves, selectedByCategory, suggestDrop } from './exitDrop';
import type { Element } from '../battle/damage/elements';

function setup(elements: Element[] = []) {
  const state = { elements };
  const player = new PlayerState();
  const wands = new WandInventory();
  const carry = new Carry(player, wands, undefined, () => state.elements);
  carry.install();
  return { state, player, wands, carry };
}

const wand = (level: number, element: Element = 'fire') => wandIdOf({ element, role: 'attack', rarity: 1, level });

describe('konum elementleri', () => {
  it('şehirler tek elementli: Ignis ateş, Abyss hava, Stone Heart toprak, Still Crystal su', () => {
    expect(getLocation('ignis').elements).toEqual(['fire']);
    expect(getLocation('abyss').elements).toEqual(['air']);
    expect(getLocation('stone-heart').elements).toEqual(['earth']);
    expect(getLocation('still-crystal').elements).toEqual(['water']);
  });

  it('köyler iki elementli, son arena (gölge) elementsiz', () => {
    expect(getLocation('ash').elements).toEqual(['fire', 'air']);
    expect(getLocation('vine').elements).toEqual(['air', 'earth']);
    expect(getLocation('marsh').elements).toEqual(['earth', 'water']);
    expect(getLocation('witch-pass').elements).toEqual([]);
    for (const l of LOCATIONS) expect(l.kind === 'village' ? l.elements.length : l.elements.length).toBeLessThanOrEqual(2);
  });

  it('dört element de bir şehirde var', () => {
    const cities = LOCATIONS.filter((l) => l.kind === 'city').flatMap((l) => l.elements);
    expect([...cities].sort()).toEqual(['air', 'earth', 'fire', 'water']);
  });
});

describe('şehir bonusu: ayakkabı hızı', () => {
  it('kendi elementinin konumunda %50 daha hızlı', () => {
    const eq = { boots: 'eq-boots-earth-3-1' }; // +%12
    expect(bootsSpeedIn(eq, [])).toBeCloseTo(0.12);
    expect(bootsSpeedIn(eq, ['earth'])).toBeCloseTo(0.12 * LOCATION_BONUS);
    expect(bootsSpeedIn(eq, ['fire'])).toBeCloseTo(0.12);
    expect(bootsSpeedIn(eq, ['air', 'earth'])).toBeCloseTo(0.18); // çift elementli köy: ikisinden biri yeter
  });

  it('ayakkabı yoksa ya da elementi yoksa bonus yok', () => {
    expect(bootsSpeedIn({}, ['fire'])).toBe(0);
    expect(matchesLocation(undefined, ['fire'])).toBe(false);
    expect(matchesLocation('fire', [])).toBe(false);
  });

  it('PlayerState.speedBonusIn konuma göre', () => {
    const p = new PlayerState();
    p.addItem('eq-boots-fire-6-1');
    p.equip('eq-boots-fire-6-1');
    expect(p.speedBonus).toBeCloseTo(0.25);
    expect(p.speedBonusIn(['fire'])).toBeCloseTo(0.375);
    expect(p.speedBonusIn(['water'])).toBeCloseTo(0.25);
  });
});

describe('şehir bonusu: çanta kapasitesi', () => {
  it('kendi elementinin konumunda çantanın kattığı kapasite %50 artar (tam sayıya yuvarlanır)', () => {
    const { player, carry } = setup();
    player.addItem('eq-bag-fire-3-1'); // +8/+70/+5
    player.equip('eq-bag-fire-3-1');
    expect(carry.capacity()).toEqual({ wands: 11, goods: 90, gear: 7 }); // dışarıda: 3+8, 20+70, 2+5
    expect(carry.capacityIn(['fire'])).toEqual({ wands: 3 + 12, goods: 20 + 105, gear: 2 + 8 });
    expect(carry.capacityIn(['water'])).toEqual({ wands: 11, goods: 90, gear: 7 });
    for (const v of Object.values(carry.capacityIn(['fire']))) expect(Number.isInteger(v)).toBe(true);
  });

  it('başlangıç kapasitesi ve yetenek bonusu şehir bonusundan etkilenmez', () => {
    const player = new PlayerState();
    const wands = new WandInventory();
    const carry = new Carry(player, wands, () => ({ wands: 2, goods: 10, gear: 1 }), () => ['earth']);
    player.addItem('eq-bag-earth-1-1');
    player.equip('eq-bag-earth-1-1'); // 3/20/2 -> 5/30/3 (yuvarlama)
    expect(carry.capacity()).toEqual({ wands: 3 + 5 + 2, goods: 20 + 30 + 10, gear: 2 + 3 + 1 });
    expect(carry.capacityOutside()).toEqual({ wands: 3 + 3 + 2, goods: 20 + 20 + 10, gear: 2 + 2 + 1 });
  });

  it('konum değişince kapasite değişir (bağlam)', () => {
    const { state, player, carry } = setup(['air']);
    player.addItem('eq-bag-air-2-1');
    player.equip('eq-bag-air-2-1'); // 5/40/3
    const inside = carry.capacity();
    state.elements = [];
    const outside = carry.capacity();
    expect(inside.goods).toBeGreaterThan(outside.goods);
    expect(outside).toEqual({ wands: 8, goods: 60, gear: 5 });
  });

  it('elementsiz eski çanta şehir bonusu almaz', () => {
    const { player, carry } = setup(['earth', 'fire', 'air', 'water']);
    player.addItem('gezgin-cantasi');
    player.equip('gezgin-cantasi');
    expect(carry.capacity()).toEqual(carry.capacityOutside());
  });

  it('şehirde bonusla doldurulan çanta dışarıda fazla kalır (taşma)', () => {
    const { state, player, wands, carry } = setup(['fire']);
    player.addItem('eq-bag-fire-1-1');
    player.equip('eq-bag-fire-1-1'); // şehirde 3+5=8 asa, 20+30=50 eşya
    expect(player.addItem('kurt-postu', 50)).toBe(true);
    expect(wands.add(wand(1))).toBe(true);
    expect(wands.add(wand(2), 7)).toBe(true); // 7 taşınan
    expect(carry.isOverloaded()).toBe(false);
    state.elements = []; // şehirden çıktı
    expect(carry.isOverloaded()).toBe(true);
    expect(carry.overflowOutside()).toEqual({ wands: 7 - 6, goods: 50 - 40, gear: 0 });
    expect(player.addItem('kurt-postu')).toBe(false); // yeni eşya alınamaz
  });

  it('taşma yoksa fazlalık sıfır', () => {
    const { carry } = setup();
    expect(carry.overflowOutside()).toEqual({ wands: 0, goods: 0, gear: 0 });
  });
});

describe('yerdeki eşya (10 dakika)', () => {
  const setupGround = () => {
    const clock = { t: 0 };
    return { clock, ground: new GroundLoot(() => clock.t) };
  };

  it('bırakılan eşya yığın olur, 10 dakika kalır', () => {
    const { clock, ground } = setupGround();
    const pile = ground.drop(10, 12, { items: { 'kurt-postu': 3 }, wands: { [wand(1)]: 1 } })!;
    expect(pile.tileX).toBe(10);
    expect(ground.piles()).toHaveLength(1);
    expect(ground.timeLeftMs(pile.id)).toBe(GROUND_TTL_MS);
    clock.t = GROUND_TTL_MS - 1;
    expect(ground.piles()).toHaveLength(1);
    clock.t = GROUND_TTL_MS;
    expect(ground.piles()).toEqual([]); // kayboldu
    expect(ground.get(pile.id)).toBeUndefined();
    expect(GROUND_TTL_MS).toBe(600_000);
  });

  it('boş, negatif ya da kesirli bırakma yok sayılır / temizlenir', () => {
    const { ground } = setupGround();
    expect(ground.drop(1, 1, {})).toBeNull();
    expect(ground.drop(1, 1, { items: { a: 0, b: -2 } })).toBeNull();
    expect(ground.drop(1, 1, { items: { a: 2.9 } })!.items).toEqual({ a: 2 });
  });

  it('aynı karoya bırakılan eşya aynı yığına eklenir ve süre yenilenir', () => {
    const { clock, ground } = setupGround();
    const a = ground.drop(5, 5, { items: { 'kurt-postu': 1 } })!;
    clock.t = 300_000;
    const b = ground.drop(5, 5, { items: { 'kurt-postu': 2, 'ates-tozu': 1 } })!;
    expect(b.id).toBe(a.id);
    expect(ground.piles()).toHaveLength(1);
    expect(b.items).toEqual({ 'kurt-postu': 3, 'ates-tozu': 1 });
    expect(ground.timeLeftMs(b.id)).toBe(GROUND_TTL_MS);
    ground.drop(6, 5, { items: { x: 1 } });
    expect(ground.piles()).toHaveLength(2);
  });

  it('yığından alınır; boşalan yığın silinir; fazla adet alınamaz', () => {
    const { ground } = setupGround();
    const p = ground.drop(2, 2, { items: { 'kurt-postu': 2 }, wands: { [wand(1)]: 1 } })!;
    expect(ground.take(p.id, 'item', 'kurt-postu', 5)).toBe(2);
    expect(ground.take(p.id, 'item', 'kurt-postu', 1)).toBe(0);
    expect(ground.take(p.id, 'item', 'yok', 1)).toBe(0);
    expect(ground.piles()).toHaveLength(1);
    expect(ground.take(p.id, 'wand', wand(1), 1)).toBe(1);
    expect(ground.piles()).toEqual([]);
    expect(ground.take('olmayan', 'item', 'x', 1)).toBe(0);
  });

  it('değişince dinleyicilere haber verir (bırakma, alma, süre dolması)', () => {
    const { clock, ground } = setupGround();
    let n = 0;
    ground.onChange(() => n++);
    const p = ground.drop(1, 1, { items: { a: 1 } })!;
    expect(n).toBe(1);
    ground.take(p.id, 'item', 'a', 1);
    expect(n).toBe(2);
    ground.drop(1, 1, { items: { a: 1 } });
    clock.t = GROUND_TTL_MS + 1;
    ground.piles();
    expect(n).toBe(4);
  });
});

describe('şehirden çıkarken eşya bırakma', () => {
  /** Şehirde ateş çantasıyla doldurulmuş, sonra dışarı çıkmış oyuncu */
  const overloaded = () => {
    const s = setup(['fire']);
    s.player.addItem('eq-bag-fire-1-1');
    s.player.equip('eq-bag-fire-1-1'); // şehirde 8 asa, 50 eşya, 5 kuşanılabilir
    s.player.addItem('kurt-postu', 30); // 35 gold/adet
    s.player.addItem('sifali-ot', 20); // 8 gold/adet
    s.wands.add(wand(1));
    s.wands.add(wand(2), 3);
    s.wands.add(wand(3), 3); // 6 taşınan
    s.state.elements = [];
    return s;
  };

  it('adaylar: eşyalar ve kuşanılı olmayan asalar; giyilen/kuşanılı kopya hariç', () => {
    const { player, wands } = overloaded();
    const c = dropCandidates(player, wands);
    expect(c.find((x) => x.key === 'item:kurt-postu')).toMatchObject({ category: 'goods', max: 30 });
    expect(c.find((x) => x.key === `wand:${wand(1)}`)).toBeUndefined(); // tek kopya kuşanılı
    expect(c.find((x) => x.key === `wand:${wand(2)}`)).toMatchObject({ category: 'wands', max: 3 });
    expect(c.find((x) => x.key === 'item:eq-bag-fire-1-1')).toBeUndefined(); // giyilen çanta
  });

  it('fazlalığı karşılayan seçim çözer, karşılamayan çözmez', () => {
    const { player, wands, carry } = overloaded();
    const overflow = carry.overflowOutside(); // 50 eşya > 40, 6 asa > 6? (3+3=6)
    expect(overflow).toEqual({ wands: 0, goods: 10, gear: 0 });
    const c = dropCandidates(player, wands);
    expect(resolves(overflow, c, {})).toBe(false);
    expect(resolves(overflow, c, { 'item:kurt-postu': 9 })).toBe(false);
    expect(resolves(overflow, c, { 'item:kurt-postu': 10 })).toBe(true);
    expect(resolves(overflow, c, { 'item:kurt-postu': 4, 'item:sifali-ot': 6 })).toBe(true); // karışık
    expect(remaining(overflow, c, { 'item:kurt-postu': 4 })).toEqual({ wands: 0, goods: 6, gear: 0 });
    expect(selectedByCategory(c, { 'item:kurt-postu': 999 }).goods).toBe(30); // en çok bırakılabilen kadar sayılır
  });

  it('öneri: her kategoride en ucuzlardan başlayarak fazlalık kadar', () => {
    const { player, wands, carry } = overloaded();
    const overflow = carry.overflowOutside();
    const c = dropCandidates(player, wands);
    const s = suggestDrop(overflow, c);
    expect(s).toEqual({ 'item:sifali-ot': 10 }); // ot ucuz (8) önce
    expect(resolves(overflow, c, s)).toBe(true);
    const big = suggestDrop({ wands: 0, goods: 25, gear: 0 }, c);
    expect(big).toEqual({ 'item:sifali-ot': 20, 'item:kurt-postu': 5 });
  });

  it('asa fazlalığı: kuşanılı olmayan asalar önerilir', () => {
    const { player, wands } = overloaded();
    const c = dropCandidates(player, wands);
    const s = suggestDrop({ wands: 2, goods: 0, gear: 0 }, c);
    expect(Object.keys(s).every((k) => k.startsWith('wand:'))).toBe(true);
    expect(Object.values(s).reduce((a, b) => a + b, 0)).toBe(2);
  });

  it('bırakma: eşyalar çantadan çıkar, çıkış karosuna yere düşer; çanta artık sığar', () => {
    const { player, wands, carry } = overloaded();
    const clock = { t: 0 };
    const ground = new GroundLoot(() => clock.t);
    const overflow = carry.overflowOutside();
    const pile = applyDrop(player, wands, overflow, { 'item:sifali-ot': 10 }, ground, 64, 67);
    expect(pile).not.toBeNull();
    expect(pile!.items).toEqual({ 'sifali-ot': 10 });
    expect(player.count('sifali-ot')).toBe(10);
    expect(carry.isOverloaded()).toBe(false);
    expect(ground.piles()).toHaveLength(1);
    expect([pile!.tileX, pile!.tileY]).toEqual([64, 67]);
  });

  it('yetersiz seçimde hiçbir şey bırakılmaz', () => {
    const { player, wands, carry } = overloaded();
    const ground = new GroundLoot(() => 0);
    expect(applyDrop(player, wands, carry.overflowOutside(), { 'item:sifali-ot': 3 }, ground, 1, 1)).toBeNull();
    expect(player.count('sifali-ot')).toBe(20);
    expect(ground.piles()).toEqual([]);
  });

  it('asa bırakma: kuşanılı olmayan asalar yere düşer', () => {
    const s = setup(['fire']);
    s.player.addItem('eq-bag-fire-1-1');
    s.player.equip('eq-bag-fire-1-1'); // şehirde 8 asa
    s.wands.add(wand(1)); // kuşanılı
    s.wands.add(wand(2), 7); // taşınan 7
    s.state.elements = []; // dışarıda 6
    const overflow = s.carry.overflowOutside();
    expect(overflow.wands).toBe(1);
    const ground = new GroundLoot(() => 0);
    const pile = applyDrop(s.player, s.wands, overflow, { [`wand:${wand(2)}`]: 1 }, ground, 5, 5)!;
    expect(pile.wands).toEqual({ [wand(2)]: 1 });
    expect(s.wands.count(wand(2))).toBe(6);
    expect(s.carry.isOverloaded()).toBe(false);
  });

  it('WandInventory.remove: kuşanılı son kopya çıkarılamaz, fazla adet çıkarılamaz', () => {
    const wands = new WandInventory();
    wands.add(wand(1), 2); // 1 kuşanılı + 1
    expect(wands.remove(wand(1), 2)).toBe(false);
    expect(wands.remove(wand(1), 1)).toBe(true);
    expect(wands.remove(wand(1), 1)).toBe(false); // kalan tek kopya kuşanılı
    expect(wands.remove('yok', 1)).toBe(false);
    expect(wands.remove(wand(1), 0)).toBe(false);
  });
});
