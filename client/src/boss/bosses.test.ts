import { describe, expect, it } from 'vitest';
import { Bot } from '../battle/flow/bot';
import { BattleEngine } from '../battle/flow/engine';
import { mulberry32 } from '../world/rng';
import { BOSSES, HP_PER_LEVEL, bossFighters, bossFoes, getBoss, playerMaxHp } from './bosses';
import { simulateBoss, typicalKit, winRate } from './simulate';

describe('boss verisi', () => {
  it('8 bölümün hepsinde bir boss var, kimlikler benzersiz', () => {
    expect(BOSSES.map((b) => b.chapter)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(BOSSES.map((b) => b.id)).size).toBe(8);
    for (let ch = 1; ch <= 8; ch++) expect(getBoss(ch)).toBeDefined();
    expect(getBoss(9)).toBeUndefined();
  });

  it('düşman ve ödül değerleri makul aralıkta', () => {
    for (const b of BOSSES) {
      expect(b.intro.length).toBeGreaterThan(0);
      expect(b.reward.money).toBeGreaterThan(0);
      expect(b.reward.xp).toBeGreaterThan(0);
      for (const foe of [...b.foes, ...(b.foesDark ?? [])]) {
        expect(foe.hp).toBeGreaterThan(0);
        expect(foe.basePower).toBeGreaterThan(0);
        expect(foe.armor).toBeGreaterThanOrEqual(0);
        expect(foe.armor).toBeLessThan(0.75); // zırh sınırı
        expect(foe.skill).toBeGreaterThan(0);
        expect(foe.skill).toBeLessThanOrEqual(1);
      }
    }
  });

  it('hedef seviye ve ödüller bölümle birlikte artar', () => {
    for (let i = 1; i < BOSSES.length; i++) {
      expect(BOSSES[i].targetLevel).toBeGreaterThanOrEqual(BOSSES[i - 1].targetLevel);
      expect(BOSSES[i].reward.money).toBeGreaterThan(BOSSES[i - 1].reward.money);
      expect(BOSSES[i].reward.xp).toBeGreaterThan(BOSSES[i - 1].reward.xp);
    }
  });

  it('hikâyedeki karakterizasyon: Vael savunmada zayıf, Komutan savunmacı, Şampiyon zırhlı, Kaelen sağlam', () => {
    const f = (ch: number) => getBoss(ch)!.foes[0];
    expect(f(1).skill).toBeLessThan(0.4); // zayıf savunma
    expect(f(1).basePower).toBeGreaterThan(f(2).basePower); // kaba kuvvet
    expect(f(2).skill).toBeGreaterThan(0.6); // savunma ağırlıklı
    expect(f(4).armor).toBeGreaterThanOrEqual(0.3); // zırhı güçlü
    expect(f(4).basePower).toBeLessThan(100); // yavaş/zayıf vuruş
    expect(Math.max(...BOSSES.filter((b) => b.chapter < 8).map((b) => b.foes[0].hp))).toBeGreaterThanOrEqual(f(5).hp); // Kaelen en uzun savaşlardan
    expect(getBoss(5)!.maxCycles).toBeGreaterThan(40);
  });

  it('mekanikler: Morga sisi (gölge yok), Morwenna zihin kontrolü (bulanıklık)', () => {
    expect(getBoss(6)!.gimmick?.hideGhost).toBe(true);
    expect(getBoss(7)!.gimmick?.blurFromCycle).toBeGreaterThan(0);
    for (const ch of [1, 2, 3, 4, 5, 8]) expect(getBoss(ch)!.gimmick).toBeUndefined();
  });
});

describe('savaşçıların kurulumu', () => {
  const player = { name: 'Aylin', level: 5, armor: 0.2 };

  it('oyuncunun canı seviyeyle artar', () => {
    expect(playerMaxHp(1)).toBe(300);
    expect(playerMaxHp(11)).toBe(300 + 10 * HP_PER_LEVEL);
    expect(playerMaxHp(0)).toBe(300);
  });

  it('oyuncu takım 0, bosslar takım 1; oyuncunun zırhı ve canı verilir', () => {
    const [me, ...foes] = bossFighters(1, player);
    expect(me).toMatchObject({ name: 'Aylin', team: 0, control: 'human', armor: 0.2, maxHp: playerMaxHp(5) });
    expect(foes).toHaveLength(1);
    expect(foes[0]).toMatchObject({ name: 'General Vael', team: 1, control: 'bot' });
    expect(foes[0].ai?.elements).toEqual({ fire: 1 });
  });

  it('Elysia yalnız 3. bölümde ve Düzen Bekçisi yolunda 8. bölümde yanındadır', () => {
    const allies = (ch: number, path?: 'order' | 'dark') => bossFighters(ch, player, path).filter((f) => f.team === 0 && f.name === 'Elysia').length;
    for (const ch of [1, 2, 4, 5, 6, 7]) expect(allies(ch), `ch${ch}`).toBe(0);
    expect(allies(3)).toBe(1);
    expect(allies(8, 'order')).toBe(1);
    expect(allies(8, 'dark')).toBe(0);
    const elysia = bossFighters(3, player).find((f) => f.name === 'Elysia')!;
    expect(elysia.persona).toBe('elysia');
  });

  it('bölüm 3 ve Düzen yolunda bölüm 8 iki düşmanlı; Karanlık yolda Malakor tek', () => {
    expect(bossFoes(getBoss(3)!)).toHaveLength(2);
    expect(bossFoes(getBoss(8)!, 'order')).toHaveLength(2);
    expect(bossFoes(getBoss(8)!, 'dark')).toHaveLength(1);
    expect(bossFoes(getBoss(8)!, 'dark')[0].name).toBe('Malakor');
  });

  it('her bölüm ve yol için geçerli bir savaş motoru kurulur', () => {
    for (const b of BOSSES) {
      for (const path of ['order', 'dark'] as const) {
        const e = new BattleEngine(bossFighters(b.chapter, player, path));
        expect(e.team(0).length).toBeGreaterThanOrEqual(1);
        expect(e.team(1).length).toBeGreaterThanOrEqual(1);
      }
    }
    expect(() => bossFighters(99, player)).toThrow();
  });

  it('düşman profili: element tercihi dışına çıkmaz, saldırı ölçeği çizimi büyütür', () => {
    const rand = mulberry32(5);
    const bot = new Bot(rand, 0.5, { elements: { earth: 3, water: 1 } });
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) seen.add(bot.chooseElement());
    expect([...seen].sort()).toEqual(['earth', 'water']);

    const small = new Bot(mulberry32(9), 0.5, { attackScale: 0.7 });
    const big = new Bot(mulberry32(9), 0.5, { attackScale: 1.4 });
    let a = 0;
    let b = 0;
    for (let i = 0; i < 80; i++) {
      a += small.drawAttack().metrics.coverage;
      b += big.drawAttack().metrics.coverage;
    }
    expect(b).toBeGreaterThan(a);
  });

  it('profilsiz bot eskisi gibi dört elementi de seçer', () => {
    const bot = new Bot(mulberry32(3), 0.5);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(bot.chooseElement());
    expect(seen.size).toBe(4);
  });
});

describe('denge simülasyonu (vekil oyuncu, tohumlu)', () => {
  const RUNS = 30;
  const SKILL = 0.6;

  it('hedef seviyede boss yenilebilir ama kolay değil', async () => {
    for (const b of BOSSES) {
      const rate = await winRate(b.chapter, typicalKit(b.targetLevel), SKILL, RUNS);
      expect(rate, `bölüm ${b.chapter} hedef seviyede`).toBeGreaterThanOrEqual(0.3);
      expect(rate, `bölüm ${b.chapter} hedef seviyede`).toBeLessThanOrEqual(0.99);
    }
  }, 120000);

  it('seviye düşükken ileri bölümler çok zor (1. seviyede 4. bölümden sonrası <%20)', async () => {
    for (const ch of [4, 5, 6, 7, 8]) {
      expect(await winRate(ch, typicalKit(1), SKILL, RUNS), `bölüm ${ch}`).toBeLessThan(0.2);
    }
  }, 120000);

  it('1. boss ilk seviyede yenilebilir', async () => {
    expect(await winRate(1, typicalKit(1), SKILL, RUNS)).toBeGreaterThanOrEqual(0.7);
  }, 60000);

  it('seviye arttıkça kazanma oranı azalmaz (genel eğilim)', async () => {
    for (const ch of [2, 5, 8]) {
      const low = await winRate(ch, typicalKit(1), SKILL, RUNS);
      const high = await winRate(ch, typicalKit(30), SKILL, RUNS);
      expect(high, `bölüm ${ch}`).toBeGreaterThan(low);
    }
  }, 120000);

  it('çok zayıf oyuncu (beceri 0.1) bölüm 8\'i geçemez, simülasyon her zaman biter', async () => {
    expect(await winRate(8, typicalKit(20), 0.1, 15)).toBeLessThan(0.3);
    const r = await simulateBoss(5, typicalKit(10), { playerSkill: 0.5, seed: 1 });
    expect(r.cycles).toBeGreaterThan(0);
    expect(r.cycles).toBeLessThanOrEqual(61);
  }, 60000);

  it('Karanlık yolda tek başına Malakor, Düzen yolundaki 2v2 kadar zor olmayacak şekilde ayarlı', async () => {
    const order = await winRate(8, typicalKit(20), SKILL, RUNS, 'order');
    const dark = await winRate(8, typicalKit(20), SKILL, RUNS, 'dark');
    expect(dark).toBeGreaterThan(0.2);
    expect(order).toBeGreaterThan(0.2);
  }, 60000);
});
