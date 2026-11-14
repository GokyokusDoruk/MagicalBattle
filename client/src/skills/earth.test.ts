import { describe, expect, it } from 'vitest';
import { runBattle, type BattleIO, type DrawExtras, type TurnReport } from '../battle/flow/controller';
import { BattleEngine } from '../battle/flow/engine';
import { buildShape } from '../battle/flow/shapes';
import { analyzeStrokes } from '../battle/gesture/analyze';
import { inMud, placeMud } from '../ui/drawingCanvas';
import { MAX_SKILL_LEVEL, describeEffect, skillsOf } from './catalog';
import { LIMITS, MUD_BOT_BYPASS, neutralEffects, resolveSpell } from './resolver';
import { SkillTree } from './tree';

const good = () => analyzeStrokes(buildShape('circle', 128, 128, 75, 2400));
const none = () => analyzeStrokes([]);

const earthTree = (ids: Record<string, number>) => {
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

async function play(engine: BattleEngine, turns: number, opts: { defenderDraws?: boolean; random?: () => number; defenseExtras?: DrawExtras[]; stuns?: number[] } = {}) {
  const reports: TurnReport[] = [];
  const stop = new AbortController();
  const io: BattleIO = {
    announceTurn: async () => {},
    chooseElement: async () => 'earth',
    revealRound: async () => {},
    draw: async (_r, role, _g, _l, extras) => {
      if (role === 'defense' && extras) opts.defenseExtras?.push(extras);
      return role === 'attack' || opts.defenderDraws ? good() : none();
    },
    announceStun: async (ref) => void opts.stuns?.push(ref.team),
    play: async (r) => void (reports.push(r), reports.length >= turns && stop.abort()),
    announceEnd: async () => {},
  };
  await runBattle(engine, io, { signal: stop.signal, random: opts.random ?? (() => 0.99) });
  return reports;
}

describe('toprak yetenekleri', () => {
  it('katalog: 4 yetenek (12 puan); savunma yetenekleri savunmada, diğerleri saldırıda işler', () => {
    expect(skillsOf('earth').map((s) => s.name)).toEqual(['Taş Kabuk', 'Sarsıntı', 'Dağ Kalkanı', 'Çamur Yaması']);
    expect(skillsOf('earth').length * MAX_SKILL_LEVEL).toBe(12);
    const all = new Map(skillsOf('earth').map((s) => [s.id, 3]));
    const atk = resolveSpell(all, 'earth', 'attack');
    expect(atk.stunChance).toBeCloseTo(0.8, 6);
    expect(atk.mud).toBe(3);
    expect(atk.armorStack).toBe(0);
    expect(atk.takenMultiplier).toBe(1);
    const def = resolveSpell(all, 'earth', 'defense');
    expect(def.armorStack).toBeCloseTo(0.04, 6);
    expect(def.takenMultiplier).toBeCloseTo(0.74, 6);
    expect(def.stunChance).toBe(0);
    expect(resolveSpell(all, 'water', 'defense')).toEqual(neutralEffects('water', 'defense'));
    for (const s of skillsOf('earth')) for (const l of s.levels) expect(describeEffect(l).length).toBeGreaterThan(0);
  });

  it('Dağ Kalkanı: toprak savunmasında alınan hasar azalır', async () => {
    const tree = earthTree({ 'earth-bulwark': 3 });
    const plain = await play(duel(), 1);
    const guarded = await play(duel({}, { spells: tree.resolver }), 1);
    expect(guarded[0].damage).toBeLessThan(plain[0].damage);
  });

  it('Taş Kabuk: her toprak savunması kalıcı zırh ekler, zırh sonraki hasarı azaltır, üst sınır var', async () => {
    const tree = earthTree({ 'earth-armor': 3 });
    const engine = duel({}, { spells: tree.resolver });
    const reports = await play(engine, 3, { defenderDraws: true });
    expect(reports[0].armorGained).toBeCloseTo(0.04, 6);
    const b = engine.fighter({ team: 1, index: 0 });
    expect(b.armorBonus).toBeCloseTo(0.08, 6); // 2 kez savundu (A'nın iki saldırısı)
    expect(reports[2].breakdown!.armorReduction).toBeCloseTo(0.04, 6); // 2. savunmada yalnızca 1. kazanç işliyor
    const capped = duel({}, { spells: tree.resolver });
    capped.fighter({ team: 1, index: 0 }).armorBonus = LIMITS.maxArmorBonus - 0.01;
    const r = await play(capped, 1, { defenderDraws: true });
    expect(r[0].armorGained).toBeCloseTo(0.01, 6);
    expect(capped.fighter({ team: 1, index: 0 }).armorBonus).toBeCloseTo(LIMITS.maxArmorBonus, 6);
  });

  it('Taş Kabuk: savunma yapılamadıysa zırh kazanılmaz', async () => {
    const tree = earthTree({ 'earth-armor': 3 });
    const engine = duel({}, { spells: tree.resolver });
    const [r] = await play(engine, 1, { defenderDraws: false });
    expect(r.armorGained).toBe(0);
    expect(engine.fighter({ team: 1, index: 0 }).armorBonus).toBe(0);
  });

  it('Sarsıntı: savunmayı %80+ aşan vuruş rakibin sıradaki saldırısını atlatır (bir kez)', async () => {
    const tree = earthTree({ 'earth-quake': 3 });
    const stuns: number[] = [];
    const engine = duel({ spells: tree.resolver });
    const reports = await play(engine, 2, { random: () => 0, stuns });
    expect(reports[0].stunned).toBe(true);
    // B'nin sırası atlandı: ikinci rapor yine A'nın saldırısı
    expect(stuns).toEqual([1]);
    expect(reports[1].action.attacker.team).toBe(0);
    // A yine vurdu (şans hep tutuyor) ve rakibi yeniden sersemletti; sersemlik birikmez, yalnızca bir sıra atlatır
    expect(reports[1].stunned).toBe(true);
    expect(engine.fighter({ team: 1, index: 0 }).stunned).toBe(true);
  });

  it('Sarsıntı: iyi savunulan vuruş ya da tutmayan şans sersemletmez', async () => {
    const tree = earthTree({ 'earth-quake': 3 });
    const defended = await play(duel({ spells: tree.resolver }), 1, { defenderDraws: true, random: () => 0 });
    expect(defended[0].breakdown!.defendedRatio).toBeGreaterThan(0.2);
    expect(defended[0].stunned).toBe(false);
    const unlucky = await play(duel({ spells: tree.resolver }), 1, { random: () => 0.99 });
    expect(unlucky[0].stunned).toBe(false);
  });

  it('Çamur Yaması: savunma ekranına çamur gider; botun savunması zayıflar', async () => {
    const tree = earthTree({ 'earth-mud': 3 });
    const extras: DrawExtras[] = [];
    const plain = await play(duel(), 1, { defenderDraws: true });
    const muddy = await play(duel({ spells: tree.resolver }), 1, { defenderDraws: true, defenseExtras: extras });
    expect(extras).toEqual([{ fog: 0, mud: 3 }]);
    expect(muddy[0].breakdown!.defenseBypass).toBeCloseTo(3 * MUD_BOT_BYPASS, 6);
    expect(muddy[0].damage).toBeGreaterThan(plain[0].damage);
    expect(muddy[0].mudded).toBe(3);
  });

  it('çamur yamaları tuvalin içine yerleşir ve içine girmek ölçülür', () => {
    for (let n = 0; n <= 3; n++) expect(placeMud(n)).toHaveLength(n);
    const muds = [{ x: 100, y: 100, r: 30 }];
    expect(inMud(muds, { x: 110, y: 100 })).toBe(true);
    expect(inMud(muds, { x: 200, y: 200 })).toBe(false);
    expect(inMud([], { x: 1, y: 1 })).toBe(false);
  });
});
