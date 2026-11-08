import type { Element } from '../battle/damage/elements';
import { BRANCHES, BRANCH_KINDS, STAT_KEYS, TIERS, getSkill, skillId, type SpellRole, type SpellStats } from './catalog';

/** Sınırlar: yetenekler ne kadar birikirse birikse dengeyi bozmasın. */
export const LIMITS = {
  /** Alınan hasar çarpanının en düşük değeri (en çok -%60) */
  minTakenMultiplier: 0.4,
  maxPierce: 0.6,
  maxReflect: 0.3,
  maxLifesteal: 0.3,
  maxEffort: 0.5,
  maxHeadBonus: 0.6,
} as const;

/** Tek element için "uyum": üç dalın da en az Seviye 1'i varsa, üçü de Ustalıktaysa ek çarpan. */
export const SYNERGY = {
  basic: 0.04,
  full: 0.06,
} as const;

export type SynergyLevel = 'none' | 'basic' | 'full';

/** Tek bir büyünün (element + rol) tüm yeteneklerden aldığı birleşik etki. Hasar hesabına doğrudan bağlanır. */
export interface SpellEffects {
  element: Element;
  role: SpellRole;
  /** Verilen hasar çarpanı (1 = etkisiz) */
  dealtMultiplier: number;
  /** Alınan hasar çarpanı (1 = etkisiz) */
  takenMultiplier: number;
  armorPierce: number;
  headBonus: number;
  reflect: number;
  lifesteal: number;
  effortBonus: number;
  synergy: SynergyLevel;
  /** Etkiye katkı veren yeteneklerin kimlikleri */
  skills: string[];
}

export type SpellResolver = (element: Element, role: SpellRole) => SpellEffects;

export const neutralEffects = (element: Element, role: SpellRole): SpellEffects => ({
  element,
  role,
  dealtMultiplier: 1,
  takenMultiplier: 1,
  armorPierce: 0,
  headBonus: 0,
  reflect: 0,
  lifesteal: 0,
  effortBonus: 0,
  synergy: 'none',
  skills: [],
});

/** Bir dalda sahip olunan kademe sayısı (0-3; kademeler sırayla alınır). */
function rankOf(owned: ReadonlySet<string>, element: Element, branch: (typeof BRANCH_KINDS)[number]): number {
  let rank = 0;
  for (const tier of TIERS) {
    if (!owned.has(skillId(element, branch, tier))) break;
    rank = tier;
  }
  return rank;
}

export function synergyLevel(owned: ReadonlySet<string>, element: Element): SynergyLevel {
  const ranks = BRANCH_KINDS.map((k) => rankOf(owned, element, k));
  if (ranks.every((r) => r === 3)) return 'full';
  if (ranks.every((r) => r >= 1)) return 'basic';
  return 'none';
}

const synergyBonus = (level: SynergyLevel): number =>
  level === 'full' ? SYNERGY.basic + SYNERGY.full : level === 'basic' ? SYNERGY.basic : 0;

/**
 * Tek bir büyü için tüm yetenek etkilerini birleştirir.
 *  - Büyüyü atarken (saldırı): o elementin Güç ve Hassasiyet dallarının sahip olunan kademeleri toplanır.
 *  - Savunurken: o elementin Kalkan dalı toplanır.
 *  - Elementin üç dalı da açıksa "uyum" bonusu rolüne göre verilen ya da alınan hasara eklenir.
 * Başka elementlerin yetenekleri bu büyüyü etkilemez. Aynı yetenek iki kez sayılmaz.
 */
export function resolveSpell(owned: ReadonlySet<string>, element: Element, role: SpellRole): SpellEffects {
  const sum: SpellStats = { dealt: 0, taken: 0, pierce: 0, headBonus: 0, reflect: 0, lifesteal: 0, effort: 0 };
  const used: string[] = [];

  for (const branch of BRANCHES) {
    if (branch.element !== element || branch.role !== role) continue;
    for (const tier of TIERS) {
      const id = skillId(element, branch.kind, tier);
      if (!owned.has(id)) break; // kademeler sırayla; boşluktan sonrası sayılmaz
      const skill = getSkill(id)!;
      for (const key of STAT_KEYS) sum[key] += skill.stats[key] ?? 0;
      used.push(id);
    }
  }

  const synergy = synergyLevel(owned, element);
  const bonus = synergyBonus(synergy);
  const dealt = sum.dealt + (role === 'attack' ? bonus : 0);
  const taken = sum.taken + (role === 'defense' ? bonus : 0);

  return {
    element,
    role,
    dealtMultiplier: 1 + dealt,
    takenMultiplier: Math.max(LIMITS.minTakenMultiplier, 1 - taken),
    armorPierce: Math.min(LIMITS.maxPierce, sum.pierce),
    headBonus: Math.min(LIMITS.maxHeadBonus, sum.headBonus),
    reflect: Math.min(LIMITS.maxReflect, sum.reflect),
    lifesteal: Math.min(LIMITS.maxLifesteal, sum.lifesteal),
    effortBonus: Math.min(LIMITS.maxEffort, sum.effort),
    synergy,
    skills: used,
  };
}
