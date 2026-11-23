import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../world/rng';
import { runBattle, SPECIAL_SHAPE_BONUS, specialShapeFor, type BattleIO, type TurnReport } from '../flow/controller';
import { BattleEngine } from '../flow/engine';
import { SHAPE_LABELS, SHAPE_NAMES, buildShape } from '../flow/shapes';
import { Bot } from '../flow/bot';
import { analyzeStrokes } from './analyze';
import { MATCH_THRESHOLD, matchShape, matchShapeWithin, normalizeCloud, resample, shapeDistance, templateStrokes } from './shapeMatch';
import type { Stroke } from './types';

/** İnsan benzeri bozulma: titreme (yavaş dalga + rastgelelik), eksenlere farklı ölçek, hafif dönme, kayma */
const human = (strokes: Stroke[], amp: number, sx: number, sy: number, rot: number, seed: number): Stroke[] => {
  const r = mulberry32(seed);
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return strokes.map((st) =>
    st.map((p, i) => {
      const wob = Math.sin(i * 0.35 + seed) * amp;
      const x0 = (p.x - 128) * sx;
      const y0 = (p.y - 128) * sy;
      return { x: 128 + x0 * c - y0 * s + 15 + wob + (r() - 0.5) * amp, y: 128 + x0 * s + y0 * c - 10 + wob + (r() - 0.5) * amp, t: p.t };
    }),
  );
};

describe('şekil kütüphanesi', () => {
  it('50 farklı şekil, hepsinin Türkçe adı var ve hepsi geçerli bir büyü olarak çizilebilir', () => {
    expect(SHAPE_NAMES).toHaveLength(50);
    expect(new Set(SHAPE_NAMES).size).toBe(50);
    for (const n of SHAPE_NAMES) {
      expect(SHAPE_LABELS[n].length).toBeGreaterThan(0);
      const r = analyzeStrokes(buildShape(n, 128, 128, 75, 2200));
      expect(r.validity.valid, n).toBe(true);
      for (const s of r.strokes) for (const p of s) expect(p.x >= 0 && p.x <= 256 && p.y >= 0 && p.y <= 256).toBe(true);
    }
  });
});

describe('şekil tanıma', () => {
  it('örnekleme ve birimleme: nokta sayısı sabit, merkez 0, yarıçap 1', () => {
    const pts = normalizeCloud(resample(templateStrokes('circle')));
    expect(pts).toHaveLength(96);
    const cx = pts.reduce((m, p) => m + p.x, 0) / pts.length;
    const rms = Math.sqrt(pts.reduce((m, p) => m + p.x ** 2 + p.y ** 2, 0) / pts.length);
    expect(Math.abs(cx)).toBeLessThan(1e-9);
    expect(rms).toBeCloseTo(1, 6);
  });

  it('her şekil kendi şablonunu tanır: farklı boyut, konum ve hafif titremede', () => {
    for (const n of SHAPE_NAMES) {
      const drawn = human(buildShape(n, 128, 128, 75, 2200), 4, 0.7, 0.7, 0, 3);
      expect(matchShape(drawn, n).ok, `${n}: ${matchShape(drawn, n).distance.toFixed(3)}`).toBe(true);
    }
  });

  it('orta düzey elle bozulmada (en-boy farkı, ~6° dönme, titreme) şekillerin çoğu geçer', () => {
    let pass = 0;
    for (const n of SHAPE_NAMES) if (matchShape(human(buildShape(n, 128, 128, 75, 2200), 6, 0.85, 1.1, 0.1, 6), n).ok) pass++;
    expect(pass).toBeGreaterThanOrEqual(12);
  });

  it('farklı şekiller birbirine karışmaz: yalnızca birkaç yakın çift var', () => {
    const close: string[] = [];
    for (const a of SHAPE_NAMES) {
      for (const b of SHAPE_NAMES) {
        if (a === b) continue;
        if (shapeDistance(buildShape(a, 128, 128, 75, 2000), templateStrokes(b)) <= MATCH_THRESHOLD) close.push(`${a}/${b}`);
      }
    }
    expect(close.length).toBeLessThanOrEqual(24); // 36 şekilde 1260 çiftin en fazla ~%2'si eşiğin altında
    for (const a of SHAPE_NAMES) for (const b of SHAPE_NAMES) if (a !== b) expect(shapeDistance(buildShape(a, 128, 128, 75, 2000), templateStrokes(b))).toBeGreaterThan(0.085);
  });

  it('rastgele karalama ve boş çizim hiçbir şekle uymaz', () => {
    const r = mulberry32(9);
    const scribble: Stroke[] = [Array.from({ length: 200 }, (_, i) => ({ x: 70 + r() * 120, y: 70 + r() * 120, t: i * 10 }))];
    for (const n of SHAPE_NAMES) expect(matchShape(scribble, n).ok, n).toBe(false);
    expect(matchShape([], 'circle').ok).toBe(false);
    expect(matchShape([], 'circle').distance).toBe(Infinity);
  });

  it('yön önemlidir: ters çizilmiş (yukarı-aşağı) üçgen ve aynalanmış ok tanınmaz', () => {
    const flip = (strokes: Stroke[]): Stroke[] => strokes.map((s) => s.map((p) => ({ ...p, y: 256 - p.y })));
    expect(matchShape(flip(buildShape('triangle', 128, 128, 75, 2000)), 'triangle').ok).toBe(false);
    const mirror = (strokes: Stroke[]): Stroke[] => strokes.map((s) => s.map((p) => ({ ...p, x: 256 - p.x })));
    expect(matchShape(mirror(buildShape('arrow', 128, 128, 75, 2000)), 'arrow').ok).toBe(false);
  });
});

describe('özel büyü şekli: savaş akışı', () => {
  const none = () => analyzeStrokes([]);
  async function play(shapeDraw: (shape: (typeof SHAPE_NAMES)[number]) => Stroke[]) {
    const engine = new BattleEngine([
      { name: 'A', team: 0, control: 'bot' },
      { name: 'B', team: 1, control: 'bot' },
    ]);
    const reports: TurnReport[] = [];
    const stop = new AbortController();
    const io: BattleIO = {
      announceTurn: async () => {},
      chooseElement: async () => 'fire',
      revealRound: async () => {},
      draw: async (_r, role, _g, _l, extras) => (role === 'attack' ? analyzeStrokes(shapeDraw(extras!.specialShape!)) : none()),
      play: async (r) => void (reports.push(r), stop.abort()),
      announceEnd: async () => {},
    };
    await runBattle(engine, io, { signal: stop.signal, random: () => 0.99 });
    return reports[0];
  }

  it('her döngüde saldıran farklı bir şekil alır (zar atılmaz, aynı döngüde sabit)', () => {
    const seen = new Set<string>();
    for (let c = 1; c <= 16; c++) seen.add(specialShapeFor(c, { team: 0, index: 0 }));
    expect(seen.size).toBeGreaterThanOrEqual(12);
    expect(specialShapeFor(3, { team: 0, index: 0 })).toBe(specialShapeFor(3, { team: 0, index: 0 }));
    expect(specialShapeFor(3, { team: 1, index: 0 })).not.toBe(specialShapeFor(3, { team: 0, index: 0 }));
  });

  it('doğru şekil çizilirse hasar ×1.25 ve rapor "başarılı"; yanlışsa bonus yok', async () => {
    const ok = await play((s) => buildShape(s, 128, 128, 80, 2400));
    // 1. döngü, takım 0 saldıran: özel şekil dairenin dışında bir şekil; her zaman yanlış bir şekil çiz
    const wrongName = ok.specialShape === 'circle' ? 'star' : 'circle';
    const miss = await play(() => buildShape(wrongName, 128, 128, 80, 2400));
    expect(ok.specialOk).toBe(true);
    expect(ok.specialShape).toBeDefined();
    expect(ok.breakdown!.multiplierParts.some((p) => p.label === 'Özel büyü şekli' && p.value === SPECIAL_SHAPE_BONUS)).toBe(true);
    expect(miss.specialOk).toBe(false);
    expect(miss.breakdown!.multiplierParts.some((p) => p.label === 'Özel büyü şekli')).toBe(false);
    expect(miss.specialDistance!).toBeGreaterThan(MATCH_THRESHOLD);
  });
});

describe('bot özel şekli dener', () => {
  const rate = (skill: number) => {
    const bot = new Bot(mulberry32(7), skill);
    let ok = 0;
    let n = 0;
    for (let i = 0; i < 300; i++) {
      const name = SHAPE_NAMES[i % SHAPE_NAMES.length];
      const r = bot.drawAttack(name);
      if (!r.validity.valid) continue;
      n++;
      if (matchShape(r.strokes, name).ok) ok++;
    }
    return ok / n;
  };

  it('beceri arttıkça özel şekli daha sık ve daha doğru çizer', () => {
    expect(rate(0.9)).toBeGreaterThan(rate(0.2));
    expect(rate(0.9)).toBeGreaterThan(0.5);
    expect(rate(0.2)).toBeLessThan(0.6);
  });

  it('özel şekil verilmezse eskisi gibi rastgele şekil çizer', () => {
    expect(new Bot(mulberry32(2), 0.6).drawAttack().strokes.length).toBeGreaterThan(0);
  });
});

describe('çizimin içinde şekil arama', () => {
  it('şekil çizimin bir parçasıysa, ekstra çizgiler olsa da bulunur; karalama bulunmaz', () => {
    const extra: Stroke[] = [Array.from({ length: 60 }, (_, i) => ({ x: 200 + Math.cos(i / 5) * 25, y: 200 + Math.sin(i / 5) * 25, t: i * 10 }))];
    for (const n of SHAPE_NAMES) expect(matchShapeWithin([...buildShape(n, 100, 100, 55, 2000), ...extra], n).ok).toBe(true);
    const rand = mulberry32(3);
    const noise: Stroke[] = [Array.from({ length: 300 }, (_, i) => ({ x: 40 + rand() * 170, y: 40 + rand() * 170, t: i * 10 }))];
    for (const n of SHAPE_NAMES) expect(matchShapeWithin(noise, n).ok).toBe(false);
  });
});
