import { describe, expect, it } from 'vitest';
import { DRAW_TIME_MS, GRID, IDLE_TIMEOUT_MS, LOGICAL_SIZE } from './config';
import { buildDensity } from './density';
import { computeMetrics, validateSpell } from './metrics';
import { DrawingSession } from './session';
import type { Stroke } from './types';

/** Merkez (cx, cy), yarıçap r olan daireyi `ms` sürede, `n` örnekle çizen çizgi. */
function circle(cx: number, cy: number, r: number, ms: number, n = 60): Stroke {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), t: (i / n) * ms };
  });
}

/** (x0,y0)'dan (x1,y1)'e düz çizgi. */
function line(x0: number, y0: number, x1: number, y1: number, ms: number, n = 40): Stroke {
  return Array.from({ length: n + 1 }, (_, i) => {
    const f = i / n;
    return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, t: f * ms };
  });
}

const analyze = (strokes: Stroke[]) => {
  const density = buildDensity(strokes);
  const metrics = computeMetrics(strokes, density);
  return { density, metrics, validity: validateSpell(metrics) };
};

const sum = (a: Float32Array): number => a.reduce((s, v) => s + v, 0);

describe('yoğunluk haritası', () => {
  it('toplam ağırlık çizim süresine eşittir', () => {
    const { density, metrics } = analyze([circle(128, 128, 60, 2000)]);
    // Her örnek aralığı 200ms sınırının altında olduğu için süre aynen korunur
    expect(sum(density.cells)).toBeCloseTo(2, 2);
    expect(metrics.drawTimeSec).toBeCloseTo(2, 2);
  });

  it('bir noktada fazla durmak o noktanın ağırlığını artırır (yavaş kısım daha önemli)', () => {
    // Aynı yol: soldan sağa. Birinde ortada 600 ms bekleniyor.
    const fast = line(20, 128, 236, 128, 1000);
    const dwell: Stroke = [
      ...line(20, 128, 128, 128, 500, 20),
      ...[0, 1, 2, 3, 4, 5].map((k) => ({ x: 128, y: 128, t: 500 + (k + 1) * 100 })),
      ...line(128, 128, 236, 128, 500, 20).map((p) => ({ ...p, t: p.t + 1100 })),
    ];
    const centerIdx = Math.floor(128 / (LOGICAL_SIZE / GRID)) + Math.floor(128 / (LOGICAL_SIZE / GRID)) * GRID;
    const a = buildDensity([fast]);
    const b = buildDensity([dwell]);
    expect(b.cells[centerIdx]).toBeGreaterThan(a.cells[centerIdx] * 3);
  });

  it('yavaş çizilen aynı yol, hızlıdan hücre başına daha ağırdır ama aynı alanı kaplar', () => {
    const slow = buildDensity([circle(128, 128, 60, 2400)]);
    const fastCircle = buildDensity([circle(128, 128, 60, 600)]);
    expect(Math.max(...slow.cells)).toBeGreaterThan(Math.max(...fastCircle.cells) * 2);
    expect(slow.ink).toEqual(fastCircle.ink);
  });

  it('tuval dışına taşan noktalar sınıra kırpılır, hata vermez', () => {
    const { density } = analyze([line(-50, -50, 400, 400, 500)]);
    expect(sum(density.cells)).toBeGreaterThan(0);
    expect(density.ink.length).toBe(GRID * GRID);
  });

  it('olay kaybıyla uzayan örnek aralığı ağırlığa 200 ms\'den fazla katılmaz', () => {
    const { metrics } = analyze([
      [
        { x: 10, y: 10, t: 0 },
        { x: 200, y: 200, t: 5000 },
      ],
    ]);
    expect(metrics.drawTimeSec).toBeCloseTo(0.2, 3);
  });
});

describe('minimum hacim kuralı', () => {
  it('hiç çizim yoksa EMPTY', () => {
    const { validity } = analyze([]);
    expect(validity).toMatchObject({ valid: false, reason: 'EMPTY' });
  });

  it('tek nokta (basılı tutma) büyü sayılmaz', () => {
    const dot: Stroke = Array.from({ length: 30 }, (_, i) => ({ x: 128, y: 128, t: i * 30 }));
    const { validity, metrics } = analyze([dot]);
    expect(validity).toMatchObject({ valid: false, reason: 'TOO_SMALL' });
    expect(metrics.width).toBe(0);
  });

  it('küçük karalama büyü sayılmaz', () => {
    const { validity } = analyze([circle(128, 128, 14, 800)]);
    expect(validity).toMatchObject({ valid: false, reason: 'TOO_SMALL' });
  });

  it('yeterince büyük daire geçerli', () => {
    const { validity, metrics } = analyze([circle(128, 128, 60, 1500)]);
    expect(validity.valid).toBe(true);
    expect(metrics.coverage).toBeGreaterThan(0.05);
  });

  it('hızlı çizilse bile büyük daire geçerli (alan hızdan bağımsız)', () => {
    expect(analyze([circle(128, 128, 60, 200)]).validity.valid).toBe(true);
  });

  it('uzun düz çizgi geçerli', () => {
    expect(analyze([line(20, 128, 236, 128, 1000)]).validity.valid).toBe(true);
  });

  it('kısa çizgi geçersiz', () => {
    expect(analyze([line(120, 128, 150, 128, 300)]).validity.valid).toBe(false);
  });

  it('küçük ama çok çizgili karalama, geniş değilse geçersiz kalır', () => {
    const scribble = [circle(128, 128, 12, 300), circle(140, 130, 12, 300), circle(120, 126, 12, 300)];
    expect(analyze(scribble).validity.valid).toBe(false);
  });

  it('ölçümler: sınır kutusu ve çizgi uzunluğu', () => {
    const { metrics } = analyze([line(20, 40, 220, 40, 1000)]);
    expect(metrics.width).toBeCloseTo(200, 3);
    expect(metrics.height).toBe(0);
    expect(metrics.pathLength).toBeCloseTo(200, 3);
  });
});

describe('DrawingSession', () => {
  it('ilk dokunuşta çizim süresi başlar, süre dolunca tur biter', () => {
    const s = new DrawingSession();
    s.start(0);
    expect(s.currentPhase).toBe('waiting');
    expect(s.remainingMs(1000)).toBe(DRAW_TIME_MS);
    s.pointerDown(20, 128, 1000);
    expect(s.currentPhase).toBe('drawing');
    expect(s.remainingMs(2000)).toBe(DRAW_TIME_MS - 1000);
    s.pointerMove(236, 128, 1500);
    s.tick(1000 + DRAW_TIME_MS);
    expect(s.currentPhase).toBe('finished');
  });

  it('süre dolduktan sonra gelen noktalar sayılmaz', () => {
    const s = new DrawingSession();
    s.start(0);
    s.pointerDown(20, 128, 0);
    s.pointerMove(120, 128, 1000);
    s.pointerMove(236, 128, DRAW_TIME_MS + 500); // süre bitti: yok sayılır, tur biter
    const r = s.finish(DRAW_TIME_MS + 500);
    expect(Math.max(...r.strokes[0].map((p) => p.x))).toBe(120); // 236'ya ulaşan geç nokta sayılmadı
    expect(r.strokes[0].every((p) => p.t <= DRAW_TIME_MS)).toBe(true);
    expect(r.elapsedMs).toBe(DRAW_TIME_MS);
  });

  it('hiç dokunulmazsa bekleme süresi dolunca boş ve geçersiz biter', () => {
    const s = new DrawingSession();
    s.start(0);
    s.tick(IDLE_TIMEOUT_MS - 1);
    expect(s.currentPhase).toBe('waiting');
    s.tick(IDLE_TIMEOUT_MS);
    expect(s.currentPhase).toBe('finished');
    const r = s.finish(IDLE_TIMEOUT_MS);
    expect(r.validity).toMatchObject({ valid: false, reason: 'EMPTY' });
    expect(r.elapsedMs).toBe(0);
  });

  it('tick, basılı tutulan noktaya örnek ekler (bekleme ağırlık kazandırır)', () => {
    const s = new DrawingSession();
    s.start(0);
    s.pointerDown(100, 100, 0);
    for (let t = 30; t <= 600; t += 30) s.tick(t);
    const r = s.finish(600);
    const idx = Math.floor(100 / (LOGICAL_SIZE / GRID)) * GRID + Math.floor(100 / (LOGICAL_SIZE / GRID));
    expect(r.density.cells[idx]).toBeGreaterThan(0);
    expect(r.metrics.drawTimeSec).toBeCloseTo(0.6, 2);
  });

  it('parmak kalkınca yeni çizgi başlatılabilir (çok çizgili büyü)', () => {
    const s = new DrawingSession();
    s.start(0);
    s.pointerDown(20, 60, 0);
    s.pointerMove(236, 60, 400);
    s.pointerUp(400);
    s.pointerDown(20, 190, 800);
    s.pointerMove(236, 190, 1200);
    const r = s.finish(1300);
    expect(r.strokes).toHaveLength(2);
    expect(r.validity.valid).toBe(true);
  });

  it('süre sonunda açık çizgi bitiş anına kadar uzatılır', () => {
    const s = new DrawingSession();
    s.start(0);
    s.pointerDown(30, 30, 0);
    s.pointerMove(130, 130, 500);
    const r = s.finish(DRAW_TIME_MS + 100);
    const last = r.strokes[0][r.strokes[0].length - 1];
    expect(last.t).toBe(DRAW_TIME_MS);
    expect(last.x).toBe(130);
  });

  it('bitince yeni olaylar etkisizdir ve finish aynı sonucu döndürür', () => {
    const s = new DrawingSession();
    s.start(0);
    s.pointerDown(20, 128, 0);
    s.pointerMove(236, 128, 500);
    const first = s.finish(600);
    s.pointerDown(0, 0, 700);
    s.pointerMove(5, 5, 800);
    expect(s.finish(900)).toBe(first);
    expect(first.strokes).toHaveLength(1);
  });

  it('koordinatları tuval sınırına kırpar', () => {
    const s = new DrawingSession();
    s.start(0);
    s.pointerDown(-30, 999, 0);
    const r = s.finish(10);
    expect(r.strokes[0][0]).toMatchObject({ x: 0, y: LOGICAL_SIZE });
  });
});
