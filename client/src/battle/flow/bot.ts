import { ELEMENTS, type Element } from '../damage/elements';
import { analyzeStrokes } from '../gesture/analyze';
import { LOGICAL_SIZE } from '../gesture/config';
import type { DrawingResult, Stroke } from '../gesture/types';
import { SHAPE_NAMES, buildShape, scribbleShape } from './shapes';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Bilgisayar rakibi (ve 2v2'de takım arkadaşı). Elementi rastgele seçer, hazır şekilleri biraz bozarak çizer.
 * `skill` 0-1: savunmada gelen saldırıyı ne kadar iyi kapattığı (yüksek = isabetli ve geniş).
 * Rastgelelik dışarıdan verilir, böylece testlerde ve tekrar izlemede aynı sonuç alınır.
 */
export class Bot {
  constructor(
    private readonly rand: () => number = Math.random,
    readonly skill = 0.6,
  ) {}

  private between(lo: number, hi: number): number {
    return lo + (hi - lo) * this.rand();
  }

  chooseElement(): Element {
    return ELEMENTS[Math.floor(this.rand() * ELEMENTS.length)];
  }

  /** Saldırı: rastgele bir şekil, ara sıra (≈%6) çok küçük bir karalama ("büyü yapamadı"). */
  drawAttack(): DrawingResult {
    const cx = LOGICAL_SIZE / 2 + this.between(-18, 18);
    const cy = LOGICAL_SIZE / 2 + this.between(-18, 18);
    const ms = this.between(1800, 2900);
    if (this.rand() < 0.06) return analyzeStrokes(scribbleShape(cx, cy, ms), ms);
    const name = SHAPE_NAMES[Math.floor(this.rand() * SHAPE_NAMES.length)];
    return analyzeStrokes(buildShape(name, cx, cy, this.between(58, 92), ms), ms);
  }

  /**
   * Savunma: gelen saldırı biliniyorsa onun bir kısmını (beceriye göre) taklit eder; kayma ve titreme beceri
   * düştükçe artar. Saldırı bilinmiyorsa (ya da ara sıra) rastgele bir şekil çizer.
   */
  drawDefense(attack?: readonly Stroke[]): DrawingResult {
    const ms = this.between(1300, 2700);
    if (!attack || attack.length === 0 || this.rand() < 0.08) {
      const name = SHAPE_NAMES[Math.floor(this.rand() * SHAPE_NAMES.length)];
      return analyzeStrokes(buildShape(name, 128 + this.between(-20, 20), 128 + this.between(-20, 20), this.between(55, 90), ms), ms);
    }

    const sloppy = 1 - this.skill;
    const keepFraction = clamp(0.12 + this.skill * 0.85 * (0.6 + 0.4 * this.rand()), 0.12, 1);
    const offX = sloppy * 20 * (this.rand() * 2 - 1);
    const offY = sloppy * 20 * (this.rand() * 2 - 1);
    const jitter = sloppy * 9;

    const strokes: Stroke[] = [];
    for (const stroke of attack) {
      if (stroke.length < 2) continue;
      const keep = Math.max(2, Math.ceil(stroke.length * keepFraction));
      const start = Math.floor(this.rand() * (stroke.length - keep + 1));
      const slice = stroke.slice(start, start + keep);
      const t0 = slice[0].t;
      const span = Math.max(1, slice[slice.length - 1].t - t0);
      strokes.push(
        slice.map((p) => ({
          x: clamp(p.x + offX + (this.rand() * 2 - 1) * jitter, 0, LOGICAL_SIZE),
          y: clamp(p.y + offY + (this.rand() * 2 - 1) * jitter, 0, LOGICAL_SIZE),
          t: ((p.t - t0) / span) * ms,
        })),
      );
    }
    return analyzeStrokes(strokes, ms);
  }
}
