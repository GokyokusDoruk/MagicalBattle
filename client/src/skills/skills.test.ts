import { describe, expect, it } from 'vitest';
import { calculateDamage } from '../battle/damage/calculate';
import { runBattle, SCAR_PENALTY_SEC, type BattleIO, type DrawExtras, type TurnReport } from '../battle/flow/controller';
import { BattleEngine, type BurnEvent } from '../battle/flow/engine';
import { buildShape } from '../battle/flow/shapes';
import { analyzeStrokes } from '../battle/gesture/analyze';
import { CARRY_SKILLS, MAX_SKILL_LEVEL, SKILLS, SP_PER_LEVEL, describeEffect, effectAt, getSkill, skillsOf } from './catalog';
import { LIMITS, SHIELD_BREAK_STRENGTH, neutralEffects, resolvePassives, resolveSpell } from './resolver';
import { RESET_COST_PER_LEVEL, SkillTree } from './tree';

const treeAt = (level: number) => {
  const state = { level };
  return { state, tree: new SkillTree(() => state.level) };
};

/** Bir yeteneği verilen seviyeye kadar alır */
const learnTo = (tree: SkillTree, id: string, level: number) => {
  for (let i = 0; i < level; i++) expect(tree.learn(id)).toBe(true);
};

const learnAllFire = (tree: SkillTree) => {
  for (const s of skillsOf('fire').filter((x) => !x.passive)) learnTo(tree, s.id, 3);
};

describe('katalog', () => {
  it('ateşin 5 yeteneği var, kimlikler ve adlar benzersiz, her birinin 3 seviyesi var', () => {
    expect(skillsOf('fire')).toHaveLength(5);
    expect(new Set(SKILLS.map((s) => s.id)).size).toBe(SKILLS.length);
    expect(new Set(SKILLS.map((s) => s.name)).size).toBe(SKILLS.length);
    for (const s of SKILLS) expect(s.levels).toHaveLength(MAX_SKILL_LEVEL);
  });

  it('eski yetenek adları kalktı; ateşin yeni adları var', () => {
    expect(skillsOf('fire').map((s) => s.name)).toEqual(['Közleyen Alev', 'Kalkan Kıran', 'Alev Zinciri', 'Kıvılcım Saçması', 'Yanık İzi']);
    expect(getSkill('fire-power-1')).toBeUndefined();
  });

  it('seviyeler yükseldikçe etki güçlenir ve her seviyenin açıklaması var', () => {
    for (const s of SKILLS) {
      for (const key of Object.keys(s.levels[0]) as (keyof (typeof s.levels)[0])[]) {
        const values = s.levels.map((l) => l[key] ?? 0);
        expect(values[1]).toBeGreaterThan(values[0]);
        expect(values[2]).toBeGreaterThan(values[1]);
      }
      for (const l of s.levels) expect(describeEffect(l).length).toBeGreaterThan(0);
    }
  });

  it('tam yetenek 3 puan; puanla alınan ateş yetenekleri 12 puan (Yanık İzi hariç); taşıyıcı dalı 6 puan', () => {
    expect(skillsOf('fire').filter((s) => !s.passive).length * MAX_SKILL_LEVEL).toBe(12);
    expect(CARRY_SKILLS.reduce((n, s) => n + s.cost, 0)).toBe(6);
  });

  it('Yanık İzi pasiftir ve puanla alınmaz; yara izi sayısı 1-2-3 (asa seviyesine göre)', () => {
    const scars = getSkill('fire-scars')!;
    expect(scars.passive).toBe(true);
    expect([1, 2, 3].map((l) => effectAt(scars, l).scars)).toEqual([1, 2, 3]);
  });
});

describe('SkillTree: puan ve alma kuralları', () => {
  it('puan seviyeden gelir: 1. seviye 0, sonrası seviye başına 2; 30. seviyede 58', () => {
    const { state, tree } = treeAt(1);
    expect(tree.pointsTotal).toBe(0);
    state.level = 2;
    expect(tree.pointsFree).toBe(2);
    state.level = 30;
    expect(tree.pointsTotal).toBe(58);
    expect(SP_PER_LEVEL * 29).toBe(58);
  });

  it('açmak ve her seviye 1 puandır; en çok 3 seviye', () => {
    const { tree } = treeAt(10);
    expect(tree.learn('fire-burn')).toBe(true);
    expect(tree.level('fire-burn')).toBe(1);
    expect(tree.pointsSpent).toBe(1);
    expect(tree.learn('fire-burn')).toBe(true);
    expect(tree.learn('fire-burn')).toBe(true);
    expect(tree.level('fire-burn')).toBe(3);
    expect(tree.pointsSpent).toBe(3);
    const again = tree.check('fire-burn');
    expect(again.ok).toBe(false);
    expect(tree.learn('fire-burn')).toBe(false);
    expect(tree.level('fire-burn')).toBe(3);
  });

  it('puan yetmezse alınmaz, nedeni söylenir', () => {
    const { tree } = treeAt(1);
    const c = tree.check('fire-burn');
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.reason).toMatch(/puan/);
    expect(tree.learn('fire-burn')).toBe(false);
  });

  it('ateşin puanla alınan yeteneklerinin hepsi 12 puandır; Yanık İzi puanla alınamaz', () => {
    const { tree } = treeAt(30);
    learnAllFire(tree);
    expect(tree.pointsSpent).toBe(12);
    expect(tree.pointsFree).toBe(58 - 12);
    const c = tree.check('fire-scars');
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.reason).toMatch(/asa/);
    expect(tree.learn('fire-scars')).toBe(false);
    expect(tree.level('fire-scars')).toBe(0);
  });

  it('taşıyıcı kademeleri sırayla alınır ve puana eklenir', () => {
    const { tree } = treeAt(10);
    expect(tree.learn('carry-2')).toBe(false);
    expect(tree.learn('carry-1')).toBe(true);
    expect(tree.learn('carry-2')).toBe(true);
    expect(tree.pointsSpent).toBe(3);
    expect(tree.carryBonus.wands).toBe(2);
  });

  it('bilinmeyen kimlik alınamaz', () => {
    const { tree } = treeAt(30);
    expect(tree.learn('nope')).toBe(false);
    expect(tree.learn('fire-power-1')).toBe(false);
  });

  it('sıfırlama puanları geri verir; bedel seviyeye bağlı, hiç yetenek yoksa bedava', () => {
    const { tree } = treeAt(10);
    expect(tree.resetCost).toBe(0);
    learnTo(tree, 'fire-chain', 2);
    expect(tree.resetCost).toBe(RESET_COST_PER_LEVEL * 10);
    tree.reset();
    expect(tree.pointsFree).toBe(18);
    expect(tree.level('fire-chain')).toBe(0);
    expect(tree.resetCost).toBe(0);
  });

  it('değişince dinleyicilere haber verir', () => {
    const { tree } = treeAt(5);
    let calls = 0;
    tree.onChange(() => calls++);
    tree.learn('fire-burn');
    tree.reset();
    expect(calls).toBe(2);
  });
});

describe('SkillTree: kayıt', () => {
  it('geçerli ağaç bire bir geri yüklenir; kimlikler "<yetenek>-<seviye>"', () => {
    const { tree } = treeAt(30);
    learnTo(tree, 'fire-burn', 2);
    learnTo(tree, 'fire-chain', 3);
    tree.learn('carry-1');
    expect(tree.snapshot()).toEqual(['fire-burn-2', 'fire-chain-3', 'carry-1']);
    const fresh = treeAt(30).tree;
    fresh.restore(tree.snapshot());
    expect(fresh.snapshot()).toEqual(tree.snapshot());
    expect(fresh.pointsSpent).toBe(tree.pointsSpent);
  });

  it('eski kayıttaki yetenekler atılır, puanları iade olur; taşıyıcı korunur', () => {
    const { tree } = treeAt(10);
    tree.restore(['fire-power-1', 'fire-power-2', 'water-ward-3', 'carry-1']);
    expect(tree.levels.size).toBe(0);
    expect(tree.has('carry-1')).toBe(true);
    expect(tree.pointsSpent).toBe(1);
    expect(tree.pointsFree).toBe(18 - 1);
  });

  it('puanı aşan seviyeler atılır, geçersiz seviye sayıları yok sayılır', () => {
    const { tree } = treeAt(3); // 4 puan
    tree.restore(['fire-burn-3', 'fire-chain-3', 'fire-breaker-9', 'fire-scatter-0']);
    expect(tree.pointsSpent).toBeLessThanOrEqual(4);
    expect(tree.level('fire-breaker')).toBe(0);
    expect(tree.level('fire-scatter')).toBe(0);
  });

  it('undefined ya da boş kayıt ağacı boşaltır', () => {
    const { tree } = treeAt(10);
    learnTo(tree, 'fire-burn', 1);
    tree.restore(undefined);
    expect(tree.pointsSpent).toBe(0);
    learnTo(tree, 'fire-burn', 1);
    tree.restore([]);
    expect(tree.levels.size).toBe(0);
  });
});

describe('resolveSpell: ateş yetenekleri', () => {
  const none = new Map<string, number>();

  it('yetenek yoksa etkisizdir', () => {
    expect(resolveSpell(none, 'fire', 'attack')).toEqual(neutralEffects('fire', 'attack'));
    expect(resolvePassives(none)).toEqual({ scars: 0, shake: 0 });
  });

  it('seviye değerleri doğru okunur (Közleyen Alev 3 = %40, 12 hasar)', () => {
    const fx = resolveSpell(new Map([['fire-burn', 3]]), 'fire', 'attack');
    expect(fx.burnChance).toBeCloseTo(0.4, 6);
    expect(fx.burnDamage).toBe(12);
    expect(fx.skills).toEqual(['fire-burn-3']);
  });

  it('ateş yetenekleri yalnızca ateş saldırısında işler', () => {
    const all = new Map(skillsOf('fire').map((s) => [s.id, 3]));
    expect(resolveSpell(all, 'fire', 'attack').shieldBreak).toBeGreaterThan(0);
    expect(resolveSpell(all, 'fire', 'defense').shieldBreak).toBe(0);
    expect(resolveSpell(all, 'fire', 'defense').burnChance).toBe(0);
    expect(resolveSpell(all, 'water', 'attack')).toEqual(neutralEffects('water', 'attack'));
  });

  it('Yanık İzi büyü elementinden bağımsız pasiftir', () => {
    expect(resolvePassives(new Map([['fire-scars', 2]]))).toEqual({ scars: 2, shake: 0 });
    const fx = resolveSpell(new Map([['fire-scars', 3]]), 'fire', 'attack');
    expect(fx).toEqual(neutralEffects('fire', 'attack'));
  });

  it('SkillTree.resolve ve passives ağaç değişince güncel durumu okur', () => {
    const { tree } = treeAt(10);
    const resolver = tree.resolver;
    expect(resolver('fire', 'attack').shieldBreak).toBe(0);
    expect(tree.passives.scars).toBe(0);
    tree.learn('fire-breaker');
    tree.learn('fire-scars'); // puanla alınmaz
    expect(resolver('fire', 'attack').shieldBreak).toBeCloseTo(0.2, 6);
    expect(tree.passives.scars).toBe(0); // savaş pasifleri asa seviyesine bağlıdır (wandBattlePassives)
  });

  it('en güçlü kurulumda bile sınırlar aşılmaz', () => {
    const all = new Map(skillsOf('fire').map((s) => [s.id, 3]));
    const fx = resolveSpell(all, 'fire', 'attack');
    expect(fx.burnChance).toBeLessThanOrEqual(LIMITS.maxBurnChance);
    expect(fx.shieldBreak).toBeLessThanOrEqual(LIMITS.maxShieldBreak);
    expect(fx.scatter).toBeLessThanOrEqual(LIMITS.maxScatter);
  });
});

describe('hasar hesabı: savunma geçişi (Kıvılcım Saçması, Kalkan Kıran)', () => {
  const circle = analyzeStrokes(buildShape('circle', 128, 128, 75, 2400));
  const base = { basePower: 100, attack: circle, defense: circle.density, attackerElement: 'fire', defenderElement: 'fire' } as const;

  it('tam kapatan savunmada bile geçiş oranı kadar hasar geçer', () => {
    const blocked = calculateDamage(base);
    const half = calculateDamage({ ...base, defenseBypass: 0.5 });
    const full = calculateDamage({ ...base, defenseBypass: 1 });
    const open = calculateDamage({ ...base, defense: null });
    expect(blocked.defenseBypass).toBe(0);
    expect(half.finalDamage).toBeGreaterThan(blocked.finalDamage);
    expect(full.finalDamage).toBeGreaterThan(half.finalDamage);
    expect(full.finalDamage).toBe(open.finalDamage);
    expect(half.defendedRatio).toBeCloseTo(blocked.defendedRatio * 0.5, 6);
  });

  it('savunma yoksa geçiş bir şey değiştirmez', () => {
    const a = calculateDamage({ ...base, defense: null });
    const b = calculateDamage({ ...base, defense: null, defenseBypass: 0.7 });
    expect(b.finalDamage).toBe(a.finalDamage);
  });
});

describe('savaş akışı: ateş yetenekleri', () => {
  const good = () => analyzeStrokes(buildShape('circle', 128, 128, 75, 2400));
  const none = () => analyzeStrokes([]);

  const fighters = (spellsA?: SkillTree, extraB: Partial<ConstructorParameters<typeof BattleEngine>[0][number]> = {}) =>
    new BattleEngine([
      { name: 'A', team: 0, control: 'bot', spells: spellsA?.resolver, passives: spellsA?.passives },
      { name: 'B', team: 1, control: 'bot', ...extraB },
    ]);

  /** `turns` rapor toplanınca durur; savunan çizim yapar ya da yapmaz */
  async function play(engine: BattleEngine, turns: number, opts: { defenderDraws?: boolean; random?: () => number; draws?: DrawExtras[] } = {}) {
    const reports: TurnReport[] = [];
    const burns: BurnEvent[] = [];
    const stop = new AbortController();
    const io: BattleIO = {
      announceTurn: async () => {},
      chooseElement: async () => 'fire',
      revealRound: async () => {},
      draw: async (_r, role, _g, _l, extras) => {
        if (role === 'attack' && extras) opts.draws?.push(extras);
        return role === 'attack' || opts.defenderDraws ? good() : none();
      },
      announceBurn: async (events) => void burns.push(...events),
      play: async (r) => void (reports.push(r), reports.length >= turns && stop.abort()),
      announceEnd: async () => {},
    };
    await runBattle(engine, io, { signal: stop.signal, random: opts.random ?? (() => 0.99) });
    return { reports, burns };
  }

  const treeWith = (ids: Record<string, number>, level = 30) => {
    const tree = new SkillTree(() => level);
    for (const [id, n] of Object.entries(ids)) learnTo(tree, id, n);
    return tree;
  };

  it('yetenek yoksa yeni alanlar boş kalır', async () => {
    const { reports } = await play(fighters(), 1);
    expect(reports[0].ignited).toBe(false);
    expect(reports[0].shieldBroken).toBe(false);
    expect(reports[0].chainStacks).toBe(0);
    expect(reports[0].scatter).toBe(false);
    expect(reports[0].breakdown!.defenseBypass).toBe(0);
  });

  it('Közleyen Alev: şans tutarsa rakip yanar, her döngü başında hasar yer', async () => {
    const tree = treeWith({ 'fire-burn': 3 });
    const engine = fighters(tree);
    const { reports, burns } = await play(engine, 3, { random: () => 0 });
    expect(reports[0].ignited).toBe(true);
    expect(engine.fighter({ team: 1, index: 0 }).burn).toBe(12);
    // B'nin kendi saldırısı, sonra yeni döngü: B yanma hasarı yer
    expect(burns).toHaveLength(1);
    expect(burns[0]).toMatchObject({ damage: 12, ref: { team: 1, index: 0 } });
  });

  it('yanma birikmez: yanan rakip yeniden tutuşturulunca "yeni tutuştu" sayılmaz', async () => {
    const tree = treeWith({ 'fire-burn': 3 });
    const engine = fighters(tree);
    const { reports } = await play(engine, 3, { random: () => 0 });
    expect(reports[0].ignited).toBe(true);
    expect(reports[2].ignited).toBe(false);
    expect(engine.fighter({ team: 1, index: 0 }).burn).toBe(12);
  });

  it('şans tutmazsa tutuşmaz', async () => {
    const tree = treeWith({ 'fire-burn': 1 }); // %15
    const { reports } = await play(fighters(tree), 1, { random: () => 0.99 });
    expect(reports[0].ignited).toBe(false);
  });

  it('yanma savaşı bitirebilir (can sıfıra iner)', () => {
    const engine = fighters();
    engine.ignite({ team: 1, index: 0 }, 500);
    engine.nextAction(); // 1. döngü yanma yok (henüz yeni döngü başlıyor: yanma uygulanır)
    expect(engine.fighter({ team: 1, index: 0 }).hp).toBe(0);
    expect(engine.winner).toBe(0);
    expect(engine.takeBurnEvents()[0]).toMatchObject({ defeated: true });
  });

  it('ignite: ölü ya da 0 hasarlı yanma yok, daha güçlüsü eskinin yerine geçer', () => {
    const engine = fighters();
    const b = { team: 1 as const, index: 0 };
    expect(engine.ignite(b, 0)).toBe(false);
    expect(engine.ignite(b, 6)).toBe(true);
    expect(engine.ignite(b, 12)).toBe(false);
    expect(engine.fighter(b).burn).toBe(12);
    expect(engine.ignite(b, 6)).toBe(false);
    expect(engine.fighter(b).burn).toBe(12);
  });

  it('Kalkan Kıran: kırılırsa savunmaya rağmen daha çok hasar verir', async () => {
    const tree = treeWith({ 'fire-breaker': 3 });
    const plain = await play(fighters(), 1, { defenderDraws: true });
    const broken = await play(fighters(tree), 1, { defenderDraws: true, random: () => 0 });
    expect(broken.reports[0].shieldBroken).toBe(true);
    expect(broken.reports[0].breakdown!.defenseBypass).toBeCloseTo(SHIELD_BREAK_STRENGTH, 6);
    expect(broken.reports[0].damage).toBeGreaterThan(plain.reports[0].damage);
    const notBroken = await play(fighters(tree), 1, { defenderDraws: true, random: () => 0.99 });
    expect(notBroken.reports[0].shieldBroken).toBe(false);
    expect(notBroken.reports[0].damage).toBe(plain.reports[0].damage);
  });

  it('savunma yapılamadıysa kalkan kırılmaz', async () => {
    const tree = treeWith({ 'fire-breaker': 3 });
    const { reports } = await play(fighters(tree), 1, { defenderDraws: false, random: () => 0 });
    expect(reports[0].shieldBroken).toBe(false);
  });

  it('Kıvılcım Saçması: savunmayı kısmen aşar', async () => {
    const tree = treeWith({ 'fire-scatter': 3 });
    const plain = await play(fighters(), 1, { defenderDraws: true });
    const scattered = await play(fighters(tree), 1, { defenderDraws: true });
    expect(scattered.reports[0].scatter).toBe(true);
    expect(scattered.reports[0].damage).toBeGreaterThan(plain.reports[0].damage);
  });

  it('Alev Zinciri: art arda ateş saldırısı son vuruşu güçlendirir, ilk vuruş etkilenmez', async () => {
    const tree = treeWith({ 'fire-chain': 3 });
    const plain = await play(fighters(), 3);
    const chained = await play(fighters(tree), 3);
    // rapor sırası: A, B, A(2. döngü)
    expect(chained.reports[0].chainStacks).toBe(0);
    expect(chained.reports[0].damage).toBe(plain.reports[0].damage);
    expect(chained.reports[2].chainStacks).toBe(1);
    expect(chained.reports[2].damage).toBeGreaterThan(plain.reports[2].damage);
  });

  it('Alev Zinciri en çok 3 yığınla sınırlıdır', () => {
    const engine = fighters(treeWith({ 'fire-chain': 3 }));
    const a = engine.fighter({ team: 0, index: 0 });
    a.fireChain = 10;
    expect(Math.min(LIMITS.maxChainStacks, a.fireChain)).toBe(3);
  });

  it('başka element zinciri keser', async () => {
    const tree = treeWith({ 'fire-chain': 3 });
    const engine = fighters(tree);
    const reports: TurnReport[] = [];
    const stop = new AbortController();
    let call = 0;
    const io: BattleIO = {
      announceTurn: async () => {},
      // A: 1. döngü ateş, 2. döngü su
      chooseElement: async (ref) => (ref.team === 0 && ++call > 1 ? 'water' : 'fire'),
      revealRound: async () => {},
      draw: async () => good(),
      play: async (r) => void (reports.push(r), reports.length >= 3 && stop.abort()),
      announceEnd: async () => {},
    };
    await runBattle(engine, io, { signal: stop.signal, random: () => 0.99 });
    expect(reports[2].attackerElement).toBe('water');
    expect(reports[2].chainStacks).toBe(0);
    expect(engine.fighter({ team: 0, index: 0 }).fireChain).toBe(0);
  });

  it('Yanık İzi: savunanın pasifi saldırgana yara izi gönderir; bot yara izine rastgele denk gelip süre kaybeder', async () => {
    const draws: DrawExtras[] = [];
    const tree = { passives: resolvePassives(new Map([['fire-scars', 3]])) };
    // A saldırır, B (izli) savunur: izli oyuncu B
    const engine = new BattleEngine([
      { name: 'A', team: 0, control: 'bot' },
      { name: 'B', team: 1, control: 'bot', passives: tree.passives },
    ]);
    const plain = await play(fighters(), 1);
    const scarred = await play(engine, 1, { draws, random: () => 0 });
    expect(draws).toMatchObject([{ scars: 3, shake: 0 }]);
    expect(scarred.reports[0].attack.metrics.drawTimeSec).toBeCloseTo(plain.reports[0].attack.metrics.drawTimeSec - 3 * SCAR_PENALTY_SEC, 6);
    expect(scarred.reports[0].damage).toBeLessThan(plain.reports[0].damage);
  });

  it('Yanık İzi: şans tutmazsa bot izlere değmez; izi olmayana hiç ekstra gitmez', async () => {
    const draws: DrawExtras[] = [];
    const tree = { passives: resolvePassives(new Map([['fire-scars', 2]])) };
    const engine = new BattleEngine([
      { name: 'A', team: 0, control: 'bot' },
      { name: 'B', team: 1, control: 'bot', passives: tree.passives },
    ]);
    const plain = await play(fighters(), 1);
    const safe = await play(engine, 1, { draws, random: () => 0.99 });
    expect(draws).toMatchObject([{ scars: 2, shake: 0 }]);
    expect(safe.reports[0].attack.metrics.drawTimeSec).toBe(plain.reports[0].attack.metrics.drawTimeSec);

    const none: DrawExtras[] = [];
    await play(fighters(), 1, { draws: none });
    expect(none.every((e) => !e.scars && !e.shake)).toBe(true); // yalnızca özel şekil gider, yara izi ya da sarsıntı yok
  });

  it('Yanık İzi: insan oyuncunun süresini denetleyici değiştirmez (tuval kendisi keser)', async () => {
    const tree = { passives: resolvePassives(new Map([['fire-scars', 3]])) };
    const engine = new BattleEngine([
      { name: 'A', team: 0, control: 'human' },
      { name: 'B', team: 1, control: 'bot', passives: tree.passives },
    ]);
    const plain = await play(fighters(), 1);
    const human = await play(engine, 1, { random: () => 0 });
    expect(human.reports[0].attack.metrics.drawTimeSec).toBe(plain.reports[0].attack.metrics.drawTimeSec);
  });
});
