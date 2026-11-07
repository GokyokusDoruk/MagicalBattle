import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../world/rng';
import type { SlotRef } from '../arena/layout';
import type { Element } from '../damage/elements';
import { analyzeStrokes } from '../gesture/analyze';
import type { DrawingResult, Stroke } from '../gesture/types';
import { Bot } from './bot';
import { runBattle, type BattleIO, type Role, type TurnReport } from './controller';
import { BattleEngine, type Action, type FighterInit } from './engine';
import { buildShape } from './shapes';

const f = (name: string, team: 0 | 1): FighterInit => ({ name, team, control: 'bot' });
const duel = () => new BattleEngine([f('A', 0), f('B', 1)]);
const twoVsTwo = () => new BattleEngine([f('A1', 0), f('A2', 0), f('B1', 1), f('B2', 1)]);

const good = (): DrawingResult => analyzeStrokes(buildShape('circle', 128, 128, 75, 2400));
const invalid = (): DrawingResult => analyzeStrokes([]);

interface Log {
  events: string[];
  reports: TurnReport[];
  draws: { ref: SlotRef; role: Role; ghost: boolean }[];
  winner: unknown;
}

/** Elle yönetilen sahte arayüz: kayıt tutar, çizimleri/elementleri verilen işlevlerle üretir. */
function fakeIO(
  opts: {
    draw?: (ref: SlotRef, role: Role, ghost?: readonly Stroke[]) => DrawingResult;
    element?: (ref: SlotRef, role: Role) => Element;
  } = {},
): { io: BattleIO; log: Log } {
  const log: Log = { events: [], reports: [], draws: [], winner: undefined };
  const io: BattleIO = {
    announceTurn: async (a: Action) => void log.events.push(`tur ${a.attacker.team}${a.attacker.index}>${a.defender.team}${a.defender.index}`),
    chooseElement: async (ref, role) => {
      log.events.push(`seç ${role}`);
      return opts.element?.(ref, role) ?? 'fire';
    },
    revealElements: async () => void log.events.push('açıldı'),
    draw: async (ref, role, ghost) => {
      log.events.push(`çiz ${role}`);
      log.draws.push({ ref, role, ghost: ghost !== undefined });
      return opts.draw ? opts.draw(ref, role, ghost) : good();
    },
    play: async (r) => void (log.reports.push(r), log.events.push('oynat')),
    announceEnd: async (w) => void (log.winner = w, log.events.push('bitti')),
  };
  return { io, log };
}

describe('runBattle: tek tur akışı', () => {
  it('sıra: duyuru → iki element seçimi → açılma → saldırı çizimi → savunma çizimi → oynatma', async () => {
    const { io, log } = fakeIO();
    const e = duel();
    e.applyDamage({ team: 1, index: 0 }, 290); // ilk vuruşla bitsin
    await runBattle(e, io);
    expect(log.events.slice(0, 7)).toEqual(['tur 00>10', 'seç attack', 'seç defense', 'açıldı', 'çiz attack', 'çiz defense', 'oynat']);
    expect(log.events[log.events.length - 1]).toBe('bitti');
  });

  it('iki oyuncunun element seçimi aynı anda başlar (kör seçim): ikisi de çağrılmadan hiçbiri sonuçlanmaz', async () => {
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { io } = fakeIO();
    const e = duel();
    const stop = new AbortController();
    io.play = async () => stop.abort(); // yalnızca ilk tur
    io.chooseElement = async (_ref, role) => {
      order.push(`başladı ${role}`);
      await gate;
      order.push(`bitti ${role}`);
      return 'water';
    };
    const run = runBattle(e, io, { signal: stop.signal });
    await new Promise((r) => setTimeout(r, 10));
    expect(order).toEqual(['başladı attack', 'başladı defense']); // ikisi de başladı, ikisi de bekliyor
    release();
    await run;
    expect(order).toEqual(['başladı attack', 'başladı defense', 'bitti attack', 'bitti defense']);
  });

  it('hasar, savunma yokken saldırının tamamıdır ve can düşer', async () => {
    const { io, log } = fakeIO({ draw: (_r, role) => (role === 'attack' ? good() : invalid()) });
    const e = duel();
    e.applyDamage({ team: 1, index: 0 }, 250);
    await runBattle(e, io);
    const r = log.reports[0];
    expect(r.defenseFailed).toBe(true);
    expect(r.breakdown?.defendedRatio).toBe(0);
    expect(r.damage).toBe(Math.min(r.hpBefore, r.breakdown!.finalDamage));
    expect(r.hpAfter).toBe(r.hpBefore - r.damage);
    expect(r.defeated).toBe(true);
  });

  it('aynı çizimle tam savunma neredeyse hiç hasar vermez', async () => {
    const same = good();
    const { io, log } = fakeIO({ draw: () => same });
    const e = duel();
    await runBattle(e, io, { signal: AbortSignal.abort() }); // hiç çalışmasın
    expect(log.reports).toHaveLength(0);

    const e2 = duel();
    const { io: io2, log: log2 } = fakeIO({ draw: () => same });
    const stop = new AbortController();
    io2.play = async (r) => {
      log2.reports.push(r);
      stop.abort();
    };
    await runBattle(e2, io2, { signal: stop.signal });
    expect(log2.reports[0].breakdown!.defendedRatio).toBeGreaterThan(0.98);
    expect(log2.reports[0].damage).toBeLessThanOrEqual(3);
  });

  it('saldıran büyü yapamazsa savunma çizilmez, hasar yok, sıra rakibe geçer', async () => {
    const { io, log } = fakeIO({ draw: (ref, role) => (ref.team === 0 && role === 'attack' ? invalid() : good()) });
    const e = duel();
    const stop = new AbortController();
    let plays = 0;
    io.play = async (r) => {
      log.reports.push(r);
      if (++plays === 2) stop.abort();
    };
    await runBattle(e, io, { signal: stop.signal });
    const [first, second] = log.reports;
    expect(first).toMatchObject({ attackFailed: true, damage: 0, defense: null, breakdown: null, hpBefore: 300, hpAfter: 300 });
    expect(log.draws.filter((d) => d.role === 'defense' && d.ref.team === 1)).toHaveLength(0); // B savunma çizmedi
    expect(second.action.attacker).toEqual({ team: 1, index: 0 }); // sıra rakibe geçti
  });

  it('savunana gelen saldırı hayalet olarak verilir (ayar açıkken) ve kapalıyken verilmez', async () => {
    for (const show of [true, false]) {
      const { io, log } = fakeIO();
      const e = duel();
      e.applyDamage({ team: 1, index: 0 }, 290);
      await runBattle(e, io, { showAttackToDefender: show });
      const defenseDraw = log.draws.find((d) => d.role === 'defense')!;
      const attackDraw = log.draws.find((d) => d.role === 'attack')!;
      expect(defenseDraw.ghost).toBe(show);
      expect(attackDraw.ghost).toBe(false);
    }
  });

  it('element çarpanı hasara yansır: üstünlük ×1.5, dezavantaj ×0.5', async () => {
    const run = async (a: Element, d: Element): Promise<number> => {
      const { io, log } = fakeIO({ element: (_r, role) => (role === 'attack' ? a : d), draw: (_r, role) => (role === 'attack' ? good() : invalid()) });
      const e = duel();
      e.applyDamage({ team: 1, index: 0 }, 299);
      await runBattle(e, io);
      return log.reports[0].breakdown!.afterElement;
    };
    const neutral = await run('fire', 'earth');
    expect((await run('water', 'fire')) / neutral).toBeCloseTo(1.5, 5);
    expect((await run('fire', 'water')) / neutral).toBeCloseTo(0.5, 5);
  });

  it('savaşçının zırhı, skill çarpanları ve taban gücü hesaba girer', async () => {
    const base = new BattleEngine([f('A', 0), f('B', 1)]);
    const buffed = new BattleEngine([
      { ...f('A', 0), basePower: 200, dealtMultiplier: 1.5 },
      { ...f('B', 1), armor: 0.5, takenMultiplier: 0.8 },
    ]);
    const damageOf = async (e: BattleEngine): Promise<number> => {
      const { io, log } = fakeIO({ draw: (_r, role) => (role === 'attack' ? good() : invalid()) });
      e.applyDamage({ team: 1, index: 0 }, 1); // en az 1 can eksik: ilk turda bitmesin
      const stop = new AbortController();
      io.play = async (r) => {
        log.reports.push(r);
        stop.abort();
      };
      await runBattle(e, io, { signal: stop.signal });
      return log.reports[0].breakdown!.afterArmor;
    };
    const plain = await damageOf(base);
    const strong = await damageOf(buffed);
    expect(strong / plain).toBeCloseTo(2 * 1.5 * 0.8 * 0.5, 4);
  });
});

describe('runBattle: tam savaşlar (botlara karşı)', () => {
  const botIO = (seed: number, log: { turns: string[]; hits: Record<string, number> }): BattleIO => {
    const rand = mulberry32(seed);
    const bots = [new Bot(rand, 0.5), new Bot(rand, 0.5), new Bot(rand, 0.5), new Bot(rand, 0.5)];
    const pick = (ref: SlotRef) => bots[ref.team * 2 + ref.index];
    return {
      announceTurn: async (a) => void log.turns.push(`${a.attacker.team}${a.attacker.index}>${a.defender.team}${a.defender.index}`),
      chooseElement: async (ref) => pick(ref).chooseElement(),
      revealElements: async () => {},
      draw: async (ref, role, ghost) => (role === 'attack' ? pick(ref).drawAttack() : pick(ref).drawDefense(ghost)),
      play: async (r) => {
        const key = `${r.action.defender.team}${r.action.defender.index}`;
        log.hits[key] = (log.hits[key] ?? 0) + r.damage;
      },
      announceEnd: async () => {},
    };
  };

  it('1v1 her tohumda sonlanır ve bir takım kazanır (sonsuz döngü yok)', async () => {
    for (let seed = 1; seed <= 25; seed++) {
      const log = { turns: [] as string[], hits: {} as Record<string, number> };
      const e = duel();
      const winner = await runBattle(e, botIO(seed, log));
      expect(winner, `tohum ${seed}`).not.toBeNull();
      expect(log.turns.length).toBeGreaterThan(2);
      expect(log.turns.length).toBeLessThan(120);
    }
  });

  it('2v2 her tohumda sonlanır; ölenler atlanır, kazanan takımda hayatta biri vardır', async () => {
    for (let seed = 1; seed <= 15; seed++) {
      const log = { turns: [] as string[], hits: {} as Record<string, number> };
      const e = twoVsTwo();
      const winner = await runBattle(e, botIO(seed, log));
      expect(winner).not.toBeNull();
      if (winner === 0 || winner === 1) {
        expect(e.team(winner).some((x) => x.hp > 0)).toBe(true);
        expect(e.team(winner === 0 ? 1 : 0).every((x) => x.hp === 0)).toBe(true);
      }
    }
  });

  it('verilen toplam hasar, kaybedilen toplam cana eşittir', async () => {
    const log = { turns: [] as string[], hits: {} as Record<string, number> };
    const e = twoVsTwo();
    await runBattle(e, botIO(3, log));
    for (const x of e.all()) {
      expect(log.hits[`${x.team}${x.index}`] ?? 0).toBe(x.maxHp - x.hp);
    }
  });

  it('2v2 sırası ilk döngüde 00>10, 01>11, 10>00, 11>01 biçimindedir', async () => {
    const log = { turns: [] as string[], hits: {} as Record<string, number> };
    await runBattle(twoVsTwo(), botIO(4, log));
    expect(log.turns.slice(0, 4)).toEqual(['00>10', '01>11', '10>00', '11>01']);
  });
});
