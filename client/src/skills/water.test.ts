import { describe, expect, it } from 'vitest';
import { runBattle, type BattleIO, type DrawExtras, type TurnReport } from '../battle/flow/controller';
import { BattleEngine } from '../battle/flow/engine';
import { buildShape } from '../battle/flow/shapes';
import { analyzeStrokes } from '../battle/gesture/analyze';
import { placeFog } from '../ui/drawingCanvas';
import { MAX_SKILL_LEVEL, describeEffect, skillsOf } from './catalog';
import { neutralEffects, resolvePassives, resolveSpell } from './resolver';
import { SkillTree } from './tree';

const good = () => analyzeStrokes(buildShape('circle', 128, 128, 75, 2400));
const none = () => analyzeStrokes([]);

const waterTree = (ids: Record<string, number>) => {
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

async function play(engine: BattleEngine, turns: number, opts: { defenderDraws?: boolean; random?: () => number; defenseExtras?: DrawExtras[]; limits?: number[] } = {}) {
  const reports: TurnReport[] = [];
  const stop = new AbortController();
  const io: BattleIO = {
    announceTurn: async () => {},
    chooseElement: async () => 'water',
    revealRound: async () => {},
    draw: async (_r, role, _g, limit, extras) => {
      opts.limits?.push(limit ?? 0);
      if (role === 'defense' && extras) opts.defenseExtras?.push(extras);
      return role === 'attack' || opts.defenderDraws ? good() : none();
    },
    play: async (r) => void (reports.push(r), reports.length >= turns && stop.abort()),
    announceEnd: async () => {},
  };
  await runBattle(engine, io, { signal: stop.signal, random: opts.random ?? (() => 0.99) });
  return reports;
}

describe('su yetenekleri', () => {
  it('katalog: 3 yetenek puanla (9 puan) + Sis Perdesi asa pasifi; saldırı yetenekleri saldırıda, yansıma yalnızca savunmada işler', () => {
    expect(skillsOf('water').map((s) => s.name)).toEqual(['Buz Nefesi', 'Şifa Kabarcıkları', 'Yansıyan Dalga', 'Sis Perdesi']);
    expect(skillsOf('water').filter((s) => !s.passive).length * MAX_SKILL_LEVEL).toBe(9);
    expect(skillsOf('water').find((s) => s.passive)?.id).toBe('water-fog');
    const all = new Map(skillsOf('water').map((s) => [s.id, 3]));
    const atk = resolveSpell(all, 'water', 'attack');
    expect(atk.lifesteal).toBeCloseTo(0.2, 6);
    expect(atk.chillChance).toBeCloseTo(0.55, 6);
    expect(atk.chillSec).toBe(0.7);
    expect(atk.fog).toBe(0); // Sis Perdesi artık pasif (asa seviyesine bağlı)
    expect(atk.reflect).toBe(0);
    const def = resolveSpell(all, 'water', 'defense');
    expect(def.reflect).toBeCloseTo(0.35, 6);
    expect(def.lifesteal).toBe(0);
    expect(resolveSpell(all, 'fire', 'attack')).toEqual(neutralEffects('fire', 'attack'));
    for (const s of skillsOf('water')) for (const l of s.levels) expect(describeEffect(l).length).toBeGreaterThan(0);
  });

  it('Şifa Kabarcıkları: verilen hasarın oranı kadar can döner', async () => {
    const tree = waterTree({ 'water-bubble': 3 });
    const engine = duel({ spells: tree.resolver });
    engine.applyDamage({ team: 0, index: 0 }, 100);
    const [r] = await play(engine, 1);
    expect(r.healed).toBe(Math.round(r.damage * 0.2));
    expect(r.healed).toBeGreaterThan(0);
    expect(engine.fighter({ team: 0, index: 0 }).hp).toBe(200 + r.healed);
  });

  it('Yansıyan Dalga: yalnızca savunmanın tuttuğu hasar yansır; savunma yoksa ya da yetenek yoksa yansıma yok', async () => {
    const tree = waterTree({ 'water-mirror': 3 });
    const withDef = await play(duel({}, { spells: tree.resolver }), 1, { defenderDraws: true });
    expect(withDef[0].reflected).toBeGreaterThan(0);
    const noDef = await play(duel({}, { spells: tree.resolver }), 1, { defenderDraws: false });
    expect(noDef[0].reflected).toBe(0);
    const plain = await play(duel(), 1, { defenderDraws: true });
    expect(plain[0].reflected).toBe(0);
  });

  it('Buz Nefesi: yavaşlayan rakibin sonraki çizimi kısalır (bir kez); botun çizim süresi de kesilir', async () => {
    const tree = waterTree({ 'water-chill': 3 });
    const limits: number[] = [];
    const reports = await play(duel({ spells: tree.resolver }), 3, { random: () => 0, limits });
    expect(reports[0].chilled).toBe(true);
    // çizimler: A saldırı, B savunma, B saldırı (yavaşlamış), A savunma, A saldırı, B savunma
    expect(limits[1]).toBeCloseTo(limits[0], 6);
    expect(limits[2]).toBeCloseTo(limits[0] - 0.7, 6);
    expect(limits[5]).toBeCloseTo(limits[0], 6);
    expect(reports[1].attack.metrics.drawTimeSec).toBeCloseTo(good().metrics.drawTimeSec - 0.7, 6);
    const missed = await play(duel({ spells: tree.resolver }), 1, { random: () => 0.99 });
    expect(missed[0].chilled).toBe(false);
  });

  it('Sis Perdesi: savunma ekranına sis gider; botun savunması yanlış çizilir, insanınki bozulmaz', async () => {
    const owner = { passives: resolvePassives(new Map([['water-fog', 3]])) };
    const extras: DrawExtras[] = [];
    const plain = await play(duel(), 1, { defenderDraws: true });
    const fogged = await play(duel({ passives: owner.passives }), 1, { defenderDraws: true, defenseExtras: extras });
    expect(extras).toEqual([{ fog: 3, mud: 0 }]);
    expect(fogged[0].defense!.strokes).not.toEqual(plain[0].defense!.strokes); // sisli bot savunmasını yanlış çizdi
    expect(fogged[0].damage).toBeGreaterThan(plain[0].damage);
    const human = await play(duel({ passives: owner.passives }, { control: 'human' }), 1, { defenderDraws: true });
    expect(human[0].defense!.strokes).toEqual(plain[0].defense!.strokes);
    expect(human[0].damage).toBe(plain[0].damage);
    expect(human[0].fogged).toBe(3);
  });

  it('sis bulutları istenen sayıda yerleşir', () => {
    for (let n = 0; n <= 3; n++) expect(placeFog(n)).toHaveLength(n);
  });
});
