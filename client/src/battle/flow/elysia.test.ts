import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../world/rng';
import { Bot } from './bot';
import { BattleEngine } from './engine';
import { ELYSIA, ElysiaBot } from './elysia';

const counts = (bot: ElysiaBot, n = 2000) => {
  const c: Record<string, number> = { fire: 0, water: 0, earth: 0, air: 0 };
  for (let i = 0; i < n; i++) c[bot.chooseElement()]++;
  return c;
};

describe('ElysiaBot: ruh hali', () => {
  it('neşeli başlar, öfkesi sıfır', () => {
    const e = new ElysiaBot(mulberry32(1));
    expect(e.anger).toBe(0);
    expect(e.mood).toBe('cheerful');
  });

  it('hasar yedikçe öfkelenir; canının üçte biri tek vuruşta sinirli yapar', () => {
    const e = new ElysiaBot(mulberry32(1));
    e.onDamaged(30, 300);
    expect(e.anger).toBeCloseTo(0.3, 6);
    expect(e.mood).toBe('cheerful');
    e.onDamaged(30, 300);
    expect(e.mood).toBe('angry');
    e.onDamaged(300, 300);
    expect(e.anger).toBe(1); // sınırlı
  });

  it('geçersiz hasar öfkeyi değiştirmez', () => {
    const e = new ElysiaBot(mulberry32(1));
    e.onDamaged(0, 300);
    e.onDamaged(-5, 300);
    e.onDamaged(10, 0);
    expect(e.anger).toBe(0);
  });

  it('her saldırıdan sonra yatışır', () => {
    const e = new ElysiaBot(mulberry32(2));
    e.onDamaged(300, 300);
    const before = e.anger;
    e.drawAttack();
    expect(e.anger).toBeCloseTo(before * ELYSIA.calmDown, 6);
    for (let i = 0; i < 5; i++) e.drawAttack();
    expect(e.mood).toBe('cheerful');
  });
});

describe('ElysiaBot: element seçimi', () => {
  it('sakinken en çok Hava seçer', () => {
    const c = counts(new ElysiaBot(mulberry32(3)));
    expect(c.air).toBeGreaterThan(c.fire);
    expect(c.air).toBeGreaterThan(c.water);
    expect(c.air).toBeGreaterThan(c.earth);
    expect(c.air / 2000).toBeGreaterThan(ELYSIA.favoriteChance - 0.08);
  });

  it('sinirliyken sakin hâline göre Ateş\'e daha çok yönelir', () => {
    const calm = counts(new ElysiaBot(mulberry32(4)));
    const angry = new ElysiaBot(mulberry32(4));
    angry.onDamaged(300, 300);
    const a = counts(angry, 1);
    expect(a.fire + a.water + a.earth + a.air).toBe(1);
    // her denemede öfke yatışmaz (yalnız saldırıda): öfkeyi koruyarak say
    const c2: Record<string, number> = { fire: 0, water: 0, earth: 0, air: 0 };
    for (let i = 0; i < 2000; i++) c2[angry.chooseElement()]++;
    expect(c2.fire).toBeGreaterThan(calm.fire);
  });

  it('her zaman geçerli bir element döndürür', () => {
    const e = new ElysiaBot(mulberry32(5));
    for (let i = 0; i < 200; i++) expect(['fire', 'water', 'earth', 'air']).toContain(e.chooseElement());
  });
});

describe('ElysiaBot: çizim', () => {
  const avgCoverage = (bot: ElysiaBot, n = 120) => {
    let sum = 0;
    let time = 0;
    for (let i = 0; i < n; i++) {
      const r = bot.drawAttack();
      sum += r.metrics.coverage;
      time += r.metrics.drawTimeSec;
    }
    return { coverage: sum / n, time: time / n };
  };

  it('sinirliyken daha büyük ve daha uzun çizer', () => {
    const calm = avgCoverage(new ElysiaBot(mulberry32(6)));
    const angry = new ElysiaBot(mulberry32(6));
    const sample = { cov: 0, time: 0, n: 0 };
    for (let i = 0; i < 120; i++) {
      angry.onDamaged(300, 300); // öfkeyi hep tam tut
      const r = angry.drawAttack();
      if (r.validity.valid) {
        sample.cov += r.metrics.coverage;
        sample.time += r.metrics.drawTimeSec;
        sample.n++;
      }
    }
    expect(sample.cov / sample.n).toBeGreaterThan(calm.coverage);
    expect(sample.time / sample.n).toBeGreaterThan(calm.time);
  });

  it('savunma becerisi öfkeyle düşer', () => {
    const e = new ElysiaBot(mulberry32(7), 0.8);
    const calm = (e as unknown as { defenseSkill: () => number }).defenseSkill();
    e.onDamaged(300, 300);
    const angry = (e as unknown as { defenseSkill: () => number }).defenseSkill();
    expect(angry).toBeLessThan(calm);
    expect(angry).toBeCloseTo(0.8 * (1 - ELYSIA.maxDefensePenalty), 6);
  });

  it('sıradan Bot hasara tepki vermez', () => {
    const b = new Bot(mulberry32(8), 0.5);
    expect(() => b.onDamaged(100, 300)).not.toThrow();
  });
});

describe('savaşçı kişiliği', () => {
  it('persona alanı Elysia için saklanır, diğerlerinde null', () => {
    const e = new BattleEngine([
      { name: 'Sen', team: 0, control: 'human' },
      { name: 'Elysia', team: 0, control: 'bot', persona: 'elysia' },
      { name: 'Rakip', team: 1, control: 'bot' },
    ]);
    expect(e.fighter({ team: 0, index: 1 }).persona).toBe('elysia');
    expect(e.fighter({ team: 0, index: 0 }).persona).toBeNull();
    expect(e.fighter({ team: 1, index: 0 }).persona).toBeNull();
  });
});
