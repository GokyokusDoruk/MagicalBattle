import { ELEMENTS, type Element } from '../damage/elements';
import { analyzeStrokes } from '../gesture/analyze';
import { LOGICAL_SIZE } from '../gesture/config';
import type { DrawingResult, Stroke } from '../gesture/types';
import { SHAPE_NAMES, buildShape, scribbleShape, type ShapeName } from './shapes';
import type { Stroke as BotStroke } from '../gesture/types';
import { DEFAULT_POSE, type TargetPose } from '../damage/target';


const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Düşmanın yapay zekâ ayarları (boss ve özel rakipler). Verilmeyen alan varsayılandır. */
export interface BotProfile {
  /** Savunma becerisi (0-1); verilmezse savaş ekranının genel bot becerisi */
  skill?: number;
  /** Element tercihleri (ağırlık). Verilmezse dört element eşit olasılıkla seçilir. */
  elements?: Partial<Record<Element, number>>;
  /** Saldırı büyüklüğü çarpanı (1 = normal); büyük çizim daha güçlü vurur */
  attackScale?: number;
}

/**
 * Bilgisayar rakibi (ve 2v2'de takım arkadaşı). Elementi rastgele seçer, hazır şekilleri biraz bozarak çizer.
 * `skill` 0-1: savunmada gelen saldırıyı ne kadar iyi kapattığı (yüksek = isabetli ve geniş).
 * Rastgelelik dışarıdan verilir, böylece testlerde ve tekrar izlemede aynı sonuç alınır.
 */
export class Bot {
  constructor(
    protected readonly rand: () => number = Math.random,
    readonly skill = 0.6,
    protected readonly profile: BotProfile = {},
  ) {}

  protected between(lo: number, hi: number): number {
    return lo + (hi - lo) * this.rand();
  }

  /** Çizgilere elle çizim titremesi ekler: yavaş dalga + küçük rastgelelik (`amp` mantıksal birim). */
  protected wobble(strokes: BotStroke[], amp: number): BotStroke[] {
    const phase = this.rand() * 6;
    return strokes.map((s) => s.map((p, i) => ({ x: p.x + Math.sin(i * 0.4 + phase) * amp * 0.6 + (this.rand() - 0.5) * amp, y: p.y + Math.cos(i * 0.37 + phase) * amp * 0.6 + (this.rand() - 0.5) * amp, t: p.t })));
  }

  /** Hasar yedikten sonra çağrılır (kişilikli botlar tepki verir). Varsayılan bot tepki vermez. */
  onDamaged(_amount: number, _maxHp: number): void {}

  /** Savunmada kullanılan etkin beceri; kişilikli botlarda ruh haline göre değişir. */
  protected defenseSkill(): number {
    return this.skill;
  }

  chooseElement(): Element {
    const weights = this.profile.elements;
    if (weights) {
      const entries = ELEMENTS.map((e) => [e, Math.max(0, weights[e] ?? 0)] as const).filter(([, w]) => w > 0);
      const total = entries.reduce((n, [, w]) => n + w, 0);
      if (total > 0) {
        let r = this.rand() * total;
        for (const [e, w] of entries) {
          r -= w;
          if (r < 0) return e;
        }
        return entries[entries.length - 1][0];
      }
    }
    return ELEMENTS[Math.floor(this.rand() * ELEMENTS.length)];
  }

  /**
   * Saldırı (Faz 3): rakibin silüetine nişan alır. Şekil silüetin gövdesine sığacak büyüklükte, göğüs hizasına çizilir; nişan hatası
   * beceri düştükçe artar (beceriksiz bot silüeti sıyırır ya da ıskalar). Ara sıra (≈%6) çok küçük bir karalama ("büyü yapamadı").
   */
  drawAttack(special?: ShapeName, target: TargetPose = DEFAULT_POSE): DrawingResult {
    const aim = 4 + 28 * (1 - this.skill);
    const cx = target.cx + this.between(-aim, aim);
    const cy = target.cy + 12 * target.scale + this.between(-aim, aim);
    const size = this.between(38, 56) * target.scale * (this.profile.attackScale ?? 1);
    const ms = this.between(1800, 2900);
    if (this.rand() < 0.06) return analyzeStrokes(scribbleShape(cx, cy, ms), ms);
    // Özel büyü şekli: bot beceriyle orantılı olarak denemeye çalışır (el titremesi beceri düştükçe artar)
    if (special && this.rand() < Math.min(0.9, 0.2 + 0.6 * this.skill)) {
      return analyzeStrokes(this.wobble(buildShape(special, cx, cy, size, ms), (1 - this.skill) * 7 + 1.5), ms);
    }
    const name = SHAPE_NAMES[Math.floor(this.rand() * SHAPE_NAMES.length)];
    return analyzeStrokes(buildShape(name, cx, cy, size, ms), ms);
  }

  /**
   * Savunma: bot oyuncunun saldırısını **görmez** (Task 53); ama kendi silüetinin nerede durduğunu bilir (Faz 3): rastgele bir şekli
   * silüetinin gövdesine çizer. Beceri, ne kadar isabetli ortaladığını ve şeklin genişliğini belirler.
   */
  drawDefense(target: TargetPose = DEFAULT_POSE): DrawingResult {
    const ms = this.between(1300, 2700);
    const name = SHAPE_NAMES[Math.floor(this.rand() * SHAPE_NAMES.length)];
    const skill = this.defenseSkill();
    const scale = 0.6 + 0.5 * skill;
    const spread = 14 + 36 * (1 - skill);
    const cx = target.cx + this.between(-spread, spread);
    const cy = target.cy + 10 * target.scale + this.between(-spread, spread);
    return analyzeStrokes(buildShape(name, cx, cy, this.between(40, 62) * target.scale * scale, ms), ms);
  }

  /**
   * Saldırıyı **gören** savunma (yalnızca denge simülasyonundaki oyuncu vekili kullanır; gerçek oyuncu saldırıyı kendi gözüyle görür). Gelen saldırı biliniyorsa onun bir kısmını (beceriye göre) taklit eder; kayma ve titreme beceri
   * düştükçe artar. Saldırı bilinmiyorsa (ya da ara sıra) rastgele bir şekil çizer.
   */
  drawDefenseSeeing(attack?: readonly Stroke[]): DrawingResult {
    const ms = this.between(1300, 2700);
    if (!attack || attack.length === 0 || this.rand() < 0.08) {
      const name = SHAPE_NAMES[Math.floor(this.rand() * SHAPE_NAMES.length)];
      return analyzeStrokes(buildShape(name, 128 + this.between(-20, 20), 128 + this.between(-20, 20), this.between(55, 90), ms), ms);
    }

    const skill = this.defenseSkill();
    const sloppy = 1 - skill;
    const keepFraction = clamp(0.12 + skill * 0.95 * (0.7 + 0.3 * this.rand()), 0.12, 1);
    // Faz 3: saldırılar silüete sığacak kadar küçük; kayma ve titreme de buna göre (eskiden 20 ve 9)
    const offX = sloppy * 12 * (this.rand() * 2 - 1);
    const offY = sloppy * 12 * (this.rand() * 2 - 1);
    const jitter = sloppy * 6;

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
