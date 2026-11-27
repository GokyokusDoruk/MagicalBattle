import { TARGET_SCALE, clampPose } from '../damage/target';
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

  /** Bot saldırıyı görmediği için savunması rastgele bir şekildir; ortalama blok oranı "şans eseri" kalır. */
  const meanDefended = (skill: number, seed: number): number => {
    const bot = new Bot(mulberry32(seed), skill);
    const attacker = new Bot(mulberry32(seed + 100));
    let total = 0;
    let n = 0;
    for (let i = 0; i < 200; i++) {
      const atk = attacker.drawAttack();
      if (!atk.validity.valid) continue;
      const def = bot.drawDefense();
      total += matchDefense(atk.density, def.validity.valid ? def.density : null).defendedRatio;
      n++;
    }
    return total / n;
  };

  it('bot saldırıyı görmeden savunur: ortalama blok orta düzeyde kalır, bazen çok kötü bazen iyi', () => {
    const avg = meanDefended(0.6, 11);
    expect(avg).toBeGreaterThan(0.1);
    expect(avg).toBeLessThan(0.75);
  });

  it('savunma, saldırıdan bağımsızdır: aynı tohumla farklı saldırılara aynı savunma çizilir', () => {
    const a = new Bot(mulberry32(3), 0.9).drawDefense();
    const b = new Bot(mulberry32(3), 0.9).drawDefense();
    expect(a.strokes).toEqual(b.strokes);
  });

  it('beceri, kendi silüetini isabetli korumayı sağlar ama saldırıyı görmeden tamamen kapatamaz (Faz 3)', () => {
    const good = meanDefended(1, 21);
    const bad = meanDefended(0, 21);
    expect(good).toBeLessThan(0.9);
    expect(good).toBeGreaterThan(bad);
  });

  it('bot yer seçerken kukla duruşunu da rastgele seçer, boyu sabit kalır', () => {
    const bot = new Bot(mulberry32(4), 0.5);
    const poses = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const p = bot.choosePosition();
      poses.add(p.pose ?? 0);
      expect(p.scale).toBe(TARGET_SCALE);
    }
    expect(poses.size).toBeGreaterThan(30);
  });

  it('silüeti görmeyen bot (Normal, Zor) körlemesine tuvalin ortasına yakın çizer', () => {
    const bot = new Bot(mulberry32(12), 0.9);
    const xs: number[] = [];
    for (let i = 0; i < 30; i++) {
      const pts = bot.drawAttack().strokes.flat();
      xs.push(pts.reduce((a, p) => a + p.x, 0) / Math.max(1, pts.length));
    }
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean).toBeGreaterThan(100);
    expect(mean).toBeLessThan(156);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(40); // nereye gideceği belli değil
  });

  it('saldırı rakibin silüetine nişan alır: silüet nerede ise çizim oraya gider (Faz 3)', () => {
    const left = clampPose({ cx: 0, cy: 128, pose: 0 });
    const right = clampPose({ cx: 256, cy: 128, pose: 0 });
    const centre = (r: { strokes: { x: number }[][] }): number => {
      const xs = r.strokes.flat().map((p) => p.x);
      return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    };
    const bot = new Bot(mulberry32(9), 0.8);
    for (let i = 0; i < 10; i++) {
      expect(centre(bot.drawAttack(undefined, left))).toBeLessThan(110);
      expect(centre(bot.drawAttack(undefined, right))).toBeGreaterThan(146);
    }
  });

  it('savunma geçerli, rastgele bir şekildir', () => {
    const r = new Bot(mulberry32(5)).drawDefense();
    expect(r.validity.valid).toBe(true);
  });

  it('savunma çizimi tuval içinde ve zaman damgaları sıralı', () => {
    const bot = new Bot(mulberry32(8), 0.1);
    const def = bot.drawDefense();
    for (const s of def.strokes) {
      for (let i = 0; i < s.length; i++) {
        expect(s[i].x).toBeGreaterThanOrEqual(0);
        expect(s[i].x).toBeLessThanOrEqual(256);
        if (i > 0) expect(s[i].t).toBeGreaterThanOrEqual(s[i - 1].t);
      }
    }
  });
});
