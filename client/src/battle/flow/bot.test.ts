import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../world/rng';
import { ELEMENTS } from '../damage/elements';
import { analyzeStrokes } from '../gesture/analyze';
import { matchDefense } from '../match/defense';
import { Bot } from './bot';
import { SHAPE_NAMES, buildShape } from './shapes';

describe('şekiller', () => {
  it('her hazır şekil geçerli bir büyüdür (minimum hacmi geçer)', () => {
    for (const name of SHAPE_NAMES) {
      const r = analyzeStrokes(buildShape(name, 128, 128, 75, 2200));
      expect(r.validity.valid, name).toBe(true);
    }
  });

  it('zaman damgaları artan ve verilen süreyle biter', () => {
    const [stroke] = buildShape('circle', 128, 128, 70, 2000);
    expect(stroke[0].t).toBe(0);
    expect(stroke[stroke.length - 1].t).toBeCloseTo(2000);
    for (let i = 1; i < stroke.length; i++) expect(stroke[i].t).toBeGreaterThanOrEqual(stroke[i - 1].t);
  });

  it('tuval dışına taşmaz', () => {
    for (const name of SHAPE_NAMES) {
      for (const s of buildShape(name, 250, 250, 95, 1000)) {
        for (const p of s) {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThanOrEqual(256);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeLessThanOrEqual(256);
        }
      }
    }
  });
});

describe('analyzeStrokes', () => {
  it('çizgilerden geçerlilik, ölçüm ve yoğunluk üretir', () => {
    const r = analyzeStrokes(buildShape('circle', 128, 128, 70, 2000));
    expect(r.validity.valid).toBe(true);
    expect(r.metrics.coverage).toBeGreaterThan(0.05);
    expect(r.elapsedMs).toBeCloseTo(2000);
    expect(r.density.cells.some((v) => v > 0)).toBe(true);
  });

  it('boş çizim geçersizdir', () => {
    expect(analyzeStrokes([]).validity).toMatchObject({ valid: false, reason: 'EMPTY' });
  });

  it('girdiyi değiştirmez (kopya alır)', () => {
    const strokes = buildShape('wave', 128, 128, 60, 1500);
    const before = JSON.stringify(strokes);
    analyzeStrokes(strokes);
    expect(JSON.stringify(strokes)).toBe(before);
  });
});

describe('Bot', () => {
  it('aynı tohumla aynı kararları verir', () => {
    const a = new Bot(mulberry32(7));
    const b = new Bot(mulberry32(7));
    expect(a.chooseElement()).toBe(b.chooseElement());
    expect(a.drawAttack().strokes).toEqual(b.drawAttack().strokes);
  });

  it('element seçimi dört elemente de dağılır', () => {
    const bot = new Bot(mulberry32(1));
    const seen = new Set(Array.from({ length: 200 }, () => bot.chooseElement()));
    expect(seen.size).toBe(ELEMENTS.length);
  });

  it('saldırıların çoğu geçerli, ara sıra "büyü yapamadı" olur', () => {
    const bot = new Bot(mulberry32(3));
    const results = Array.from({ length: 300 }, () => bot.drawAttack());
    const invalid = results.filter((r) => !r.validity.valid).length;
    expect(invalid).toBeGreaterThan(2);
    expect(invalid).toBeLessThan(45);
  });

  it('saldırı süresi 3 saniyeyi aşmaz', () => {
    const bot = new Bot(mulberry32(4));
    for (let i = 0; i < 50; i++) expect(bot.drawAttack().elapsedMs).toBeLessThanOrEqual(3000);
  });

  const meanDefended = (skill: number, seed: number): number => {
    const bot = new Bot(mulberry32(seed), skill);
    const attacker = new Bot(mulberry32(seed + 100));
    let total = 0;
    let n = 0;
    for (let i = 0; i < 80; i++) {
      const atk = attacker.drawAttack();
      if (!atk.validity.valid) continue;
      const def = bot.drawDefense(atk.strokes);
      total += matchDefense(atk.density, def.validity.valid ? def.density : null).defendedRatio;
      n++;
    }
    return total / n;
  };

  it('becerili bot saldırıyı, beceriksizden belirgin şekilde daha çok savunur', () => {
    const good = meanDefended(0.95, 11);
    const bad = meanDefended(0.2, 11);
    expect(good).toBeGreaterThan(0.5);
    expect(bad).toBeLessThan(good - 0.15);
  });

  it('hiçbir bot kusursuz savunma yapmaz (her zaman biraz hasar geçer)', () => {
    expect(meanDefended(1, 21)).toBeLessThan(0.97);
  });

  it('saldırı bilinmiyorsa rastgele bir şekil çizer', () => {
    const r = new Bot(mulberry32(5)).drawDefense();
    expect(r.validity.valid).toBe(true);
  });

  it('savunma çizimi tuval içinde ve zaman damgaları sıralı', () => {
    const bot = new Bot(mulberry32(8), 0.1);
    const atk = new Bot(mulberry32(9)).drawAttack();
    const def = bot.drawDefense(atk.strokes);
    for (const s of def.strokes) {
      for (let i = 0; i < s.length; i++) {
        expect(s[i].x).toBeGreaterThanOrEqual(0);
        expect(s[i].x).toBeLessThanOrEqual(256);
        if (i > 0) expect(s[i].t).toBeGreaterThanOrEqual(s[i - 1].t);
      }
    }
  });
});
