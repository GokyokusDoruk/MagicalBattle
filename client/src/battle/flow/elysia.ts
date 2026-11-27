import { ELEMENTS, type Element } from '../damage/elements';
import { analyzeStrokes } from '../gesture/analyze';
import type { DrawingResult } from '../gesture/types';
import { Bot } from './bot';
import { SHAPE_NAMES, buildShape, scribbleShape, type ShapeName } from './shapes';
import { DEFAULT_POSE, type TargetPose } from '../damage/target';

/** Kişilik ayarları. Denge için ayarlanabilir. */
export const ELYSIA = {
  /** Sevdiği element (Rüzgâr Büyücüsü): sakinken bu elemente yönelir */
  favorite: 'air' as Element,
  /** Sakinken sevdiği elementi seçme olasılığı */
  favoriteChance: 0.55,
  /** Sinirliyken ateşe yönelme olasılığı (öfke ateşi) */
  angryFireChance: 0.4,
  /** Bu öfke düzeyinden sonra "sinirli" sayılır */
  angryThreshold: 0.5,
  /** Canının bu kadarını kaybetmek öfkeyi ne kadar artırır (çarpan) */
  angerPerHpFraction: 3,
  /** Her saldırısından sonra öfkenin kalan oranı (sakinleşme) */
  calmDown: 0.6,
  /** Savunma becerisinden öfke kadar düşülen en çok oran */
  maxDefensePenalty: 0.3,
} as const;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Elysia (yoldaş, Rüzgâr Büyücüsü): neşeli ama çabuk sinirlenen.
 *  - Sakinken çoğunlukla Hava seçer ve dengeli çizer.
 *  - Hasar yedikçe öfkesi artar. Sinirliyken Ateş'e de yönelir, daha büyük ve daha uzun çizer (güçlü vurur)
 *    ama savunmada dikkati dağılır, ara sıra büyüyü bozar. Her saldırıdan sonra yatışır.
 */
export class ElysiaBot extends Bot {
  private angerValue = 0;

  /** Öfke 0-1 */
  get anger(): number {
    return this.angerValue;
  }

  get mood(): 'cheerful' | 'angry' {
    return this.angerValue >= ELYSIA.angryThreshold ? 'angry' : 'cheerful';
  }

  override onDamaged(amount: number, maxHp: number): void {
    if (!(amount > 0) || !(maxHp > 0)) return;
    this.angerValue = clamp(this.angerValue + (amount / maxHp) * ELYSIA.angerPerHpFraction, 0, 1);
  }

  protected override defenseSkill(): number {
    return clamp(this.skill * (1 - ELYSIA.maxDefensePenalty * this.angerValue), 0.05, 1);
  }

  override chooseElement(): Element {
    const r = this.rand();
    if (this.mood === 'angry' && r < ELYSIA.angryFireChance) return 'fire';
    if (this.mood === 'cheerful' && r < ELYSIA.favoriteChance) return ELYSIA.favorite;
    if (this.mood === 'angry' && r < ELYSIA.angryFireChance + 0.35) return ELYSIA.favorite;
    // Kalanı rastgele
    return ELEMENTS[Math.floor(this.rand() * ELEMENTS.length)];
  }

  override drawAttack(special?: ShapeName, target: TargetPose = DEFAULT_POSE): DrawingResult {
    let result: DrawingResult;
    if (this.mood === 'angry') {
      // Öfkeli: büyük ve uzun çizim (silüetten taşar), ama hırsından büyüyü bozma ihtimali de yüksek
      const cx = target.cx + this.between(-14, 14);
      const cy = target.cy + this.between(-14, 14);
      const ms = this.between(2500, 2950);
      if (this.rand() < 0.1 + 0.1 * this.angerValue) {
        result = analyzeStrokes(scribbleShape(cx, cy, ms), ms);
      } else {
        const name = SHAPE_NAMES[Math.floor(this.rand() * SHAPE_NAMES.length)];
        result = analyzeStrokes(buildShape(name, cx, cy, this.between(56, 74) * target.scale, ms), ms);
      }
    } else {
      result = super.drawAttack(special, target);
    }
    this.angerValue *= ELYSIA.calmDown;
    return result;
  }
}
