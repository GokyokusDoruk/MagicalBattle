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

/** Büyünün etkisi, bloklanan orana göre 5 kademe: çok etkisiz, etkisiz, normal, etkili, çok etkili. */
export type SpellEffect = 'veryWeak' | 'weak' | 'normal' | 'effective' | 'veryEffective';

/** Savunmayı geçen oran bu eşiklerin üstündeyse (üstten alta): çok etkili ≥%90, etkili ≥%70, normal ≥%45, etkisiz ≥%20, aksi çok etkisiz. */
export const EFFECT_THRESHOLDS = { veryEffective: 0.9, effective: 0.7, normal: 0.45, weak: 0.2 } as const;

/** Savunmanın ne kadarını geçtiğine göre büyünün etkisi. Savunma yapılamadıysa her zaman çok etkili. */
export function spellEffect(b: Pick<DamageBreakdown, 'unblockedRatio'>, defenseFailed: boolean): SpellEffect {
  if (defenseFailed || b.unblockedRatio >= EFFECT_THRESHOLDS.veryEffective) return 'veryEffective';
  if (b.unblockedRatio >= EFFECT_THRESHOLDS.effective) return 'effective';
  if (b.unblockedRatio >= EFFECT_THRESHOLDS.normal) return 'normal';
  return b.unblockedRatio >= EFFECT_THRESHOLDS.weak ? 'weak' : 'veryWeak';
}

export const EFFECT_LABELS: Record<SpellEffect, string> = {
  veryWeak: 'ÇOK ETKİSİZ SALDIRI',
  weak: 'ETKİSİZ SALDIRI',
  normal: 'NORMAL SALDIRI',
  effective: 'ETKİLİ SALDIRI',
  veryEffective: 'ÇOK ETKİLİ SALDIRI',
};

/** Bloklanan oran, yüzde olarak (savunma yapılamadıysa 0). */
export function blockedPercent(b: Pick<DamageBreakdown, 'unblockedRatio'>, defenseFailed: boolean): number {
  return defenseFailed ? 0 : Math.round((1 - b.unblockedRatio) * 100);
}

const factorText = (m: number): string => `×${Math.round(m * 100) / 100}`;

/**
 * Hasarın nasıl hesaplandığı. Etkisi olmayan adımlar (×1) atlanır; her satırda o adımdan sonraki değer yazar.
 * Örnek: Büyü gücü 100 → Toprak üstün ×1.5 = 150.
 */
export function explainDamage(b: DamageBreakdown, attackerElement: Element, defenseFailed: boolean): ExplainRow[] {
  const rows: ExplainRow[] = [{ label: 'Büyü gücü (alan ve süre)', factor: '', value: Math.round(b.powerBeforeQuality) }];
  if (b.attackQuality < 0.995) {
    rows.push({ label: 'Çizim kalitesi (karalama / dağılım)', factor: factorText(b.attackQuality), value: Math.round(b.power) });
  }
  if (!defenseFailed) {
    if (b.defenseStrength < 0.99) {
      rows.push({ label: 'Savunma inceldi (karalama / fazla kaplama)', factor: factorText(b.defenseStrength), value: Math.round(b.power) });
    }
    rows.push({ label: 'Savunmayı geçen', factor: `%${Math.round(b.unblockedRatio * 100)}`, value: Math.round(b.power * b.unblockedRatio) });
  }
  if (b.headShare > 0.5 && b.weightedUnblockedRatio > b.unblockedRatio) {
    rows.push({ label: 'Baş vuruşu', factor: factorText(b.weightedUnblockedRatio / (b.unblockedRatio || 1)), value: Math.round(b.afterRegion) });
  }
  if (b.elementMultiplier !== 1) {
    const rel = b.elementMultiplier > 1 ? 'üstün' : 'zayıf';
    rows.push({ label: `${ELEMENT_NAMES[attackerElement]} ${rel}`, factor: factorText(b.elementMultiplier), value: Math.round(b.afterElement), element: true });
  }
  if (b.multiplierParts.length > 0) {
    // Her kaynağı ayrı satır: ekipman, kuşanılan eşyalar, yetenekler (değerler art arda çarpılarak ilerler)
    let running = b.afterElement;
    for (const p of b.multiplierParts) {
      running *= p.value;
      rows.push({ label: p.label, factor: factorText(p.value), value: Math.round(running) });
    }
  } else if (Math.abs(b.skillMultiplier - 1) > 0.005) {
    rows.push({ label: 'Yetenek ve ekipman', factor: factorText(b.skillMultiplier), value: Math.round(b.afterSkills) });
  }
  if (b.critical) rows.push({ label: 'KRİTİK vuruş', factor: factorText(b.critMultiplier), value: Math.round(b.afterCrit) });
  if (b.armorReduction > 0.005) {
    rows.push({ label: 'Zırh', factor: `−%${Math.round(b.armorReduction * 100)}`, value: Math.round(b.afterArmor) });
  }
  return rows;
}
