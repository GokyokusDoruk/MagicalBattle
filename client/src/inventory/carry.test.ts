import { describe, expect, it } from 'vitest';
import { ITEMS, getItem, gearValue, isBag, itemCategory } from '../economy/items';
import { PlayerState } from '../economy/player';
import { MERCHANTS } from '../economy/merchants';
import { buy } from '../economy/shop';
import { QuestEngine } from '../quests/engine';
import { CARRY_SKILLS, getCarrySkill } from '../skills/catalog';
import { SkillTree } from '../skills/tree';
import { wandId } from '../wands/catalog';
import { WandInventory, buyCommonWand } from '../wands/inventory';
import { BASE_CAPACITY, Carry } from './carry';

function setup(level = 30) {
  const player = new PlayerState();
  const wands = new WandInventory();
  const tree = new SkillTree(() => level);
  const carry = new Carry(player, wands, () => tree.carryBonus);
  carry.install();
  return { player, wands, tree, carry };
}

const merchantOf = (itemId: string) => MERCHANTS.find((m) => m.stock.includes(itemId))!;

describe('katalog: çantalar ve iksirler', () => {
  const bags = ITEMS.filter(isBag);

  it('5 çanta var; nadirlik arttıkça kapasite ve fiyat artar, hepsi tam sayı', () => {
    expect(bags).toHaveLength(5);
    const sorted = [...bags].sort((a, b) => a.tier! - b.tier!);
    expect(sorted.map((b) => b.tier)).toEqual([1, 2, 3, 4, 5]);
    for (let i = 1; i < sorted.length; i++) {
      for (const k of ['wands', 'goods', 'gear'] as const) {
        expect(sorted[i].carry![k]).toBeGreaterThan(sorted[i - 1].carry![k]);
      }
      expect(sorted[i].price).toBeGreaterThan(sorted[i - 1].price);
      expect(gearValue(sorted[i])).toBeGreaterThan(gearValue(sorted[i - 1]));
    }
    for (const b of bags) for (const v of Object.values(b.carry!)) expect(Number.isInteger(v)).toBe(true);
  });

  it('ilk çanta tek başına birleştirmeyi açar: başlangıç kapasitesi + Küçük Çanta ≥ 5 asa', () => {
    expect(BASE_CAPACITY).toEqual({ wands: 3, goods: 20, gear: 2 });
    expect(BASE_CAPACITY.wands).toBeLessThan(5);
    expect(BASE_CAPACITY.wands + getItem('kucuk-canta')!.carry!.wands).toBeGreaterThanOrEqual(5);
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

  it('tüccarlar ilk üç çantayı satar, Usta ve Efsunlu yalnızca ganimet', () => {
    expect(merchantOf('kucuk-canta')).toBeDefined();
    expect(merchantOf('deri-canta')).toBeDefined();
    expect(merchantOf('gezgin-cantasi')).toBeDefined();
    expect(MERCHANTS.some((m) => m.stock.includes('usta-cantasi') || m.stock.includes('efsunlu-canta'))).toBe(false);
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
    player.addItem('cirak-cuppesi');
    expect(carry.usage().gear).toBe(1);
    player.equip('cirak-cuppesi');
    expect(carry.usage().gear).toBe(0);
    player.addItem('yun-sapka');
    player.addItem('tas-tilsim');
    expect(carry.usage().gear).toBe(2);
    expect(player.addItem('gezgin-cuppesi')).toBe(false); // 2 kuşanılabilir dolu
  });

  it('ekipman değiştirince net yer artmaz: yeni giyilen çıkar, eskisi girer', () => {
    const { player, carry } = setup(1);
    player.addItem('cirak-cuppesi');
    player.addItem('gezgin-cuppesi');
    player.equip('cirak-cuppesi');
    expect(carry.usage().gear).toBe(1);
    expect(player.equip('gezgin-cuppesi')).toBe(true);
    expect(carry.usage().gear).toBe(1); // eski cüppe çantada
    expect(player.isEquipped('gezgin-cuppesi')).toBe(true);
  });

  it('kuşanılı ekipmanı çıkarmak yer ister: yoksa reddedilir ve neden söylenir', () => {
    const { player } = setup(1);
    player.addItem('cirak-cuppesi');
    player.equip('cirak-cuppesi');
    player.addItem('yun-sapka');
    player.addItem('tas-tilsim'); // 2/2 dolu
    expect(player.unequip('robe')).toBe(false);
    expect(player.lastBlockReason).toContain('yer yok');
    expect(player.isEquipped('cirak-cuppesi')).toBe(true);
  });
});

describe('asalar ve kapasite', () => {
  it('kuşanılı asalar yer kaplamaz, kuşanılmayanlar kaplar; 3 asa sınırı', () => {
    const { wands, carry } = setup(1);
    expect(wands.add(wandId('fire', 'attack', 1))).toBe(true); // kuşanılır: yer kaplamaz
    expect(carry.usage().wands).toBe(0);
    expect(wands.add(wandId('fire', 'attack', 1), 3)).toBe(true);
    expect(carry.usage().wands).toBe(3);
    expect(wands.add(wandId('fire', 'attack', 1))).toBe(false); // 4. kuşanılmayan sığmaz
    expect(wands.count(wandId('fire', 'attack', 1))).toBe(4);
  });

  it('çantasız 5 aynı asa birleştirilemez, Küçük Çanta ile birleştirilir', () => {
    const { player, wands, carry } = setup(1);
    const a1 = wandId('fire', 'attack', 1);
    wands.add(a1, 4); // 1 kuşanılı + 3 çantada
    expect(wands.add(a1)).toBe(false);
    expect(wands.checkSynthesis(a1).ok).toBe(false);
    player.addItem('kucuk-canta');
    player.equip('kucuk-canta');
    expect(carry.capacity().wands).toBe(6);
    expect(wands.add(a1)).toBe(true);
    expect(wands.synthesize(a1).ok).toBe(true);
    expect(wands.count(wandId('fire', 'attack', 2))).toBe(1);
  });

  it('asa satın alırken yer yoksa altın harcanmaz', () => {
    const { wands } = setup(1);
    const gold = { v: 1000 };
    const api = { balance: () => gold.v, spend: (n: number) => ((gold.v -= n), true) };
    const id = wandId('water', 'attack', 1);
    for (let i = 0; i < 4; i++) expect(buyCommonWand(wands, api, id).ok).toBe(true); // 1 kuşanılı + 3
    const r = buyCommonWand(wands, api, id);
    expect(r).toMatchObject({ ok: false });
    expect(gold.v).toBe(1000 - 4 * 40);
  });

  it('asayı çıkarmak yer ister', () => {
    const { wands } = setup(1);
    wands.add(wandId('air', 'defense', 1), 4); // 1 kuşanılı, 3 çantada (dolu)
    expect(wands.unequip('air', 'defense')).toBe(false);
    expect(wands.equippedFor('air', 'defense')).not.toBeNull();
  });
});

describe('çantalar', () => {
  it('kuşanılan çanta kapasiteyi artırır; çıkarınca kapasite düşer', () => {
    const { player, carry } = setup(1);
    player.addItem('deri-canta');
    player.equip('deri-canta');
    expect(carry.capacity()).toEqual({ wands: 8, goods: 60, gear: 5 });
    expect(carry.usage().gear).toBe(0); // giyilen çanta yer kaplamaz
  });

  it('yeni çanta alınca daha iyisi otomatik kuşanılır, eskisi çantada kalır', () => {
    const { player } = setup(1);
    player.addGold(2000);
    expect(buy(player, merchantOf('kucuk-canta'), 'kucuk-canta').ok).toBe(true);
    expect(player.equipped.bag).toBe('kucuk-canta');
    expect(buy(player, merchantOf('deri-canta'), 'deri-canta').ok).toBe(true);
    expect(player.equipped.bag).toBe('deri-canta');
  });

  it('çantayı çıkarırken içindekiler yeni kapasiteyi aşıyorsa çıkarılamaz', () => {
    const { player } = setup(1);
    player.addItem('kucuk-canta');
    player.equip('kucuk-canta');
    player.addItem('ates-tozu', 30); // 40 kapasitede
    expect(player.unequip('bag')).toBe(false);
    expect(player.lastBlockReason).toContain('sığmıyor');
    expect(player.equipped.bag).toBe('kucuk-canta');
    player.removeItem('ates-tozu', 15);
    expect(player.unequip('bag')).toBe(true);
    expect(player.equipped.bag).toBeUndefined();
  });

  it('küçük çantaya geçmek, içindekiler sığmıyorsa reddedilir', () => {
    const { player } = setup(1);
    player.addItem('gezgin-cantasi');
    player.equip('gezgin-cantasi');
    player.addItem('kucuk-canta'); // çantada ekipman
    player.addItem('ates-tozu', 60);
    expect(player.equip('kucuk-canta')).toBe(false);
    expect(player.equipped.bag).toBe('gezgin-cantasi');
  });

  it('çanta çıkarılınca kendisi "kuşanılabilir" yer kaplar', () => {
    const { player, carry } = setup(1);
    player.addItem('kucuk-canta');
    player.equip('kucuk-canta');
    player.unequip('bag');
    expect(carry.usage().gear).toBe(1);
  });

  it('dolu çantayla alışveriş reddedilir ve altın harcanmaz', () => {
    const { player } = setup(1);
    player.addGold(1000);
    player.addItem('cirak-cuppesi');
    player.addItem('yun-sapka'); // 2/2
    const r = buy(player, merchantOf('tas-tilsim'), 'tas-tilsim');
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
    player.restore({ gold: 0, xp: 0, items: { 'ates-tozu': 50, 'cirak-cuppesi': 1, 'yun-sapka': 1, 'tas-tilsim': 1 }, equipped: {} });
    expect(player.count('ates-tozu')).toBe(50);
    expect(carry.isOverloaded()).toBe(true);
    expect(player.addItem('kurt-postu')).toBe(false); // yeni eşya alınamaz
  });

  it('çanta kuşanılı kaydı geri gelir', () => {
    const { player, carry } = setup(1);
    player.restore({ gold: 0, xp: 0, items: { 'deri-canta': 1 }, equipped: { bag: 'deri-canta' } });
    expect(player.equipped.bag).toBe('deri-canta');
    expect(carry.capacity().wands).toBe(8);
  });
});
