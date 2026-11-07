import { describe, expect, it } from 'vitest';
import { buildDensity } from '../gesture/density';
import type { Stroke } from '../gesture/types';
import { defenseCoverage, matchDefense } from './defense';

const circle = (cx: number, cy: number, r: number, ms: number, n = 80): Stroke =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), t: (i / n) * ms };
  });

const arc = (cx: number, cy: number, r: number, from: number, to: number, ms: number, n = 60): Stroke =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = from + (i / n) * (to - from);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), t: (i / n) * ms };
  });

const line = (x0: number, y0: number, x1: number, y1: number, ms: number, n = 40): Stroke =>
  Array.from({ length: n + 1 }, (_, i) => ({ x: x0 + (x1 - x0) * (i / n), y: y0 + (y1 - y0) * (i / n), t: (i / n) * ms }));

const d = (...strokes: Stroke[]) => buildDensity(strokes);
const sum = (a: Float32Array): number => a.reduce((s, v) => s + v, 0);

describe('matchDefense', () => {
  const attack = d(circle(128, 128, 70, 2000));

  it('aynı çizimle savunma neredeyse tamamen savunur', () => {
    const r = matchDefense(attack, d(circle(128, 128, 70, 2000)));
    expect(r.defendedRatio).toBeGreaterThan(0.99);
    expect(r.unblockedWeight).toBeLessThan(0.02);
  });

  it('savunma yoksa (büyü yapılamadı) hiçbir şey savunulmaz, hepsi hasar verir', () => {
    const r = matchDefense(attack, null);
    expect(r.defendedRatio).toBe(0);
    expect(r.unblockedWeight).toBeCloseTo(r.totalAttackWeight, 5);
    expect(Array.from(r.unblocked)).toEqual(Array.from(attack.cells));
  });

  it('saldırıdan uzakta çizilen savunma işe yaramaz', () => {
    const r = matchDefense(attack, d(line(10, 20, 80, 20, 1000)));
    expect(r.defendedRatio).toBeLessThan(0.02);
  });

  it('saldırının yarısını kaplayan savunma yaklaşık yarısını savunur', () => {
    const half = d(arc(128, 128, 70, 0, Math.PI, 1500));
    const r = matchDefense(attack, half);
    expect(r.defendedRatio).toBeGreaterThan(0.4);
    expect(r.defendedRatio).toBeLessThan(0.6);
  });

  it('saldırının içinde kalan küçük savunma, büyük saldırının azını savunur', () => {
    const small = d(circle(128, 128, 20, 1500));
    expect(matchDefense(attack, small).defendedRatio).toBeLessThan(0.1);
  });

  it('küçük kayma cezalandırılmaz, büyük kayma cezalandırılır', () => {
    const near = matchDefense(attack, d(circle(132, 128, 70, 2000))).defendedRatio; // 4 birim = yarım hücre
    const far = matchDefense(attack, d(circle(128 + 60, 128, 70, 2000))).defendedRatio;
    expect(near).toBeGreaterThan(0.85);
    expect(far).toBeLessThan(0.5);
    expect(near).toBeGreaterThan(far);
  });

  it('savunmanın kendi hızı ya da süresi sonucu etkilemez, yalnızca kapladığı yer önemlidir', () => {
    const slow = matchDefense(attack, d(circle(128, 128, 70, 2900))).defendedRatio;
    const fast = matchDefense(attack, d(circle(128, 128, 70, 400))).defendedRatio;
    expect(slow).toBeCloseTo(fast, 5);
  });

  it('saldırıyı tamamen kaplayan geniş savunma %100 verir, fazlası hesaba katılmaz', () => {
    const wide = d(circle(128, 128, 70, 1000), circle(128, 128, 55, 1000), circle(128, 128, 85, 1000), circle(128, 128, 40, 1000));
    const r = matchDefense(attack, wide);
    expect(r.defendedRatio).toBeGreaterThan(0.99);
    expect(r.defendedRatio).toBeLessThanOrEqual(1);
  });

  it('saldırıda çok vakit harcanan nokta savunulmazsa hasarın büyük kısmı o noktadan gelir', () => {
    // Saldırı: soldan sağa çizgi, ortada 1,2 sn bekleme (ağırlık orada yoğun)
    const dwell: Stroke = [
      ...line(20, 128, 128, 128, 400, 20),
      ...Array.from({ length: 12 }, (_, k) => ({ x: 128, y: 128, t: 400 + (k + 1) * 100 })),
      ...line(128, 128, 236, 128, 400, 20).map((p) => ({ ...p, t: p.t + 1600 })),
    ];
    const atk = d(dwell);
    const coverEnds = d(line(20, 128, 100, 128, 600), line(156, 128, 236, 128, 600)); // ortayı boş bırakır
    const coverMiddle = d(line(100, 128, 156, 128, 600)); // yalnızca ortayı kapatır
    const rEnds = matchDefense(atk, coverEnds).defendedRatio;
    const rMiddle = matchDefense(atk, coverMiddle).defendedRatio;
    expect(rMiddle).toBeGreaterThan(rEnds); // az yer ama ağır nokta = daha çok savunma
    expect(rMiddle).toBeGreaterThan(0.6);
  });

  it('savunulan + savunulmayan = saldırı (her hücrede ve toplamda)', () => {
    const r = matchDefense(attack, d(arc(128, 128, 70, 0, 2.5, 1000)));
    for (let k = 0; k < attack.cells.length; k++) {
      expect(r.blocked[k] + r.unblocked[k]).toBeCloseTo(attack.cells[k], 5);
      expect(r.unblocked[k]).toBeGreaterThanOrEqual(0);
    }
    expect(sum(r.blocked) + sum(r.unblocked)).toBeCloseTo(sum(attack.cells), 4);
  });

  it('saldırıda ağırlık yoksa oran 0 döner (sıfıra bölme yok)', () => {
    const empty = d();
    const r = matchDefense(empty, d(circle(128, 128, 70, 1000)));
    expect(r.defendedRatio).toBe(0);
    expect(Number.isFinite(r.defendedRatio)).toBe(true);
  });
});

describe('defenseCoverage', () => {
  it('iz içinde 1, yumuşak payda azalır, uzakta 0', () => {
    const defense = d(line(128, 128, 140, 128, 300, 10));
    const cov = defenseCoverage(defense);
    const idx = (x: number, y: number) => Math.floor(y / 8) * 32 + Math.floor(x / 8);
    expect(cov[idx(134, 128)]).toBe(1);
    const nearEdge = cov[idx(134, 128 + 8 * 3)]; // iz kenarından birkaç hücre uzak
    expect(nearEdge).toBeGreaterThanOrEqual(0);
    expect(nearEdge).toBeLessThan(1);
    expect(cov[idx(10, 10)]).toBe(0);
  });

  it('savunma yoksa tamamen 0', () => {
    expect(defenseCoverage(null).every((v) => v === 0)).toBe(true);
  });
});
