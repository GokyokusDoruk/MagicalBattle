import { MORAL_CHOICES, getChoice, type Side } from './catalog';

/** Puan sınırları ve kademe eşikleri (docs/hikaye.md bölüm 5). Denge için ayarlanabilir. */
export const MIN_SCORE = -100;
export const MAX_SCORE = 100;
export const TIER_THRESHOLDS = [20, 50, 80] as const;

export type Alignment = 'order' | 'neutral' | 'dark';
export type Tier = 0 | 1 | 2 | 3;

export const ALIGNMENT_NAMES: Record<Alignment, string> = {
  order: 'Ak Büyücü',
  neutral: 'Dengede',
  dark: 'Kara Büyücü',
};

/**
 * İbreye göre etkiler (Faz 2): ibre ne kadar uca kayarsa bonus o kadar artar (kademesiz, doğrusal). En uçta (±100):
 * - Ak büyücü (iyi): görev ödülleri +%50, tüccarda (eşya, asa, iksir) %25 indirim.
 * - Kara büyücü (kötü): eşya ve asa düşme şansı +%50, tüccara satışta +%15.
 */
export const MORAL_MAX = {
  questGold: 0.5,
  buyDiscount: 0.25,
  dropRate: 0.5,
  sellBonus: 0.15,
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

/** İbrenin konumu: -1 (tam kara) ile +1 (tam ak) arası. */
export const needleOf = (score: number): number => Math.max(-1, Math.min(1, score / MAX_SCORE));

const r2 = (v: number): number => Math.round(v * 1000) / 1000;

/** Puandan etkiler: bonuslar ibreyle doğrusal artar; kademe ve ad (±20, ±50, ±80) yalnızca etiket ve final içindir. */
export function effectsFor(score: number): MoralEffects {
  const tier = tierOf(score);
  const n = needleOf(score);
  const good = Math.max(0, n);
  const bad = Math.max(0, -n);
  const alignment: Alignment = tier === 0 ? 'neutral' : score > 0 ? 'order' : 'dark';
  return {
    alignment,
    tier,
    buyMultiplier: r2(1 - MORAL_MAX.buyDiscount * good),
    sellMultiplier: r2(1 + MORAL_MAX.sellBonus * bad),
    questGoldMultiplier: r2(1 + MORAL_MAX.questGold * good),
    dropRateMultiplier: r2(1 + MORAL_MAX.dropRate * bad),
    label: tier === 0 ? ALIGNMENT_NAMES.neutral : `${ALIGNMENT_NAMES[alignment]} ${ROMAN[tier]}`,
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

/** İbrenin şu anki bonuslarının kısa açıklaması (durum panelinde ibrenin altında). */
export function moralBonusText(e: Pick<MoralEffects, 'buyMultiplier' | 'sellMultiplier' | 'questGoldMultiplier' | 'dropRateMultiplier'>): string {
  const pct = (v: number): number => Math.round(Math.abs(v) * 100);
  const parts: string[] = [];
  if (e.questGoldMultiplier > 1) parts.push(`Görev ödülü +%${pct(e.questGoldMultiplier - 1)}`);
  if (e.buyMultiplier < 1) parts.push(`Tüccarda %${pct(1 - e.buyMultiplier)} indirim`);
  if (e.dropRateMultiplier > 1) parts.push(`Ganimet şansı +%${pct(e.dropRateMultiplier - 1)}`);
  if (e.sellMultiplier > 1) parts.push(`Satış +%${pct(e.sellMultiplier - 1)}`);
  return parts.length ? parts.join(' · ') : 'İbre ortada: bonus yok';
}
