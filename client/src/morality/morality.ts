import { MORAL_CHOICES, getChoice, type Side } from './catalog';

/** Puan sınırları ve kademe eşikleri (docs/hikaye.md bölüm 5). Denge için ayarlanabilir. */
export const MIN_SCORE = -100;
export const MAX_SCORE = 100;
export const TIER_THRESHOLDS = [20, 50, 80] as const;

export type Alignment = 'order' | 'neutral' | 'dark';
export type Tier = 0 | 1 | 2 | 3;

export const ALIGNMENT_NAMES: Record<Alignment, string> = {
  order: 'Düzen Bekçisi',
  neutral: 'Dengede',
  dark: 'Karanlık Büyücü',
};

/** Kademeye göre etkiler. Düzen Bekçisi indirim ve görev altını, Karanlık Büyücü satış değeri ve düşme oranı kazanır. */
const ORDER_BY_TIER = {
  buyDiscount: [0, 0.05, 0.1, 0.15],
  questGold: [0, 0.1, 0.2, 0.3],
} as const;
const DARK_BY_TIER = {
  sellBonus: [0, 0.05, 0.1, 0.15],
  dropRate: [0, 0.1, 0.2, 0.3],
} as const;

export interface MoralEffects {
  alignment: Alignment;
  tier: Tier;
  /** Tüccardan alırken fiyat çarpanı (1 = etkisiz, 0.9 = %10 indirim) */
  buyMultiplier: number;
  /** Tüccara satarken fiyat çarpanı (1.1 = +%10) */
  sellMultiplier: number;
  /** Görev altını çarpanı */
  questGoldMultiplier: number;
  /** Ganimet düşme oranı çarpanı (düşmanlardan ganimet gelince, Task 19) */
  dropRateMultiplier: number;
  /** Kısa etiket: "Düzen Bekçisi II" */
  label: string;
}

export const tierOf = (score: number): Tier => {
  const a = Math.abs(score);
  if (a >= TIER_THRESHOLDS[2]) return 3;
  if (a >= TIER_THRESHOLDS[1]) return 2;
  if (a >= TIER_THRESHOLDS[0]) return 1;
  return 0;
};

const ROMAN = ['', 'I', 'II', 'III'] as const;

/** Puandan etkiler: -19..+19 etkisiz; ±20, ±50, ±80 eşiklerinde güçlenir. */
export function effectsFor(score: number): MoralEffects {
  const tier = tierOf(score);
  if (tier === 0) {
    return { alignment: 'neutral', tier, buyMultiplier: 1, sellMultiplier: 1, questGoldMultiplier: 1, dropRateMultiplier: 1, label: ALIGNMENT_NAMES.neutral };
  }
  if (score > 0) {
    return {
      alignment: 'order',
      tier,
      buyMultiplier: 1 - ORDER_BY_TIER.buyDiscount[tier],
      sellMultiplier: 1,
      questGoldMultiplier: 1 + ORDER_BY_TIER.questGold[tier],
      dropRateMultiplier: 1,
      label: `${ALIGNMENT_NAMES.order} ${ROMAN[tier]}`,
    };
  }
  return {
    alignment: 'dark',
    tier,
    buyMultiplier: 1,
    sellMultiplier: 1 + DARK_BY_TIER.sellBonus[tier],
    questGoldMultiplier: 1,
    dropRateMultiplier: 1 + DARK_BY_TIER.dropRate[tier],
    label: `${ALIGNMENT_NAMES.dark} ${ROMAN[tier]}`,
  };
}

/** Final yolu: puan 0 ya da üstündeyse Düzen Bekçisi (Elysia ile 2v2), altındaysa Karanlık Büyücü (tek başına). */
export type FinalPath = 'order' | 'dark';
export const finalPathFor = (score: number): FinalPath => (score >= 0 ? 'order' : 'dark');

/** Her seçimin puanı: iyi +ağırlık, kötü -ağırlık */
export const choiceDelta = (id: string, side: Side): number => {
  const c = getChoice(id);
  if (!c) return 0;
  return side === 'good' ? c.good.weight : -c.bad.weight;
};

/**
 * Ahlak durumu. Puan ayrı saklanmaz: yapılan seçimlerden hesaplanır (kayıtta yalnızca seçimler tutulur),
 * böylece puan ile seçimler hiç tutarsız olmaz. Her seçim bir kez yapılır.
 */
export class Morality {
  private readonly made = new Map<string, Side>();
  private readonly listeners = new Set<() => void>();

  onChange(listener: () => void): void {
    this.listeners.add(listener);
  }

  private changed(): void {
    this.listeners.forEach((l) => l());
  }

  /** -100..+100 arasında sınırlı puan */
  get score(): number {
    let sum = 0;
    for (const [id, side] of this.made) sum += choiceDelta(id, side);
    return Math.max(MIN_SCORE, Math.min(MAX_SCORE, sum));
  }

  get effects(): MoralEffects {
    return effectsFor(this.score);
  }

  get finalPath(): FinalPath {
    return finalPathFor(this.score);
  }

  decided(id: string): Side | null {
    return this.made.get(id) ?? null;
  }

  /** Bilinmeyen ya da daha önce yapılmış seçim kabul edilmez. */
  choose(id: string, side: Side): boolean {
    if (!getChoice(id) || this.made.has(id)) return false;
    if (side !== 'good' && side !== 'bad') return false;
    this.made.set(id, side);
    this.changed();
    return true;
  }

  /** O bölümde henüz yapılmamış seçimler */
  pending(chapter: number): string[] {
    return MORAL_CHOICES.filter((c) => c.chapter === chapter && !this.made.has(c.id)).map((c) => c.id);
  }

  snapshot(): Record<string, Side> {
    return Object.fromEntries(this.made);
  }

  /** Kayıttan yükler; bilinmeyen kimlikler ve geçersiz değerler atılır. */
  restore(choices: Record<string, unknown> | undefined): void {
    this.made.clear();
    for (const [id, side] of Object.entries(choices ?? {})) {
      if (getChoice(id) && (side === 'good' || side === 'bad')) this.made.set(id, side);
    }
    this.changed();
  }
}
