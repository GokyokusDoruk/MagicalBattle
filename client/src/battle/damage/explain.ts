import { ELEMENT_NAMES, type Element } from './elements';
import type { DamageBreakdown } from './calculate';

/** Hasar hesabının oyuncuya gösterilen adımları: "Toprak üstün ×1.5 = 150" gibi, kısa ve sıralı. */
export interface ExplainRow {
  label: string;
  /** Çarpan ya da oran yazısı ("×1.5", "%60 geçti"), yoksa boş */
  factor: string;
  /** Bu adımdan sonraki değer */
  value: number;
  /** Rengi elementinkiyle boyanacak satır mı (element adımı) */
  element?: boolean;
}

export type SpellEffect = 'effective' | 'medium' | 'weak';

/** Savunmayı geçen oran bu değerin üstündeyse büyü "etkili", altındaysa "orta", çok altındaysa "etkisiz". */
export const EFFECTIVE_AT = 0.6;
export const MEDIUM_AT = 0.3;

/** Savunmanın ne kadarını geçtiğine göre büyünün etkisi. Savunma yapılamadıysa her zaman etkili. */
export function spellEffect(b: Pick<DamageBreakdown, 'unblockedRatio'>, defenseFailed: boolean): SpellEffect {
  if (defenseFailed || b.unblockedRatio >= EFFECTIVE_AT) return 'effective';
  return b.unblockedRatio >= MEDIUM_AT ? 'medium' : 'weak';
}

export const EFFECT_LABELS: Record<SpellEffect, string> = {
  effective: 'ETKİLİ BÜYÜ',
  medium: 'ORTA HASAR',
  weak: 'ETKİSİZ BÜYÜ',
};

const factorText = (m: number): string => `×${Math.round(m * 100) / 100}`;

/**
 * Hasarın nasıl hesaplandığı. Etkisi olmayan adımlar (×1) atlanır; her satırda o adımdan sonraki değer yazar.
 * Örnek: Büyü gücü 100 → Toprak üstün ×1.5 = 150.
 */
export function explainDamage(b: DamageBreakdown, attackerElement: Element, defenseFailed: boolean): ExplainRow[] {
  const rows: ExplainRow[] = [{ label: 'Büyü gücü', factor: '', value: Math.round(b.power) }];
  if (!defenseFailed) {
    rows.push({ label: 'Savunmayı geçen', factor: `%${Math.round(b.unblockedRatio * 100)}`, value: Math.round(b.power * b.unblockedRatio) });
  }
  if (b.headShare > 0.5 && b.weightedUnblockedRatio > b.unblockedRatio) {
    rows.push({ label: 'Baş vuruşu', factor: factorText(b.weightedUnblockedRatio / (b.unblockedRatio || 1)), value: Math.round(b.afterRegion) });
  }
  if (b.elementMultiplier !== 1) {
    const rel = b.elementMultiplier > 1 ? 'üstün' : 'zayıf';
    rows.push({ label: `${ELEMENT_NAMES[attackerElement]} ${rel}`, factor: factorText(b.elementMultiplier), value: Math.round(b.afterElement), element: true });
  }
  if (Math.abs(b.skillMultiplier - 1) > 0.005) {
    rows.push({ label: 'Yetenek ve ekipman', factor: factorText(b.skillMultiplier), value: Math.round(b.afterSkills) });
  }
  if (b.critical) rows.push({ label: 'KRİTİK vuruş', factor: factorText(b.critMultiplier), value: Math.round(b.afterCrit) });
  if (b.armorReduction > 0.005) {
    rows.push({ label: 'Zırh', factor: `−%${Math.round(b.armorReduction * 100)}`, value: Math.round(b.afterArmor) });
  }
  return rows;
}
