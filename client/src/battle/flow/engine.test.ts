import { describe, expect, it } from 'vitest';
import { MAX_HP } from './config';
import { BattleEngine, type Action, type FighterInit } from './engine';

const f = (name: string, team: 0 | 1): FighterInit => ({ name, team, control: 'bot' });
const duel = () => new BattleEngine([f('A', 0), f('B', 1)]);
const twoVsTwo = () => new BattleEngine([f('A1', 0), f('A2', 0), f('B1', 1), f('B2', 1)]);
const label = (a: Action | null): string => (a ? `${a.attacker.team}${a.attacker.index}>${a.defender.team}${a.defender.index}` : 'bitti');

/** Sıradaki `n` turu, hiç hasar vermeden okur. */
const take = (e: BattleEngine, n: number): string[] => Array.from({ length: n }, () => label(e.nextAction()));

describe('BattleEngine kurulum', () => {
  it('canlar dolu başlar, takım boyutları doğru', () => {
    const e = twoVsTwo();
    expect(e.teamSizes).toEqual([2, 2]);
    expect(e.all().every((x) => x.hp === MAX_HP)).toBe(true);
    expect(e.winner).toBeNull();
  });

  it('takım indeksleri sırayla atanır', () => {
    const e = twoVsTwo();
    expect(e.fighter({ team: 0, index: 1 }).name).toBe('A2');
    expect(e.fighter({ team: 1, index: 0 }).name).toBe('B1');
  });

  it('boş ya da 3 kişilik takımı reddeder', () => {
    expect(() => new BattleEngine([f('A', 0)])).toThrow();
    expect(() => new BattleEngine([f('A', 0), f('A2', 0), f('A3', 0), f('B', 1)])).toThrow();
  });

  it('özel can, güç ve çarpanlar alınır, verilmeyenler varsayılan', () => {
    const e = new BattleEngine([{ ...f('A', 0), maxHp: 50, armor: 0.2, dealtMultiplier: 1.3 }, f('B', 1)]);
    const a = e.fighter({ team: 0, index: 0 });
    expect(a).toMatchObject({ hp: 50, maxHp: 50, armor: 0.2, dealtMultiplier: 1.3, takenMultiplier: 1 });
  });
});

describe('tur sırası', () => {
  it('1v1: önce 0 saldırır 1 savunur, sonra 1 saldırır 0 savunur, tekrar', () => {
    expect(take(duel(), 4)).toEqual(['00>10', '10>00', '00>10', '10>00']);
  });

  it('2v2: T1-K1/T2-K1, T1-K2/T2-K2, sonra T2-K1/T1-K1, T2-K2/T1-K2', () => {
    expect(take(twoVsTwo(), 8)).toEqual(['00>10', '01>11', '10>00', '11>01', '00>10', '01>11', '10>00', '11>01']);
  });

  it('döngü sayacı her döngüde artar', () => {
    const e = duel();
    e.nextAction();
    expect(e.cycle).toBe(1);
    e.nextAction();
    expect(e.cycle).toBe(1);
    e.nextAction();
    expect(e.cycle).toBe(2);
  });

  it('1v2 gibi eşitsiz takımlar da çalışır', () => {
    const e = new BattleEngine([f('A', 0), f('B1', 1), f('B2', 1)]);
    expect(take(e, 3)).toEqual(['00>10', '10>00', '11>00']);
  });
});

describe('ölenler', () => {
  it('ölen savaşçının saldırı sırası atlanır (rakip dezavantajlı olmaz, sıra kaymaz)', () => {
    const e = twoVsTwo();
    e.applyDamage({ team: 0, index: 1 }, 9999); // A2 öldü
    expect(take(e, 6)).toEqual(['00>10', '10>00', '11>00', '00>10', '10>00', '11>00']);
  });

  it('savunmaya, karşıdaki ölmüşse hayatta kalan takım arkadaşı geçer', () => {
    const e = twoVsTwo();
    e.applyDamage({ team: 1, index: 1 }, 9999); // B2 öldü
    // A2 saldırır; karşısındaki B2 ölü, B1 savunur
    expect(take(e, 3)).toEqual(['00>10', '01>10', '10>00']);
  });

  it('sıra ortasında ölen saldırgan, sırası gelince atlanır', () => {
    const e = twoVsTwo();
    expect(label(e.nextAction())).toBe('00>10');
    e.applyDamage({ team: 0, index: 1 }, 9999); // A2, sırası gelmeden öldü
    expect(label(e.nextAction())).toBe('10>00'); // A2'nin '01>11' turu atlandı
  });

  it('can sıfırın altına inmez, yenilme yalnızca bir kez bildirilir', () => {
    const e = duel();
    const first = e.applyDamage({ team: 1, index: 0 }, 5000);
    expect(first).toMatchObject({ hpBefore: MAX_HP, hpAfter: 0, defeated: true });
    expect(e.applyDamage({ team: 1, index: 0 }, 10).defeated).toBe(false);
  });

  it('negatif ve kesirli hasar güvenli işlenir', () => {
    const e = duel();
    expect(e.applyDamage({ team: 0, index: 0 }, -50).hpAfter).toBe(MAX_HP);
    expect(e.applyDamage({ team: 0, index: 0 }, 10.6).hpAfter).toBe(MAX_HP - 11);
  });
});

describe('kazanan', () => {
  it('bir takımın tamamı ölünce diğeri kazanır ve nextAction null döner', () => {
    const e = duel();
    e.applyDamage({ team: 1, index: 0 }, 9999);
    expect(e.winner).toBe(0);
    expect(e.isOver).toBe(true);
    expect(e.nextAction()).toBeNull();
  });

  it('2v2: yalnızca bir kişi ölünce savaş sürer, ikisi ölünce biter', () => {
    const e = twoVsTwo();
    e.applyDamage({ team: 1, index: 0 }, 9999);
    expect(e.winner).toBeNull();
    e.applyDamage({ team: 1, index: 1 }, 9999);
    expect(e.winner).toBe(0);
  });

  it('aynı anda herkes ölürse berabere', () => {
    const e = duel();
    e.applyDamage({ team: 0, index: 0 }, 9999);
    e.applyDamage({ team: 1, index: 0 }, 9999);
    expect(e.winner).toBe('draw');
  });

  it('döngü sınırı dolunca can toplamı fazla olan kazanır, eşitse berabere', () => {
    const e = new BattleEngine([f('A', 0), f('B', 1)], { maxCycles: 2 });
    e.applyDamage({ team: 1, index: 0 }, 40);
    expect(take(e, 4)).toEqual(['00>10', '10>00', '00>10', '10>00']);
    expect(e.nextAction()).toBeNull(); // 3. döngü: sınır aşıldı
    expect(e.winner).toBe(0);

    const tie = new BattleEngine([f('A', 0), f('B', 1)], { maxCycles: 1 });
    take(tie, 2);
    expect(tie.nextAction()).toBeNull();
    expect(tie.winner).toBe('draw');
  });

  it('savaş bitince sıra kuyruğu sonsuz döngüye girmez', () => {
    const e = twoVsTwo();
    for (const ref of [{ team: 1, index: 0 }, { team: 1, index: 1 }] as const) e.applyDamage(ref, 9999);
    expect(e.nextAction()).toBeNull();
    expect(e.nextAction()).toBeNull();
  });
});
