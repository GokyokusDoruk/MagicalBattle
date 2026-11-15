import { describe, expect, it } from 'vitest';
import { BOT_SHAKE_PENALTY_SEC, runBattle, type BattleIO, type DrawExtras, type TurnReport } from '../battle/flow/controller';
import { BattleEngine } from '../battle/flow/engine';
import { buildShape } from '../battle/flow/shapes';
import { analyzeStrokes } from '../battle/gesture/analyze';
import { MAX_SKILL_LEVEL, describeEffect, skillsOf } from './catalog';
import { neutralEffects, resolvePassives, resolveSpell } from './resolver';
import { SkillTree } from './tree';

const good = () => analyzeStrokes(buildShape('circle', 128, 128, 75, 2400));
const none = () => analyzeStrokes([]);

const airTree = (ids: Record<string, number>) => {
  const tree = new SkillTree(() => 30);
  for (const [id, n] of Object.entries(ids)) for (let i = 0; i < n; i++) expect(tree.learn(id)).toBe(true);
  return tree;
};

type Init = Partial<ConstructorParameters<typeof BattleEngine>[0][number]>;
const duel = (a: Init = {}, b: Init = {}) =>
  new BattleEngine([
    { name: 'A', team: 0, control: 'bot', ...a },
    { name: 'B', team: 1, control: 'bot', ...b },
  ]);

async function play(engine: BattleEngine, turns: number, opts: { defenderDraws?: boolean; random?: () => number; limits?: number[]; attackExtras?: DrawExtras[] } = {}) {
  const reports: TurnReport[] = [];
  const stop = new AbortController();
  const io: BattleIO = {
    announceTurn: async () => {},
    chooseElement: async () => 'air',
    revealRound: async () => {},
    draw: async (_r, role, _g, limit, extras) => {
      opts.limits?.push(limit ?? 0);
      if (role === 'attack' && extras) opts.attackExtras?.push(extras);
      return role === 'attack' || opts.defenderDraws ? good() : none();
    },
    play: async (r) => void (reports.push(r), reports.length >= turns && stop.abort()),
    announceEnd: async () => {},
  };
  await runBattle(engine, io, { signal: stop.signal, random: opts.random ?? (() => 0.99) });
  return reports;
}

describe('hava yetenekleri', () => {
  it('katalog: 4 yetenek (12 puan); süre ikisinde, kritik saldırıda, geri savurma savunmada, sarsıntı pasif', () => {
    expect(skillsOf('air').map((s) => s.name)).toEqual(['Fırtına Nefesi', 'Keskin Esinti', 'Geri Esen Rüzgâr', 'Sarsıntılı Rüzgâr']);
    expect(skillsOf('air').length * MAX_SKILL_LEVEL).toBe(12);
    const all = new Map(skillsOf('air').map((s) => [s.id, 3]));
    const atk = resolveSpell(all, 'air', 'attack');
    expect(atk.timeBonus).toBeCloseTo(0.8, 6);
    expect(atk.critBonus).toBeCloseTo(0.2, 6);
    expect(atk.reboundChance).toBe(0);
    const def = resolveSpell(all, 'air', 'defense');
    expect(def.timeBonus).toBeCloseTo(0.8, 6);
    expect(def.reboundChance).toBeCloseTo(0.8, 6);
    expect(def.reboundShare).toBeCloseTo(0.1, 6);
    expect(def.critBonus).toBe(0);
    expect(resolveSpell(all, 'fire', 'attack')).toEqual(neutralEffects('fire', 'attack'));
    expect(resolvePassives(all)).toEqual({ scars: 0, shake: 3 });
    for (const s of skillsOf('air')) for (const l of s.levels) expect(describeEffect(l).length).toBeGreaterThan(0);
  });

  it('Fırtına Nefesi: hava saldırı ve savunma çizim süresi uzar', async () => {
    const tree = airTree({ 'air-gale': 3 });
    const limits: number[] = [];
    await play(duel({ spells: tree.resolver }, { spells: tree.resolver }), 1, { limits });
    const plainLimits: number[] = [];
    await play(duel(), 1, { limits: plainLimits });
    expect(limits[0]).toBeCloseTo(plainLimits[0] + 0.8, 6);
    expect(limits[1]).toBeCloseTo(plainLimits[1] + 0.8, 6);
  });

  it('Keskin Esinti: kritik şansı artar', async () => {
    const tree = airTree({ 'air-edge': 3 });
    // zar 0.1: yetenek yokken kritik değil, %20 bonusla kritik
    const plain = await play(duel(), 1, { random: () => 0.1 });
    const edge = await play(duel({ spells: tree.resolver }), 1, { random: () => 0.1 });
    expect(plain[0].critical).toBe(false);
    expect(edge[0].critical).toBe(true);
    expect(edge[0].damage).toBeGreaterThan(plain[0].damage);
  });

  it('Geri Esen Rüzgâr: şans tutarsa savunmanın tuttuğu hasarın bir kısmı saldırana savrulur', async () => {
    const tree = airTree({ 'air-rebound': 3 });
    const hit = await play(duel({}, { spells: tree.resolver }), 1, { defenderDraws: true, random: () => 0 });
    expect(hit[0].rebounded).toBeGreaterThan(0);
    expect(hit[0].reflected).toBe(hit[0].rebounded);
    const miss = await play(duel({}, { spells: tree.resolver }), 1, { defenderDraws: true, random: () => 0.99 });
    expect(miss[0].rebounded).toBe(0);
    const noDef = await play(duel({}, { spells: tree.resolver }), 1, { defenderDraws: false, random: () => 0 });
    expect(noDef[0].rebounded).toBe(0);
  });

  it('Sarsıntılı Rüzgâr: saldırganın ekranına sarsıntı gider, bot saldırgan süre kaybeder', async () => {
    const tree = airTree({ 'air-tremor': 3 });
    const extras: DrawExtras[] = [];
    const plain = await play(duel(), 1);
    const shaken = await play(duel({}, { passives: tree.passives }), 1, { attackExtras: extras });
    expect(extras).toMatchObject([{ scars: 0, shake: 3 }]);
    expect(shaken[0].attack.metrics.drawTimeSec).toBeCloseTo(plain[0].attack.metrics.drawTimeSec - 3 * BOT_SHAKE_PENALTY_SEC, 6);
    expect(shaken[0].damage).toBeLessThan(plain[0].damage);
  });

  it('Sarsıntılı Rüzgâr: insan saldırganın süresini denetleyici kesmez (tuval kendisi sarsılır)', async () => {
    const tree = airTree({ 'air-tremor': 2 });
    const plain = await play(duel(), 1);
    const human = await play(duel({ control: 'human' }, { passives: tree.passives }), 1);
    expect(human[0].attack.metrics.drawTimeSec).toBe(plain[0].attack.metrics.drawTimeSec);
  });
});
