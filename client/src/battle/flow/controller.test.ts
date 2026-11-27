import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../world/rng';
import type { SlotRef } from '../arena/layout';
import type { Element } from '../damage/elements';
import { analyzeStrokes } from '../gesture/analyze';
import type { DrawingResult, Stroke } from '../gesture/types';
import { Bot } from './bot';
import { runBattle, type BattleIO, type Role, type RoundChoice, type TurnReport } from './controller';
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
  rounds: RoundChoice[][];
  winner: unknown;
}

/** Elle yönetilen sahte arayüz: kayıt tutar, çizimleri/elementleri verilen işlevlerle üretir. */
function fakeIO(
  opts: {
    draw?: (ref: SlotRef, role: Role, ghost?: readonly Stroke[]) => DrawingResult;
    /** Savaşçının DÖNGÜ başında seçtiği element; ikinci parametre kaçıncı seçim olduğu (döngü sırası - 1) */
    element?: (ref: SlotRef, cycleIndex: number) => Element;
  } = {},
): { io: BattleIO; log: Log } {
  const log: Log = { events: [], reports: [], draws: [], rounds: [], winner: undefined };
  const picks = new Map<string, number>();
  const io: BattleIO = {
    announceTurn: async (a: Action) => void log.events.push(`tur ${a.attacker.team}${a.attacker.index}>${a.defender.team}${a.defender.index}`),
    chooseElement: async (ref) => {
      const k = `${ref.team}:${ref.index}`;
      const n = picks.get(k) ?? 0;
      picks.set(k, n + 1);
      log.events.push(`seç ${ref.team}${ref.index}`);
      return opts.element?.(ref, n) ?? 'fire';
    },
    revealRound: async (round) => void (log.rounds.push([...round]), log.events.push('açıldı')),
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

describe('runBattle: döngü ve tur akışı', () => {
  it('sıra: döngü başında iki element seçimi → açılma → tur duyurusu → saldırı çizimi → savunma çizimi → oynatma', async () => {
    const { io, log } = fakeIO();
    const e = duel();
    e.applyDamage({ team: 1, index: 0 }, 290); // ilk vuruşla bitsin
    await runBattle(e, io);
    expect(log.events.slice(0, 7)).toEqual(['seç 00', 'seç 10', 'açıldı', 'tur 00>10', 'çiz attack', 'çiz defense', 'oynat']);
    expect(log.events[log.events.length - 1]).toBe('bitti');
  });

  it('element seçimi aynı anda başlar (kör seçim): hepsi çağrılmadan hiçbiri sonuçlanmaz', async () => {
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { io } = fakeIO();
    const e = duel();
    const stop = new AbortController();
    io.play = async () => stop.abort(); // yalnızca ilk tur
    io.chooseElement = async (ref) => {
      order.push(`başladı ${ref.team}`);
      await gate;
      order.push(`bitti ${ref.team}`);
      return 'water';
    };
    const run = runBattle(e, io, { signal: stop.signal });
    await new Promise((r) => setTimeout(r, 10));
    expect(order).toEqual(['başladı 0', 'başladı 1']); // ikisi de başladı, ikisi de bekliyor
    release();
    await run;
    expect(order).toEqual(['başladı 0', 'başladı 1', 'bitti 0', 'bitti 1']);
  });

  it('element döngüde BİR kez seçilir (turda değil): 1v1 bir döngüde 2 tur, 2 seçim', async () => {
    const { io, log } = fakeIO();
    const e = duel();
    const stop = new AbortController();
    let plays = 0;
    io.play = async (r) => {
      log.reports.push(r);
      if (++plays === 4) stop.abort(); // iki döngü
    };
    await runBattle(e, io, { signal: stop.signal });
    // döngü 1: seç seç açıldı tur tur ; döngü 2: seç seç açıldı tur tur
    const picks = log.events.filter((x) => x.startsWith('seç'));
    expect(picks).toEqual(['seç 00', 'seç 10', 'seç 00', 'seç 10']);
    expect(log.events.filter((x) => x === 'açıldı')).toHaveLength(2);
    expect(log.events.indexOf('açıldı')).toBe(2);
    expect(log.events.slice(0, 3)).toEqual(['seç 00', 'seç 10', 'açıldı']);
    const turnIndexes = log.events.map((x, i) => (x.startsWith('tur ') ? i : -1)).filter((i) => i >= 0);
    expect(turnIndexes).toHaveLength(4);
    // ikinci turdan önce yeni seçim yok (aynı döngü), üçüncü turdan önce var
    expect(log.events.slice(turnIndexes[0] + 1, turnIndexes[1]).some((x) => x.startsWith('seç'))).toBe(false);
    expect(log.events.slice(turnIndexes[1] + 1, turnIndexes[2]).filter((x) => x.startsWith('seç'))).toHaveLength(2);
  });

  it('saldırı ve savunma AYNI element: ateşle saldıran o döngü ateşle savunur', async () => {
    const { io, log } = fakeIO({ element: (ref) => (ref.team === 0 ? 'fire' : 'water') });
    const e = duel();
    const stop = new AbortController();
    let plays = 0;
    io.play = async (r) => {
      log.reports.push(r);
      if (++plays === 2) stop.abort();
    };
    await runBattle(e, io, { signal: stop.signal });
    const [aTurn, bTurn] = log.reports; // A saldırır (B savunur), sonra B saldırır (A savunur)
    expect(aTurn.attackerElement).toBe('fire');
    expect(aTurn.defenderElement).toBe('water');
    expect(bTurn.attackerElement).toBe('water');
    expect(bTurn.defenderElement).toBe('fire'); // A, saldırıdaki elementiyle (ateş) savundu
    expect(aTurn.attackerElement).toBe(bTurn.defenderElement);
    expect(aTurn.defenderElement).toBe(bTurn.attackerElement);
  });

  it('her döngüde yeni element seçilebilir', async () => {
    const { io, log } = fakeIO({ element: (ref, n) => (ref.team === 0 ? (n === 0 ? 'fire' : 'air') : 'earth') });
    const e = duel();
    const stop = new AbortController();
    let plays = 0;
    io.play = async (r) => {
      log.reports.push(r);
      if (++plays === 4) stop.abort();
    };
    await runBattle(e, io, { signal: stop.signal });
    expect(log.reports.map((r) => r.attackerElement)).toEqual(['fire', 'earth', 'air', 'earth']);
    expect(log.rounds).toHaveLength(2);
    expect(log.rounds[0].map((c) => c.element)).toEqual(['fire', 'earth']);
    expect(log.rounds[1].map((c) => c.element)).toEqual(['air', 'earth']);
  });

  it('2v2: canlı herkes döngü başında bir kez seçer; ölenler seçmez', async () => {
    const { io, log } = fakeIO();
    const e = twoVsTwo();
    e.applyDamage({ team: 1, index: 1 }, 300); // B2 baştan ölü
    const stop = new AbortController();
    let plays = 0;
    io.play = async (r) => {
      log.reports.push(r);
      if (++plays === 3) stop.abort(); // ilk döngü: A1, A2, B1
    };
    await runBattle(e, io, { signal: stop.signal });
    expect(log.events.filter((x) => x.startsWith('seç')).sort()).toEqual(['seç 00', 'seç 01', 'seç 10']);
    expect(log.rounds[0].map((c) => `${c.ref.team}${c.ref.index}`).sort()).toEqual(['00', '01', '10']);
  });

  it('ölü savunanın yerine geçen takım arkadaşı, döngü başında seçtiği elementle savunur', async () => {
    const { io, log } = fakeIO({ element: (ref) => (ref.team === 1 ? (ref.index === 0 ? 'water' : 'earth') : 'fire') });
    const e = twoVsTwo();
    e.applyDamage({ team: 1, index: 0 }, 300); // B1 ölü; A1'in savunanı B2 olur
    const stop = new AbortController();
    io.play = async (r) => {
      log.reports.push(r);
      stop.abort();
    };
    await runBattle(e, io, { signal: stop.signal });
    expect(log.reports[0].action.defender).toEqual({ team: 1, index: 1 });
    expect(log.reports[0].defenderElement).toBe('earth');
  });

  it('hasar, savunma yokken saldırının tamamıdır ve can düşer', async () => {
    const { io, log } = fakeIO({ draw: (_r, role) => (role === 'attack' ? good() : invalid()) });
    const e = duel();
    e.applyDamage({ team: 1, index: 0 }, 295);
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

  it('element çarpanı hasara yansır: üstünlük ×1.25, dezavantaj ×0.75 (aynı döngüde iki yönde)', async () => {
    const run = async (a: Element, d: Element): Promise<[number, number]> => {
      const { io, log } = fakeIO({ element: (ref) => (ref.team === 0 ? a : d), draw: (_r, role) => (role === 'attack' ? good() : invalid()) });
      const e = duel();
      const stop = new AbortController();
      let plays = 0;
      io.play = async (r) => {
        log.reports.push(r);
        if (++plays === 2) stop.abort();
      };
      await runBattle(e, io, { signal: stop.signal });
      // Faz 3: iki saldırıda silüet farklı yerde durur; element etkisi bölge adımından sonra gelen çarpandır
      return [0, 1].map((i) => log.reports[i].breakdown!.afterElement / log.reports[i].breakdown!.afterRegion) as [number, number];
    };
    const [neutralA, neutralB] = await run('fire', 'earth'); // ateş-toprak etkisiz
    expect(neutralA).toBeCloseTo(1, 5);
    expect(neutralB).toBeCloseTo(1, 5);
    // A su, B ateş: A üstün (×1.25), B'nin saldırısı dezavantajlı (×0.75)
    const [aTurn, bTurn] = await run('water', 'fire');
    expect(aTurn).toBeCloseTo(1.25, 5);
    expect(bTurn).toBeCloseTo(0.75, 5);
  });

  it('ekipman döngü elementine göre: savunanın zırhı ve yüzük süresi seçilen büyüye göre hesaplanır', async () => {
    const calls: string[] = [];
    const gear = (el: Element) => {
      calls.push(el);
      return { armor: el === 'fire' ? 0.5 : 0, timeBonusSec: el === 'fire' ? 1 : 0, crit: 0, damageBonus: 0 };
    };
    const limits: number[] = [];
    const run = async (element: Element): Promise<number> => {
      const { io, log } = fakeIO({ element: () => element, draw: (_r, role) => (role === 'attack' ? good() : invalid()) });
      const orig = io.draw;
      io.draw = async (ref, role, ghost, limitSec) => {
        if (limitSec !== undefined) limits.push(limitSec);
        return orig(ref, role, ghost, limitSec);
      };
      const e = new BattleEngine([f('A', 0), { ...f('B', 1), gear }]);
      e.applyDamage({ team: 1, index: 0 }, 1);
      const stop = new AbortController();
      io.play = async (r) => {
        log.reports.push(r);
        stop.abort();
      };
      await runBattle(e, io, { signal: stop.signal });
      return log.reports[0].breakdown!.armorReduction;
    };
    expect(await run('fire')).toBeCloseTo(0.5);
    expect(await run('water')).toBe(0);
    expect(calls.every((c) => c === 'fire' || c === 'water')).toBe(true);
    expect(limits).toContain(3); // savunma elementi 'water': yüzük süresi yok
    expect(limits).toContain(4); // savunma elementi 'fire': +1 sn
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
      revealRound: async () => {},
      draw: async (ref, role, _g, _l, extras) => (role === 'attack' ? pick(ref).drawAttack(extras?.specialShape, extras?.target) : pick(ref).drawDefense(extras?.target)),
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
    // 25 tam savaş (özel şekil araması her saldırıda): ~4 sn sürüyor, varsayılan 5 sn sınırına çok yakın
  }, 60000);

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
    // 15 tam 2v2 savaşı: her saldırıda özel şekil 50 şablonla aranır; varsayılan 5 sn sınırı yavaş makinede yetmiyordu
  }, 60000);

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
