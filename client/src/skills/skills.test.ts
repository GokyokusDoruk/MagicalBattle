import { describe, expect, it } from 'vitest';
import { ELEMENTS } from '../battle/damage/elements';
import { calculateDamage, powerFactor } from '../battle/damage/calculate';
import { runBattle, type BattleIO, type TurnReport } from '../battle/flow/controller';
import { BattleEngine } from '../battle/flow/engine';
import { buildShape } from '../battle/flow/shapes';
import { analyzeStrokes } from '../battle/gesture/analyze';
import { BRANCHES, BRANCH_KINDS, SKILLS, SP_PER_LEVEL, describeStats, getSkill, skillId } from './catalog';
import { LIMITS, SYNERGY, neutralEffects, resolveSpell } from './resolver';
import { RESET_COST_PER_LEVEL, SkillTree } from './tree';

const treeAt = (level: number) => {
  const state = { level };
  return { state, tree: new SkillTree(() => state.level) };
};

/** Bir dalı sırayla sonuna kadar alır */
const learnBranch = (tree: SkillTree, element: (typeof ELEMENTS)[number], kind: (typeof BRANCH_KINDS)[number], upTo = 3) => {
  for (let t = 1; t <= upTo; t++) expect(tree.learn(skillId(element, kind, t as 1 | 2 | 3))).toBe(true);
};

describe('katalog', () => {
  it('4 element x 3 dal x 3 kademe = 36 yetenek, kimlikler benzersiz', () => {
    expect(SKILLS).toHaveLength(36);
    expect(BRANCHES).toHaveLength(12);
    expect(new Set(SKILLS.map((s) => s.id)).size).toBe(36);
    expect(new Set(SKILLS.map((s) => s.name)).size).toBe(36);
  });

  it('bedeller 1, 2, 3 (dal başına 6) ve her yeteneğin en az bir etkisi var', () => {
    for (const s of SKILLS) {
      expect(s.cost).toBe(s.tier);
      expect(Object.values(s.stats).some((v) => (v ?? 0) > 0)).toBe(true);
      expect(describeStats(s.stats).length).toBeGreaterThan(0);
    }
  });

  it('tüm yetenekler toplamı 72 puan; 30. seviye 58 puan verir, yani hepsi alınamaz', () => {
    const all = SKILLS.reduce((n, s) => n + s.cost, 0);
    expect(all).toBe(72);
    expect(SP_PER_LEVEL * 29).toBe(58);
    expect(58).toBeLessThan(all);
  });

  it('element karakteri: ateş en çok hasar, toprak en sağlam kalkan', () => {
    const total = (el: string, key: 'dealt' | 'taken') =>
      SKILLS.filter((s) => s.element === el).reduce((n, s) => n + (s.stats[key] ?? 0), 0);
    expect(total('fire', 'dealt')).toBeGreaterThan(total('earth', 'dealt'));
    expect(total('earth', 'taken')).toBeGreaterThan(total('fire', 'taken'));
  });
});

describe('SkillTree: puan ve alma kuralları', () => {
  it('puan seviyeden gelir: 1. seviye 0, sonrası seviye başına 2', () => {
    const { state, tree } = treeAt(1);
    expect(tree.pointsTotal).toBe(0);
    state.level = 2;
    expect(tree.pointsFree).toBe(2);
    state.level = 10;
    expect(tree.pointsTotal).toBe(18);
  });

  it('puan yetmezse alınmaz, nedeni söylenir', () => {
    const { tree } = treeAt(1);
    const r = tree.check(skillId('fire', 'power', 1));
    expect(r).toEqual({ ok: false, reason: '1 yetenek puanı gerekiyor.' });
    expect(tree.learn(skillId('fire', 'power', 1))).toBe(false);
  });

  it('kademeler sırayla alınır', () => {
    const { tree } = treeAt(30);
    expect(tree.check(skillId('fire', 'power', 2))).toMatchObject({ ok: false });
    expect(tree.learn(skillId('fire', 'power', 3))).toBe(false);
    expect(tree.learn(skillId('fire', 'power', 1))).toBe(true);
    expect(tree.learn(skillId('fire', 'power', 2))).toBe(true);
    expect(tree.rank('fire', 'power')).toBe(2);
    expect(tree.learn(skillId('fire', 'power', 1))).toBe(false); // zaten alınmış
  });

  it('harcanan puan bedellerin toplamıdır', () => {
    const { tree } = treeAt(30);
    learnBranch(tree, 'water', 'ward', 3);
    expect(tree.pointsSpent).toBe(6);
    expect(tree.pointsFree).toBe(58 - 6);
  });

  it('bilinmeyen kimlik alınamaz', () => {
    const { tree } = treeAt(30);
    expect(tree.learn('yok-yok-1')).toBe(false);
    expect(tree.check('yok')).toMatchObject({ ok: false });
  });

  it('sıfırlama puanları geri verir; bedel seviyeye bağlı, hiç yetenek yoksa bedava', () => {
    const { tree } = treeAt(10);
    expect(tree.resetCost).toBe(0);
    learnBranch(tree, 'air', 'precision', 3);
    expect(tree.resetCost).toBe(RESET_COST_PER_LEVEL * 10);
    tree.reset();
    expect(tree.pointsFree).toBe(18);
    expect(tree.snapshot()).toEqual([]);
  });

  it('değişince dinleyicilere haber verir', () => {
    const { tree } = treeAt(5);
    let n = 0;
    tree.onChange(() => n++);
    tree.learn(skillId('fire', 'power', 1));
    tree.reset();
    expect(n).toBe(2);
  });
});

describe('SkillTree: kayıt', () => {
  it('geçerli ağaç bire bir geri yüklenir', () => {
    const { tree } = treeAt(20);
    learnBranch(tree, 'fire', 'power', 3);
    learnBranch(tree, 'earth', 'ward', 2);
    const snap = tree.snapshot();
    const other = treeAt(20).tree;
    other.restore(snap);
    expect(other.snapshot()).toEqual(snap);
    expect(other.pointsSpent).toBe(tree.pointsSpent);
  });

  it('bilinmeyen kimlikler, kademe atlayanlar ve puanı aşanlar atılır', () => {
    const { tree } = treeAt(3); // 4 puan
    tree.restore([
      'sahte-1',
      skillId('fire', 'power', 3), // önceki kademeler yok
      skillId('water', 'ward', 1), // 1
      skillId('water', 'ward', 2), // 2
      skillId('air', 'power', 1), // 1 (toplam 4)
      skillId('air', 'power', 2), // puan yok
    ]);
    expect(tree.snapshot()).toEqual([skillId('water', 'ward', 1), skillId('water', 'ward', 2), skillId('air', 'power', 1)]);
    expect(tree.pointsFree).toBe(0);
  });

  it('undefined ya da boş kayıt ağacı boşaltır', () => {
    const { tree } = treeAt(10);
    tree.learn(skillId('fire', 'power', 1));
    tree.restore(undefined);
    expect(tree.snapshot()).toEqual([]);
  });
});

describe('resolveSpell: tek büyünün sinerjisi', () => {
  const own = (...ids: string[]) => new Set(ids);

  it('yetenek yoksa etkisizdir', () => {
    const fx = resolveSpell(own(), 'fire', 'attack');
    expect(fx).toEqual(neutralEffects('fire', 'attack'));
  });

  it('saldırıda yalnızca Güç ve Hassasiyet dalları, savunmada yalnızca Kalkan dalı işler', () => {
    const all = own(...SKILLS.filter((s) => s.element === 'earth').map((s) => s.id));
    const atk = resolveSpell(all, 'earth', 'attack');
    const def = resolveSpell(all, 'earth', 'defense');
    expect(atk.takenMultiplier).toBe(1);
    expect(atk.reflect).toBe(0);
    expect(def.dealtMultiplier).toBe(1);
    expect(def.armorPierce).toBe(0);
    expect(atk.skills.every((id) => !id.includes('ward'))).toBe(true);
    expect(def.skills.every((id) => id.includes('ward'))).toBe(true);
  });

  it('başka elementin yetenekleri bu büyüyü etkilemez', () => {
    const fireOnly = own(...SKILLS.filter((s) => s.element === 'fire').map((s) => s.id));
    expect(resolveSpell(fireOnly, 'water', 'attack')).toEqual(neutralEffects('water', 'attack'));
    expect(resolveSpell(fireOnly, 'water', 'defense')).toEqual(neutralEffects('water', 'defense'));
  });

  it('bir dalın kademeleri birikir', () => {
    const one = resolveSpell(own(skillId('fire', 'power', 1)), 'fire', 'attack');
    const two = resolveSpell(own(skillId('fire', 'power', 1), skillId('fire', 'power', 2)), 'fire', 'attack');
    expect(two.dealtMultiplier).toBeGreaterThan(one.dealtMultiplier);
    expect(two.effortBonus).toBeGreaterThan(one.effortBonus);
  });

  it('kademe atlanmışsa (bozuk kayıt) boşluktan sonrası sayılmaz', () => {
    const fx = resolveSpell(own(skillId('fire', 'power', 3)), 'fire', 'attack');
    expect(fx.dealtMultiplier).toBe(1);
    expect(fx.skills).toEqual([]);
  });

  it('üç dalın da ilk kademesi varsa temel uyum, hepsi Ustalıktaysa tam uyum', () => {
    const basic = own(...BRANCH_KINDS.map((k) => skillId('air', k, 1)));
    const fxBasic = resolveSpell(basic, 'air', 'attack');
    const airPower1 = getSkill(skillId('air', 'power', 1))!.stats.dealt!;
    expect(fxBasic.synergy).toBe('basic');
    expect(fxBasic.dealtMultiplier).toBeCloseTo(1 + airPower1 + SYNERGY.basic, 6);
    // uyum savunmada alınan hasarı düşürür
    expect(resolveSpell(basic, 'air', 'defense').takenMultiplier).toBeLessThan(1 - getSkill(skillId('air', 'ward', 1))!.stats.taken!);

    const full = own(...SKILLS.filter((s) => s.element === 'air').map((s) => s.id));
    expect(resolveSpell(full, 'air', 'attack').synergy).toBe('full');
    const partial = own(...BRANCH_KINDS.slice(0, 2).map((k) => skillId('air', k, 1)));
    expect(resolveSpell(partial, 'air', 'attack').synergy).toBe('none');
  });

  it('su gücü ustalığı can çalma verir', () => {
    const water = own(...[1, 2, 3].map((t) => skillId('water', 'power', t as 1 | 2 | 3)));
    expect(resolveSpell(water, 'water', 'attack').lifesteal).toBeGreaterThan(0);
    const fire = own(...[1, 2, 3].map((t) => skillId('fire', 'power', t as 1 | 2 | 3)));
    expect(resolveSpell(fire, 'fire', 'attack').lifesteal).toBe(0);
  });

  it('en güçlü kurulumda bile sınırlar aşılmaz', () => {
    for (const el of ELEMENTS) {
      const all = own(...SKILLS.filter((s) => s.element === el).map((s) => s.id));
      const atk = resolveSpell(all, el, 'attack');
      const def = resolveSpell(all, el, 'defense');
      expect(def.takenMultiplier).toBeGreaterThanOrEqual(LIMITS.minTakenMultiplier);
      expect(atk.armorPierce).toBeLessThanOrEqual(LIMITS.maxPierce);
      expect(def.reflect).toBeLessThanOrEqual(LIMITS.maxReflect);
      expect(atk.lifesteal).toBeLessThanOrEqual(LIMITS.maxLifesteal);
      expect(atk.effortBonus).toBeLessThanOrEqual(LIMITS.maxEffort);
      expect(atk.headBonus).toBeLessThanOrEqual(LIMITS.maxHeadBonus);
      expect(atk.dealtMultiplier).toBeLessThan(1.5);
    }
  });

  it('SkillTree.resolve ağaç değişince güncel durumu okur', () => {
    const { tree } = treeAt(10);
    const resolver = tree.resolver;
    expect(resolver('fire', 'attack').dealtMultiplier).toBe(1);
    tree.learn(skillId('fire', 'power', 1));
    expect(resolver('fire', 'attack').dealtMultiplier).toBeGreaterThan(1);
  });
});

describe('hasar hesabına bağlantı', () => {
  const circle = analyzeStrokes(buildShape('circle', 128, 128, 75, 2400));
  const base = { basePower: 100, attack: circle, defense: null, attackerElement: 'fire', defenderElement: 'earth' } as const;

  it('zırh delme zırhı o oranda yok sayar', () => {
    const plain = calculateDamage({ ...base, defenderArmor: 0.4 });
    const pierced = calculateDamage({ ...base, defenderArmor: 0.4, attackerArmorPierce: 0.5 });
    expect(plain.armorReduction).toBeCloseTo(0.4, 6);
    expect(pierced.armorReduction).toBeCloseTo(0.2, 6);
    expect(pierced.finalDamage).toBeGreaterThan(plain.finalDamage);
  });

  it('baş bonusu yalnızca baş çarpanını yükseltir', () => {
    const noBonus = calculateDamage({ ...base });
    const bonus = calculateDamage({ ...base, attackerHeadBonus: 0.2 });
    if (noBonus.headShare > 0) expect(bonus.weightedUnblockedRatio).toBeGreaterThan(noBonus.weightedUnblockedRatio);
    else expect(bonus.weightedUnblockedRatio).toBe(noBonus.weightedUnblockedRatio);
  });

  it('çaba tabanı aceleyle çizilen büyünün gücünü artırır, tam süre çizimi değiştirmez', () => {
    const rushed = analyzeStrokes(buildShape('circle', 128, 128, 75, 300)).metrics;
    const full = analyzeStrokes(buildShape('circle', 128, 128, 75, 2900)).metrics;
    expect(powerFactor(rushed, 0.2).total).toBeGreaterThan(powerFactor(rushed).total);
    expect(Math.abs(powerFactor(full, 0.2).total - powerFactor(full).total)).toBeLessThan(0.02);
    expect(powerFactor(rushed, 5).effort).toBeLessThanOrEqual(1);
  });
});

describe('savaş akışına bağlantı', () => {
  const good = () => analyzeStrokes(buildShape('circle', 128, 128, 75, 2400));
  const none = () => analyzeStrokes([]);

  function run(engine: BattleEngine, defenderDraws: boolean, element: 'fire' | 'water' = 'fire'): Promise<TurnReport> {
    const reports: TurnReport[] = [];
    const stop = new AbortController();
    const io: BattleIO = {
      announceTurn: async () => {},
      chooseElement: async () => element,
      revealRound: async () => {},
      draw: async (_r, role) => (role === 'attack' || defenderDraws ? good() : none()),
      play: async (r) => void (reports.push(r), stop.abort()),
      announceEnd: async () => {},
    };
    return runBattle(engine, io, { signal: stop.signal }).then(() => reports[0]);
  }

  const withTree = (_element: 'fire' | 'water', ids: string[], level = 30) => {
    const tree = new SkillTree(() => level);
    tree.restore(ids);
    return tree;
  };

  it('verilen hasar yetenekleri çarpar (savunmasız vuruş)', async () => {
    const plain = await run(new BattleEngine([{ name: 'A', team: 0, control: 'bot' }, { name: 'B', team: 1, control: 'bot' }]), false);
    const tree = withTree('fire', SKILLS.filter((s) => s.element === 'fire' && s.branch === 'power').map((s) => s.id));
    const boosted = await run(
      new BattleEngine([{ name: 'A', team: 0, control: 'bot', spells: tree.resolver }, { name: 'B', team: 1, control: 'bot' }]),
      false,
    );
    expect(boosted.damage).toBeGreaterThan(plain.damage);
  });

  it('savunanın kalkan yeteneği hasarı azaltır', async () => {
    const plain = await run(new BattleEngine([{ name: 'A', team: 0, control: 'bot' }, { name: 'B', team: 1, control: 'bot' }]), false);
    const tree = withTree('fire', SKILLS.filter((s) => s.element === 'fire' && s.branch === 'ward').map((s) => s.id));
    const guarded = await run(
      new BattleEngine([{ name: 'A', team: 0, control: 'bot' }, { name: 'B', team: 1, control: 'bot', spells: tree.resolver }]),
      false,
    );
    expect(guarded.damage).toBeLessThan(plain.damage);
  });

  it('yansıma saldırana hasar verir, can çalma saldıranı iyileştirir', async () => {
    const ward = withTree('fire', SKILLS.filter((s) => s.element === 'fire' && s.branch === 'ward').map((s) => s.id));
    const engine = new BattleEngine([{ name: 'A', team: 0, control: 'bot' }, { name: 'B', team: 1, control: 'bot', spells: ward.resolver }]);
    const r = await run(engine, false);
    expect(r.reflected).toBeGreaterThan(0);
    expect(engine.fighter({ team: 0, index: 0 }).hp).toBe(300 - r.reflected);

    const power = withTree('water', SKILLS.filter((s) => s.element === 'water' && s.branch === 'power').map((s) => s.id));
    const e2 = new BattleEngine([{ name: 'A', team: 0, control: 'bot', spells: power.resolver }, { name: 'B', team: 1, control: 'bot' }]);
    e2.applyDamage({ team: 0, index: 0 }, 100); // can çalma için yer aç
    // ateşle atılırsa su yetenekleri etkisiz, can çalma yok
    expect((await run(e2, false, 'fire')).healed).toBe(0);

    // suyla atılırsa verdiği hasarın bir kısmı canına döner
    const e3 = new BattleEngine([{ name: 'A', team: 0, control: 'bot', spells: power.resolver }, { name: 'B', team: 1, control: 'bot' }]);
    e3.applyDamage({ team: 0, index: 0 }, 100);
    const r3 = await run(e3, false, 'water');
    expect(r3.healed).toBe(Math.round(r3.damage * 0.08));
    expect(r3.healed).toBeGreaterThan(0);
    expect(e3.fighter({ team: 0, index: 0 }).hp).toBe(200 + r3.healed);
  });

  it('can çalma azami canı aşmaz', () => {
    const e = new BattleEngine([{ name: 'A', team: 0, control: 'bot' }, { name: 'B', team: 1, control: 'bot' }]);
    e.applyDamage({ team: 0, index: 0 }, 10);
    expect(e.heal({ team: 0, index: 0 }, 50)).toBe(10);
    expect(e.fighter({ team: 0, index: 0 }).hp).toBe(300);
    e.applyDamage({ team: 0, index: 0 }, 300);
    expect(e.heal({ team: 0, index: 0 }, 50)).toBe(0); // ölü iyileşmez
  });

  it('yetenek yoksa hiçbir şey değişmez (yansıma ve can çalma 0)', async () => {
    const r = await run(new BattleEngine([{ name: 'A', team: 0, control: 'bot' }, { name: 'B', team: 1, control: 'bot' }]), false);
    expect(r.reflected).toBe(0);
    expect(r.healed).toBe(0);
    expect(r.attackerDefeated).toBe(false);
  });
});
