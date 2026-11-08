import { describe, expect, it } from 'vitest';
import { ELEMENTS } from '../battle/damage/elements';
import { runBattle, type BattleIO, type TurnReport } from '../battle/flow/controller';
import { BattleEngine } from '../battle/flow/engine';
import { buildShape } from '../battle/flow/shapes';
import { analyzeStrokes } from '../battle/gesture/analyze';
import {
  COMMON_WAND_PRICE,
  MAX_WAND_STACK,
  RARITIES,
  ROLES,
  SLOT_KEYS,
  SYNTHESIS_COUNT,
  WANDS,
  describeWand,
  getWand,
  wandId,
} from './catalog';
import { WandInventory, buyCommonWand } from './inventory';

const id = (e: (typeof ELEMENTS)[number], r: (typeof ROLES)[number], n: 1 | 2 | 3 | 4 | 5 | 6) => wandId(e, r, n);

describe('katalog', () => {
  it('6 nadirlik × 4 element × 2 rol = 48 asa; kimlik ve ad benzersiz', () => {
    expect(WANDS).toHaveLength(48);
    expect(RARITIES.length * ELEMENTS.length * ROLES.length).toBe(48);
    expect(new Set(WANDS.map((w) => w.id)).size).toBe(48);
    expect(new Set(WANDS.map((w) => w.name)).size).toBe(48);
    expect(SLOT_KEYS).toHaveLength(8);
  });

  it('nadirlik arttıkça saldırı gücü artar, savunmada alınan hasar azalır; Sıradan etkisizdir', () => {
    const atk = (n: 1 | 2 | 3 | 4 | 5 | 6) => getWand(id('fire', 'attack', n))!.powerMultiplier;
    const def = (n: 1 | 2 | 3 | 4 | 5 | 6) => getWand(id('fire', 'defense', n))!.takenMultiplier;
    expect(atk(1)).toBe(1);
    expect(def(1)).toBe(1);
    for (let n = 2; n <= 6; n++) {
      expect(atk(n as 2)).toBeGreaterThan(atk((n - 1) as 1));
      expect(def(n as 2)).toBeLessThan(def((n - 1) as 1));
    }
    expect(atk(6)).toBeCloseTo(1.75, 6);
    expect(def(6)).toBeCloseTo(0.8, 6);
  });

  it('saldırı asası savunmayı, savunma asası saldırıyı değiştirmez', () => {
    for (const w of WANDS) {
      if (w.role === 'attack') expect(w.takenMultiplier).toBe(1);
      else expect(w.powerMultiplier).toBe(1);
      expect(describeWand(w).length).toBeGreaterThan(0);
    }
  });
});

describe('WandInventory: ekleme ve kuşanma', () => {
  it('asa eklenir; bilinmeyen eklenmez', () => {
    const inv = new WandInventory();
    expect(inv.add(id('fire', 'attack', 1), 3)).toBe(true);
    expect(inv.count(id('fire', 'attack', 1))).toBe(3);
    expect(inv.add('yok-yok', 1)).toBe(false);
    expect(inv.add(id('fire', 'attack', 1), 0)).toBe(false);
  });

  it('boş yuvaya eklenen asa kendiliğinden kuşanılır; düşük nadirlik yüksek olanın yerine geçmez', () => {
    const inv = new WandInventory();
    inv.add(id('water', 'attack', 3));
    expect(inv.equippedFor('water', 'attack')).toBe(id('water', 'attack', 3));
    inv.add(id('water', 'attack', 1));
    expect(inv.equippedFor('water', 'attack')).toBe(id('water', 'attack', 3));
    inv.add(id('water', 'attack', 4));
    expect(inv.equippedFor('water', 'attack')).toBe(id('water', 'attack', 4));
  });

  it('elle kuşanma sahip olunan asayla çalışır; çıkarınca yuva boşalır', () => {
    const inv = new WandInventory();
    inv.add(id('air', 'defense', 5));
    inv.add(id('air', 'defense', 2));
    expect(inv.equip(id('air', 'defense', 2))).toBe(true);
    expect(inv.equippedFor('air', 'defense')).toBe(id('air', 'defense', 2));
    expect(inv.equip(id('air', 'defense', 3))).toBe(false); // sahip değil
    inv.unequip('air', 'defense');
    expect(inv.equippedFor('air', 'defense')).toBeNull();
  });

  it('yığın sınırı aşılmaz', () => {
    const inv = new WandInventory();
    inv.add(id('earth', 'attack', 1), 2000);
    expect(inv.count(id('earth', 'attack', 1))).toBe(MAX_WAND_STACK);
  });

  it('değişince dinleyicilere haber verir', () => {
    const inv = new WandInventory();
    let n = 0;
    inv.onChange(() => n++);
    inv.add(id('fire', 'attack', 1));
    inv.unequip('fire', 'attack');
    expect(n).toBe(2);
  });
});

describe('WandInventory: 5 → 1 birleştirme', () => {
  const a1 = id('fire', 'attack', 1);

  it('5 aynı asa bir üst nadirlikte 1 asa olur', () => {
    const inv = new WandInventory();
    inv.add(a1, 7);
    const r = inv.synthesize(a1);
    expect(r).toEqual({ ok: true, result: id('fire', 'attack', 2) });
    expect(inv.count(a1)).toBe(2);
    expect(inv.count(id('fire', 'attack', 2))).toBe(1);
    expect(inv.equippedFor('fire', 'attack')).toBe(id('fire', 'attack', 2)); // daha yükseği kuşanılır
  });

  it('5\'ten azıyla birleştirilmez, hiçbir şey değişmez', () => {
    const inv = new WandInventory();
    inv.add(a1, SYNTHESIS_COUNT - 1);
    const r = inv.synthesize(a1);
    expect(r.ok).toBe(false);
    expect(inv.count(a1)).toBe(4);
    expect(inv.owned()).toHaveLength(1);
  });

  it('kuşanılı asa tükenirse yuva boşalır, sonuç kuşanılır', () => {
    const inv = new WandInventory();
    inv.add(a1, 5);
    expect(inv.equippedFor('fire', 'attack')).toBe(a1);
    inv.synthesize(a1);
    expect(inv.count(a1)).toBe(0);
    expect(inv.equippedFor('fire', 'attack')).toBe(id('fire', 'attack', 2));
  });

  it('en yüksek nadirlik (Mistik) birleştirilemez', () => {
    const inv = new WandInventory();
    inv.add(id('fire', 'attack', 6), 9);
    expect(inv.synthesize(id('fire', 'attack', 6)).ok).toBe(false);
  });

  it('Sıradan asadan Mistik\'e zincirleme: 5^5 = 3125 asa', () => {
    // 5 → 1 beş kez: 1. nadirlikten 6.'ya 3125 asa gerekir; kademeleri doğrudan besleyerek doğrula
    const inv = new WandInventory();
    for (let n = 1; n <= 5; n++) inv.add(id('water', 'defense', n as 1), SYNTHESIS_COUNT);
    for (let n = 1; n <= 5; n++) expect(inv.synthesize(id('water', 'defense', n as 1)).ok, `n=${n}`).toBe(true);
    expect(inv.count(id('water', 'defense', 6))).toBe(1);
  });

  it('sonuç yığını doluysa birleştirme reddedilir ve hiçbir şey kaybolmaz', () => {
    const inv = new WandInventory();
    inv.add(a1, 5);
    inv.add(id('fire', 'attack', 2), MAX_WAND_STACK);
    const r = inv.synthesize(a1);
    expect(r).toMatchObject({ ok: false });
    expect(inv.count(a1)).toBe(5);
  });

  it('farklı element ya da rol birleştirmeye karışmaz', () => {
    const inv = new WandInventory();
    inv.add(id('fire', 'attack', 1), 3);
    inv.add(id('fire', 'defense', 1), 2);
    inv.add(id('water', 'attack', 1), 4);
    for (const w of inv.owned()) expect(inv.synthesize(w.id).ok).toBe(false);
  });
});

describe('WandInventory: etki ve kayıt', () => {
  it('asa yoksa etkisiz; kuşanılı asa çarpanını verir', () => {
    const inv = new WandInventory();
    expect(inv.effects('fire', 'attack')).toEqual({ powerMultiplier: 1, takenMultiplier: 1, wandId: null });
    inv.add(id('fire', 'attack', 4));
    expect(inv.effects('fire', 'attack').powerMultiplier).toBeCloseTo(1.45, 6);
    expect(inv.effects('water', 'attack').powerMultiplier).toBe(1); // başka element
    expect(inv.effects('fire', 'defense').takenMultiplier).toBe(1); // başka rol
  });

  it('çözücü envanter değişince güncel durumu okur', () => {
    const inv = new WandInventory();
    const r = inv.resolver;
    expect(r('earth', 'defense').takenMultiplier).toBe(1);
    inv.add(id('earth', 'defense', 6));
    expect(r('earth', 'defense').takenMultiplier).toBeCloseTo(0.8, 6);
  });

  it('kayıt bire bir geri yüklenir', () => {
    const inv = new WandInventory();
    inv.add(id('fire', 'attack', 3), 2);
    inv.add(id('air', 'defense', 1), 7);
    const snap = inv.snapshot();
    const other = new WandInventory();
    other.restore(snap);
    expect(other.snapshot()).toEqual(snap);
  });

  it('bozuk kayıt temizlenir: bilinmeyen asa, hatalı sayı, sahip olunmayan ya da yanlış yuvadaki kuşanma atılır', () => {
    const inv = new WandInventory();
    inv.restore({
      wands: { [id('fire', 'attack', 2)]: 1, [id('water', 'attack', 1)]: 2.9, sahte: 5, [id('air', 'attack', 1)]: -3, [id('earth', 'defense', 1)]: 99999 },
      wandsEquipped: {
        'fire-attack': id('fire', 'attack', 2),
        'water-attack': id('fire', 'attack', 2), // yanlış yuva
        'earth-attack': id('earth', 'attack', 1), // sahip değil
        'air-attack': id('air', 'attack', 1), // adet 0
      },
    });
    expect(inv.count('sahte')).toBe(0);
    expect(inv.count(id('water', 'attack', 1))).toBe(2);
    expect(inv.count(id('air', 'attack', 1))).toBe(0);
    expect(inv.count(id('earth', 'defense', 1))).toBe(MAX_WAND_STACK);
    expect(inv.equipped).toEqual({ 'fire-attack': id('fire', 'attack', 2) });
    inv.restore(undefined);
    expect(inv.owned()).toEqual([]);
  });
});

describe('tüccardan asa alma', () => {
  const wallet = (gold: number) => {
    const w = { gold };
    return { w, api: { balance: () => w.gold, spend: (n: number) => (n <= w.gold ? ((w.gold -= n), true) : false) } };
  };

  it('Sıradan asayı altınla alır', () => {
    const inv = new WandInventory();
    const { w, api } = wallet(100);
    const r = buyCommonWand(inv, api, id('fire', 'attack', 1));
    expect(r).toEqual({ ok: true, price: COMMON_WAND_PRICE });
    expect(w.gold).toBe(100 - COMMON_WAND_PRICE);
    expect(inv.count(id('fire', 'attack', 1))).toBe(1);
  });

  it('altın yetmezse ya da asa Sıradan değilse reddeder', () => {
    const inv = new WandInventory();
    const { w, api } = wallet(10);
    expect(buyCommonWand(inv, api, id('fire', 'attack', 1)).ok).toBe(false);
    expect(buyCommonWand(inv, wallet(9999).api, id('fire', 'attack', 2)).ok).toBe(false);
    expect(buyCommonWand(inv, wallet(9999).api, 'sahte').ok).toBe(false);
    expect(w.gold).toBe(10);
    expect(inv.owned()).toEqual([]);
  });

  it('fiyat çarpanı uygulanır', () => {
    const inv = new WandInventory();
    const { api } = wallet(1000);
    expect(buyCommonWand(inv, api, id('air', 'defense', 1), 1.5)).toEqual({ ok: true, price: 60 });
  });
});

describe('savaş akışına bağlantı', () => {
  const good = () => analyzeStrokes(buildShape('circle', 128, 128, 75, 2400));
  const none = () => analyzeStrokes([]);

  function run(engine: BattleEngine, element: 'fire' | 'water' = 'fire'): Promise<TurnReport> {
    const reports: TurnReport[] = [];
    const stop = new AbortController();
    const io: BattleIO = {
      announceTurn: async () => {},
      chooseElement: async () => element,
      revealElements: async () => {},
      draw: async (_r, role) => (role === 'attack' ? good() : none()),
      play: async (r) => void (reports.push(r), stop.abort()),
      announceEnd: async () => {},
    };
    return runBattle(engine, io, { signal: stop.signal }).then(() => reports[0]);
  }
  const duel = (a: object = {}, b: object = {}) =>
    new BattleEngine([{ name: 'A', team: 0, control: 'bot', ...a }, { name: 'B', team: 1, control: 'bot', ...b }]);

  it('saldırı asası o elementin büyüsünün gücünü artırır', async () => {
    const plain = await run(duel());
    const inv = new WandInventory();
    inv.add(id('fire', 'attack', 6));
    const boosted = await run(duel({ wands: inv.resolver }));
    expect(boosted.damage).toBeGreaterThan(plain.damage);
    expect(boosted.damage / plain.damage).toBeCloseTo(1.75, 1);
  });

  it('asa yalnızca kendi elementinde işler', async () => {
    const plain = await run(duel(), 'water');
    const inv = new WandInventory();
    inv.add(id('fire', 'attack', 6));
    const other = await run(duel({ wands: inv.resolver }), 'water');
    expect(other.damage).toBe(plain.damage);
  });

  it('savunma asası alınan hasarı azaltır', async () => {
    const plain = await run(duel());
    const inv = new WandInventory();
    inv.add(id('fire', 'defense', 6));
    const guarded = await run(duel({}, { wands: inv.resolver }));
    expect(guarded.damage).toBeLessThan(plain.damage);
    expect(guarded.damage / plain.damage).toBeCloseTo(0.8, 1);
  });

  it('asasız savaşçı eskisi gibi çalışır (Sıradan asa da etkisiz)', async () => {
    const plain = await run(duel());
    const inv = new WandInventory();
    inv.add(id('fire', 'attack', 1));
    expect((await run(duel({ wands: inv.resolver }))).damage).toBe(plain.damage);
  });
});
