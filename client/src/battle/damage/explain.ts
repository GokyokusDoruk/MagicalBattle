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

/** Büyünün etkisi, verilen hasara göre 5 kademe: çok etkisiz, etkisiz, normal, etkili, çok etkili. */
export type SpellEffect = 'veryWeak' | 'weak' | 'normal' | 'effective' | 'veryEffective';

/**
 * Faz 1: etki **hasara göre** belirlenir. Ölçü, verilen hasarın saldıranın taban gücüne (asa dahil) oranıdır: savunmasız,
 * tam güçlü bir büyü ~%100, ortalama savunmasız vuruş ~%80 verir. Eşikler (üstten alta): çok etkili ≥%75, etkili ≥%50,
 * normal ≥%30, etkisiz ≥%12, aksi (hasar yoksa da) çok etkisiz.
 */
export const EFFECT_THRESHOLDS = { veryEffective: 0.75, effective: 0.5, normal: 0.3, weak: 0.12 } as const;

/** Hasarın taban güce oranı (0 ve üstü). Taban güç, çizim gücünden geri hesaplanır. */
export function damageRatio(b: Pick<DamageBreakdown, 'finalDamage' | 'powerBeforeQuality' | 'powerFactor'>): number {
  const base = b.powerFactor.total > 0 ? b.powerBeforeQuality / b.powerFactor.total : 0;
  return base > 0 ? Math.max(0, b.finalDamage) / base : 0;
}

/** Verilen hasara göre büyünün etkisi. */
export function spellEffect(b: Pick<DamageBreakdown, 'finalDamage' | 'powerBeforeQuality' | 'powerFactor'>): SpellEffect {
  const r = damageRatio(b);
  if (r >= EFFECT_THRESHOLDS.veryEffective) return 'veryEffective';
  if (r >= EFFECT_THRESHOLDS.effective) return 'effective';
  if (r >= EFFECT_THRESHOLDS.normal) return 'normal';
  return r >= EFFECT_THRESHOLDS.weak ? 'weak' : 'veryWeak';
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
  const pf = b.powerFactor;
  const base = pf.total > 0 ? b.powerBeforeQuality / pf.total : 0;
  const rows: ExplainRow[] = [];
  // Faz 3: güç adım adım: büyüklük ve süre, şekil isabeti, özel şekil, karalama
  let running = base * pf.size * pf.effort;
  rows.push({ label: 'Büyü gücü (büyüklük ve süre)', factor: '', value: Math.round(running) });
  if (pf.shape < 0.995) {
    running *= pf.shape;
    rows.push({ label: 'Şekil isabeti', factor: factorText(pf.shape), value: Math.round(running) });
  }
  if (pf.special > 1) {
    running *= pf.special;
    rows.push({ label: 'Özel şekil tuttu', factor: factorText(pf.special), value: Math.round(running) });
  }
  if (b.attackQuality < 0.995) {
    rows.push({ label: 'Karalama (aynı yere üst üste)', factor: factorText(b.attackQuality), value: Math.round(b.power) });
  }
  if (!defenseFailed) {
    if (b.defenseStrength < 0.99) {
      rows.push({ label: 'Savunma inceldi (karalama / fazla kaplama)', factor: factorText(b.defenseStrength), value: Math.round(b.power) });
    }
    rows.push({ label: 'Savunmayı geçen', factor: `%${Math.round(b.unblockedRatio * 100)}`, value: Math.round(b.power * b.unblockedRatio) });
  }
  // Silüete isabet: baş ×1.25, gövde ×1, sıyırma ×0.2, ıska ×0.1 (savunmayı geçen kısma göre)
  if (b.unblockedRatio > 0 && Math.abs(b.weightedUnblockedRatio / b.unblockedRatio - 1) > 0.005) {
    const z = b.zoneShares;
    const pct = (v: number): number => Math.round(v * 100);
    const where = [z.head > 0.005 ? `baş %${pct(z.head)}` : '', z.body > 0.005 ? `gövde %${pct(z.body)}` : '', z.graze > 0.005 ? `sıyırma %${pct(z.graze)}` : '', z.miss > 0.005 ? `ıska %${pct(z.miss)}` : '']
      .filter(Boolean)
      .join(', ');
    rows.push({ label: `Silüete isabet (${where})`, factor: factorText(b.weightedUnblockedRatio / b.unblockedRatio), value: Math.round(b.afterRegion) });
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
