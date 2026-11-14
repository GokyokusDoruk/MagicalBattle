import { describe, expect, it } from 'vitest';
import { BAG_BY_RARITY } from '../economy/equipment';
import { ITEMS, isBag, itemCategory } from '../economy/items';
import { PlayerState } from '../economy/player';
import { buyItem, sell as sellItem } from '../economy/shop';
import { QuestEngine } from '../quests/engine';
import { CARRY_SKILLS, getCarrySkill } from '../skills/catalog';
import { SkillTree } from '../skills/tree';
import { wandIdOf } from '../wands/catalog';
import { WandInventory } from '../wands/inventory';
import { WandStock } from '../wands/stock';
import { BASE_CAPACITY, Carry } from './carry';

function setup(level = 30) {
  const player = new PlayerState();
  const wands = new WandInventory();
  wands.setLevelProvider(() => level);
  const tree = new SkillTree(() => level);
  const carry = new Carry(player, wands, () => tree.carryBonus);
  carry.install();
  return { player, wands, tree, carry };
}

describe('katalog: çantalar ve iksirler', () => {
  const bags = ITEMS.filter((i) => isBag(i) && i.element !== undefined); // yeni çantalar (eski çantalar ayrı)

  it('24 çanta var (4 element x 6 nadirlik); nadirlik arttıkça kapasite ve fiyat artar, hepsi tam sayı', () => {
    expect(bags).toHaveLength(24);
    for (const el of ['fire', 'water', 'earth', 'air']) {
      const sorted = bags.filter((b) => b.element === el).sort((a, b) => a.rarity! - b.rarity!);
      expect(sorted.map((b) => b.rarity)).toEqual([1, 2, 3, 4, 5, 6]);
      for (let i = 1; i < sorted.length; i++) {
        for (const k of ['wands', 'goods', 'gear'] as const) expect(sorted[i].carry![k]).toBeGreaterThan(sorted[i - 1].carry![k]);
        expect(sorted[i].price).toBeGreaterThan(sorted[i - 1].price);
      }
    }
    for (const b of bags) for (const v of Object.values(b.carry!)) expect(Number.isInteger(v)).toBe(true);
    expect(bags.find((b) => b.id === 'eq-bag-fire-6')!.carry).toEqual(BAG_BY_RARITY[5]);
  });

  it('eski çantalar kendi kapasitesini korur, elementi yoktur, satılabilir', () => {
    const legacy = ITEMS.filter((i) => isBag(i) && i.element === undefined);
    expect(legacy.map((b) => b.id)).toEqual(['kucuk-canta', 'deri-canta', 'gezgin-cantasi', 'usta-cantasi', 'efsunlu-canta']);
    expect(legacy.map((b) => b.carry)).toEqual([
      { wands: 3, goods: 20, gear: 2 },
      { wands: 5, goods: 40, gear: 3 },
      { wands: 8, goods: 70, gear: 5 },
      { wands: 12, goods: 110, gear: 7 },
      { wands: 18, goods: 170, gear: 10 },
    ]);
    const { player, carry } = setup(1);
    player.addItem('deri-canta');
    player.equip('deri-canta');
    expect(carry.capacity()).toEqual({ wands: 8, goods: 60, gear: 5 });
    expect(carry.capacityIn(['fire', 'water', 'earth', 'air'])).toEqual({ wands: 8, goods: 60, gear: 5 }); // element yok: şehir bonusu yok
    player.unequip('bag');
    expect(sellItem(player, 'deri-canta')).toMatchObject({ ok: true, price: 150 });
  });

  it('başlangıç kapasitesi 3 asa, 20 eşya, 2 kuşanılabilir; çantalar artırır', () => {
    expect(BASE_CAPACITY).toEqual({ wands: 3, goods: 20, gear: 2 });
    expect(BAG_BY_RARITY[0]).toEqual(BASE_CAPACITY); // Sıradan çanta başlangıç kapasitesini ikiye katlar (eklenir)
  });

  it('3 iksir var, can verir, eşya sayılır (giyilmez)', () => {
    const potions = ITEMS.filter((i) => i.heal !== undefined);
    expect(potions).toHaveLength(3);
    expect(potions.map((p) => p.heal)).toEqual([...potions.map((p) => p.heal!)].sort((a, b) => a - b));
    for (const p of potions) {
      expect(itemCategory(p)).toBe('goods');
      expect(p.slot).toBeUndefined();
    }
  });
});

describe('kapasite ve kullanım', () => {
  it('çantasız başlangıç: 3 asa, 20 eşya, 2 kuşanılabilir; boş', () => {
    const { carry } = setup(1);
    expect(carry.capacity()).toEqual({ wands: 3, goods: 20, gear: 2 });
    expect(carry.usage()).toEqual({ wands: 0, goods: 0, gear: 0 });
    expect(carry.isOverloaded()).toBe(false);
  });

  it('altın ağırlık yapmaz', () => {
    const { player, carry } = setup(1);
    player.addGold(9_999_999);
    expect(carry.usage()).toEqual({ wands: 0, goods: 0, gear: 0 });
  });

  it('eşya ve iksir "eşya" kapasitesini doldurur; sınırda ekleme reddedilir, hiçbiri eklenmez', () => {
    const { player, carry } = setup(1);
    expect(player.addItem('ates-tozu', 20)).toBe(true);
    expect(carry.usage().goods).toBe(20);
    expect(carry.room('goods')).toBe(0);
    expect(player.addItem('ates-tozu', 1)).toBe(false);
    expect(player.addItem('iksir-kucuk', 1)).toBe(false); // iksir de eşya yeri kaplar
    expect(player.count('ates-tozu')).toBe(20);
    player.removeItem('ates-tozu', 5);
    expect(player.addItem('iksir-kucuk', 5)).toBe(true);
    expect(player.addItem('iksir-kucuk', 1)).toBe(false);
  });

  it('addItemPartial kapasitenin yettiği kadarını ekler', () => {
    const { player } = setup(1);
    expect(player.addItemPartial('kurt-postu', 25)).toBe(20);
    expect(player.count('kurt-postu')).toBe(20);
    expect(player.addItemPartial('kurt-postu', 5)).toBe(0);
  });

  it('giyilmeyen ekipman "kuşanılabilir" yeri kaplar, giyilen kaplamaz', () => {
    const { player, carry } = setup(1);
    player.addItem('eq-robe-earth-1');
    expect(carry.usage().gear).toBe(1);
    player.equip('eq-robe-earth-1');
    expect(carry.usage().gear).toBe(0);
    player.addItem('eq-hat-earth-1');
    player.addItem('eq-ring-earth-1');
    expect(carry.usage().gear).toBe(2);
    expect(player.addItem('eq-robe-earth-3')).toBe(false); // 2 kuşanılabilir dolu
  });

  it('ekipman değiştirince net yer artmaz: yeni giyilen çıkar, eskisi girer', () => {
    const { player, carry } = setup(1);
    player.addItem('eq-robe-earth-1');
    player.addItem('eq-robe-earth-3');
    player.equip('eq-robe-earth-1');
    expect(carry.usage().gear).toBe(1);
    expect(player.equip('eq-robe-earth-3')).toBe(true);
    expect(carry.usage().gear).toBe(1); // eski cüppe çantada
    expect(player.isEquipped('eq-robe-earth-3')).toBe(true);
  });

  it('kuşanılı ekipmanı çıkarmak yer ister: yoksa reddedilir ve neden söylenir', () => {
    const { player } = setup(1);
    player.addItem('eq-robe-earth-1');
    player.equip('eq-robe-earth-1');
    player.addItem('eq-hat-earth-1');
    player.addItem('eq-ring-earth-1'); // 2/2 dolu
    expect(player.unequip('robe')).toBe(false);
    expect(player.lastBlockReason).toContain('yer yok');
    expect(player.isEquipped('eq-robe-earth-1')).toBe(true);
  });
});

describe('asalar ve kapasite', () => {
  // Aynı asanın farklı seviyeleri ayrı asadır; seviye 1 asalar her seviyede kullanılabilir
  const wand = (level: number, rarity: 1 | 2 | 3 = 1, element: 'fire' | 'water' | 'air' = 'fire') =>
    wandIdOf({ element, role: 'attack', rarity, level });

  it('kuşanılı asa yer kaplamaz, kuşanılmayanlar kaplar; 3 asa sınırı', () => {
    const { wands, carry } = setup(1);
    expect(wands.add(wand(1))).toBe(true); // kuşanılır: yer kaplamaz
    expect(carry.usage().wands).toBe(0);
    expect(wands.add(wand(1), 3)).toBe(true);
    expect(carry.usage().wands).toBe(3);
    expect(wands.add(wand(1))).toBe(false); // 4. kuşanılmayan sığmaz
    expect(wands.count(wand(1))).toBe(4);
  });

  it('seviyesi yetmeyen asa kuşanılmaz, bu yüzden çantada yer kaplar', () => {
    const { wands, carry } = setup(1);
    wands.add(wand(10)); // seviye 1 oyuncu kullanamaz
    expect(wands.equipped).toBeNull();
    expect(carry.usage().wands).toBe(1);
  });

  it('tüccardan asa alırken yer yoksa altın harcanmaz', () => {
    const { wands } = setup(1);
    const wallet = { gold: 100_000 };
    const gold = { balance: () => wallet.gold, spend: (n: number) => ((wallet.gold -= n), true) };
    const stock = new WandStock('tuccar-kazim', () => 0, () => 1);
    const entries = stock.entries();
    for (const e of entries.slice(0, 4)) expect(stock.buy(e.slot, wands, gold).ok).toBe(true); // 1 kuşanılı + 3
    const spent = 100_000 - wallet.gold;
    const r = stock.buy(entries[4].slot, wands, gold);
    expect(r).toMatchObject({ ok: false, reason: 'Çantanda asa için yer yok.' });
    expect(wallet.gold).toBe(100_000 - spent);
  });

  it('asayı çıkarmak yer ister', () => {
    const { wands } = setup(1);
    wands.add(wand(1, 1, 'air'), 4); // 1 kuşanılı, 3 çantada (dolu)
    expect(wands.unequip()).toBe(false);
    expect(wands.equipped).not.toBeNull();
  });
});

describe('çantalar', () => {
  it('kuşanılan çanta kapasiteyi artırır; çıkarınca kapasite düşer', () => {
    const { player, carry } = setup(1);
    player.addItem('eq-bag-earth-2');
    player.equip('eq-bag-earth-2');
    expect(carry.capacity()).toEqual({ wands: 8, goods: 60, gear: 5 });
    expect(carry.usage().gear).toBe(0); // giyilen çanta yer kaplamaz
  });

  it('yeni çanta alınca daha iyisi otomatik kuşanılır, eskisi çantada kalır', () => {
    const { player } = setup(1);
    player.addGold(2000);
    expect(buyItem(player, 'eq-bag-earth-1', 100).ok).toBe(true);
    expect(player.equipped.bag).toBe('eq-bag-earth-1');
    expect(buyItem(player, 'eq-bag-earth-2', 220).ok).toBe(true);
    expect(player.equipped.bag).toBe('eq-bag-earth-2');
    expect(player.count('eq-bag-earth-1')).toBe(1); // eski çanta çantada
  });

  it('çantayı çıkarırken içindekiler yeni kapasiteyi aşıyorsa çıkarılamaz', () => {
    const { player } = setup(1);
    player.addItem('eq-bag-earth-1');
    player.equip('eq-bag-earth-1');
    player.addItem('ates-tozu', 30); // 40 kapasitede
    expect(player.unequip('bag')).toBe(false);
    expect(player.lastBlockReason).toContain('sığmıyor');
    expect(player.equipped.bag).toBe('eq-bag-earth-1');
    player.removeItem('ates-tozu', 15);
    expect(player.unequip('bag')).toBe(true);
    expect(player.equipped.bag).toBeUndefined();
  });

  it('küçük çantaya geçmek, içindekiler sığmıyorsa reddedilir', () => {
    const { player } = setup(1);
    player.addItem('eq-bag-earth-3');
    player.equip('eq-bag-earth-3');
    player.addItem('eq-bag-earth-1'); // çantada ekipman
    player.addItem('ates-tozu', 60);
    expect(player.equip('eq-bag-earth-1')).toBe(false);
    expect(player.equipped.bag).toBe('eq-bag-earth-3');
  });

  it('çanta çıkarılınca kendisi "kuşanılabilir" yer kaplar', () => {
    const { player, carry } = setup(1);
    player.addItem('eq-bag-earth-1');
    player.equip('eq-bag-earth-1');
    player.unequip('bag');
    expect(carry.usage().gear).toBe(1);
  });

  it('dolu çantayla alışveriş reddedilir ve altın harcanmaz', () => {
    const { player } = setup(1);
    player.addGold(1000);
    player.addItem('eq-robe-earth-1');
    player.addItem('eq-hat-earth-1'); // 2/2
    const r = buyItem(player, 'eq-ring-earth-1', 90);
    expect(r.ok).toBe(false);
    expect(player.gold).toBe(1000);
  });
});

describe('Taşıyıcı yetenekleri', () => {
  it('3 kademe, 1/2/3 puan, toplam +4 asa, +50 eşya, +4 kuşanılabilir', () => {
    expect(CARRY_SKILLS.map((s) => s.cost)).toEqual([1, 2, 3]);
    const total = CARRY_SKILLS.reduce((n, s) => ({ wands: n.wands + s.bonus.wands, goods: n.goods + s.bonus.goods, gear: n.gear + s.bonus.gear }), { wands: 0, goods: 0, gear: 0 });
    expect(total).toEqual({ wands: 4, goods: 50, gear: 4 });
    for (const s of CARRY_SKILLS) for (const v of Object.values(s.bonus)) expect(Number.isInteger(v)).toBe(true);
    expect(getCarrySkill('carry-2')?.tier).toBe(2);
    expect(getCarrySkill('yok')).toBeUndefined();
  });

  it('kademeler sırayla alınır ve puan harcar', () => {
    const { tree } = setup(10);
    expect(tree.learn('carry-2')).toBe(false);
    expect(tree.learn('carry-1')).toBe(true);
    expect(tree.learn('carry-1')).toBe(false);
    expect(tree.learn('carry-2')).toBe(true);
    expect(tree.pointsSpent).toBe(3);
    expect(tree.carryBonus).toEqual({ wands: 2, goods: 25, gear: 2 });
  });

  it('yetenek kapasiteyi artırır', () => {
    const { tree, carry } = setup(10);
    tree.learn('carry-1');
    expect(carry.capacity()).toEqual({ wands: 4, goods: 30, gear: 3 });
  });

  it('kayda yazılır, yüklenince geri gelir; yanlış sıralı kayıt atılır', () => {
    const a = setup(10);
    a.tree.learn('carry-1');
    a.tree.learn('carry-2');
    expect(a.tree.snapshot()).toEqual(['carry-1', 'carry-2']);
    const b = setup(10);
    b.tree.restore(a.tree.snapshot());
    expect(b.tree.carryBonus).toEqual(a.tree.carryBonus);
    const c = setup(10);
    c.tree.restore(['carry-3', 'carry-2']);
    expect(c.tree.snapshot()).toEqual([]);
  });

  it('sıfırlama kapasiteyi geri alır', () => {
    const { tree, carry } = setup(10);
    tree.learn('carry-1');
    tree.reset();
    expect(carry.capacity().goods).toBe(20);
  });
});

describe('görev ödülü ve kapasite', () => {
  it('çanta doluysa sığmayan ödül eşyası altına çevrilir, kaybolmaz', () => {
    const { player } = setup(5);
    player.addItem('kurt-postu', 20); // eşya dolu
    const goldBefore = player.gold;
    const quests = new QuestEngine(player);
    quests.accept('ash-ignis-yolu'); // ödül: 2 Ateş Tozu
    const [c] = quests.onEvent({ type: 'visit', locationId: 'ignis' });
    expect(c.overflowGold).toBeGreaterThan(0);
    expect(player.count('ates-tozu')).toBe(0);
    expect(player.gold).toBe(goldBefore + c.gold + c.overflowGold);
  });

  it('yer varsa ödül eşyası çantaya girer, altına çevrilmez', () => {
    const { player } = setup(5);
    const quests = new QuestEngine(player);
    quests.accept('ash-ignis-yolu');
    const [c] = quests.onEvent({ type: 'visit', locationId: 'ignis' });
    expect(c.overflowGold).toBe(0);
    expect(player.count('ates-tozu')).toBe(2);
  });
});

describe('kayıttan yükleme', () => {
  it('yüklerken kapasite denetlenmez (kayıt dolu olabilir)', () => {
    const { player, carry } = setup(1);
    player.restore({ gold: 0, xp: 0, items: { 'ates-tozu': 50, 'eq-robe-earth-1': 1, 'eq-hat-earth-1': 1, 'eq-ring-earth-1': 1 }, equipped: {} });
    expect(player.count('ates-tozu')).toBe(50);
    expect(carry.isOverloaded()).toBe(true);
    expect(player.addItem('kurt-postu')).toBe(false); // yeni eşya alınamaz
  });

  it('çanta kuşanılı kaydı geri gelir', () => {
    const { player, carry } = setup(1);
    player.restore({ gold: 0, xp: 0, items: { 'eq-bag-earth-2': 1 }, equipped: { bag: 'eq-bag-earth-2' } });
    expect(player.equipped.bag).toBe('eq-bag-earth-2');
    expect(carry.capacity().wands).toBe(8);
  });
});
