import { describe, expect, it } from 'vitest';
import { ELEMENTS } from '../battle/damage/elements';
import { runBattle, type BattleIO, type DrawExtras, type TurnReport } from '../battle/flow/controller';
import { BattleEngine } from '../battle/flow/engine';
import { buildShape } from '../battle/flow/shapes';
import { analyzeStrokes } from '../battle/gesture/analyze';
import { TIERS, enemyFighters } from './catalog';
import { ENEMY_SKILL_ORDER, enemySkillLevels, enemySkills } from './skills';
import { skillsOf } from '../skills/catalog';

const player = { name: 'Ben', level: 5, hp: 300, armor: 0 };
const good = () => analyzeStrokes(buildShape('circle', 128, 128, 75, 2400));

describe('düşman yetenekleri', () => {
  it('sıra listesi her elementin tüm yeteneklerini içerir', () => {
    for (const el of ELEMENTS) expect([...ENEMY_SKILL_ORDER[el]].sort()).toEqual(skillsOf(el).map((s) => s.id).sort());
  });

  it('kademe yükseldikçe yetenek sayısı ve seviyesi artar (düşük → orta → yüksek)', () => {
    for (const el of ELEMENTS) {
      const sizes = TIERS.map((t) => enemySkillLevels(el, t).size);
      const levels = TIERS.map((t) => Math.max(...enemySkillLevels(el, t).values()));
      expect(sizes[0]).toBe(2);
      expect(sizes[1]).toBe(3);
      expect(sizes[3]).toBe(skillsOf(el).length);
      for (let i = 1; i < 4; i++) {
        expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1]);
        expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
      }
      expect(levels).toEqual([1, 2, 2, 3]);
    }
  });

  it('düşük kademede etkiler hafif, yüksekte güçlü', () => {
    const low = enemySkills('fire', 1).spells('fire', 'attack');
    const high = enemySkills('fire', 4).spells('fire', 'attack');
    expect(low.burnChance).toBeCloseTo(0.15, 6);
    expect(high.burnChance).toBeCloseTo(0.4, 6);
    expect(enemySkills('fire', 1).passives.scars).toBe(1);
    expect(enemySkills('fire', 4).passives.scars).toBe(3);
    expect(enemySkills('air', 1).passives.shake).toBe(1);
    expect(enemySkills('air', 4).passives.shake).toBe(3);
    expect(enemySkills('water', 4).spells('water', 'attack').fog).toBe(3);
    expect(enemySkills('earth', 4).spells('earth', 'attack').mud).toBe(3);
  });

  it('düşman başka elementin büyüsünü seçerse yetenekleri işlemez', () => {
    const fx = enemySkills('fire', 4).spells('water', 'attack');
    expect(fx.burnChance).toBe(0);
    expect(fx.skills).toEqual([]);
  });

  it('enemyFighters düşmana yetenekleri verir, oyuncuya dokunmaz', () => {
    const [me, foe] = enemyFighters('earth', 4, player);
    expect(foe.passives).toEqual({ scars: 0, shake: 0 });
    expect(foe.spells!('earth', 'attack').mud).toBe(3);
    expect(me.passives).toBeUndefined();
  });

  it('yüksek kademe ateş düşmanı oyuncuyu yakar ve oyuncunun saldırı ekranına yara izi koyar', async () => {
    const engine = new BattleEngine(enemyFighters('fire', 4, player).map((f) => ({ ...f, control: 'bot' as const })));
    const extras: DrawExtras[] = [];
    const reports: TurnReport[] = [];
    const stop = new AbortController();
    const io: BattleIO = {
      announceTurn: async () => {},
      chooseElement: async () => 'fire',
      revealRound: async () => {},
      draw: async (_r, _role, _g, _l, e) => {
        if (e?.scars) extras.push(e);
        return good();
      },
      play: async (r) => void (reports.push(r), reports.length >= 2 && stop.abort()),
      announceEnd: async () => {},
    };
    await runBattle(engine, io, { signal: stop.signal, random: () => 0 });
    // rapor 0: oyuncu saldırır (düşmanın Yanık İzi'ni görür), rapor 1: düşman saldırır ve yakar
    expect(extras[0]).toMatchObject({ scars: 3 });
    expect(reports[1].ignited).toBe(true);
    expect(engine.fighter({ team: 0, index: 0 }).burn).toBe(12);
  });

  it('düşük kademe düşman daha az hasar ve etki verir', () => {
    const low = enemySkills('fire', 1).spells('fire', 'attack');
    const high = enemySkills('fire', 4).spells('fire', 'attack');
    expect(high.burnDamage).toBeGreaterThan(low.burnDamage);
    expect(high.shieldBreak).toBeGreaterThanOrEqual(low.shieldBreak);
  });
});
