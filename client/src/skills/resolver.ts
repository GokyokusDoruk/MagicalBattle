import type { Element } from '../battle/damage/elements';
import { SKILLS, effectAt, type SpellRole } from './catalog';

/** Sınırlar: yetenekler ne kadar birikirse birikse dengeyi bozmasın. */
export const LIMITS = {
  maxBurnChance: 0.6,
  maxShieldBreak: 0.7,
  /** Alev Zinciri: bonus uygulanan en çok art arda büyü sayısı */
  maxChainStacks: 3,
  maxScatter: 0.5,
} as const;

/** Kırılan kalkanın savunma etkisinin ne kadarı gider (0.6: savunmanın %60'ı geçersiz sayılır) */
export const SHIELD_BREAK_STRENGTH = 0.6;

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
  /** Ateş: tutuşturma şansı ve yanma hasarı */
  burnChance: number;
  burnDamage: number;
  /** Ateş: kalkan kırma şansı */
  shieldBreak: number;
  /** Ateş: art arda her ateş büyüsü için eklenen hasar oranı */
  chainBonus: number;
  /** Ateş: büyünün savunmaya takılmadan geçen kısmı */
  scatter: number;
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
  burnChance: 0,
  burnDamage: 0,
  shieldBreak: 0,
  chainBonus: 0,
  scatter: 0,
  skills: [],
});

/** Pasif yetenekler (büyü elementinden bağımsız): savaşçıya `passives` olarak verilir. */
export interface Passives {
  /** Yanık İzi: rakibin saldırı çizerken ekranında beliren yara izi sayısı */
  scars: number;
}

export const NO_PASSIVES: Passives = { scars: 0 };

/** Pasifleri sahip olunan yetenek seviyelerinden okur. */
export function resolvePassives(levels: ReadonlyMap<string, number>): Passives {
  let scars = 0;
  for (const skill of SKILLS) {
    const level = levels.get(skill.id) ?? 0;
    if (level > 0 && skill.passive) scars += effectAt(skill, level).scars ?? 0;
  }
  return { scars };
}

/**
 * Tek bir büyü için tüm yetenek etkilerini birleştirir. Ateş yetenekleri yalnızca **ateş saldırısında** işler
 * (element seçimi o döngüde hem saldırı hem savunma elementidir; savunmada ateşin bir etkisi yoktur). Başka elementlerin
 * yetenekleri bu büyüyü etkilemez. Pasif yetenekler burada değil `resolvePassives` ile gelir.
 */
export function resolveSpell(levels: ReadonlyMap<string, number>, element: Element, role: SpellRole): SpellEffects {
  const fx = neutralEffects(element, role);
  for (const skill of SKILLS) {
    if (skill.element !== element || skill.passive) continue;
    const level = levels.get(skill.id) ?? 0;
    if (level <= 0) continue;
    const e = effectAt(skill, level);
    if (role === 'attack') {
      fx.burnChance += e.burnChance ?? 0;
      fx.burnDamage = Math.max(fx.burnDamage, e.burnDamage ?? 0);
      fx.shieldBreak += e.shieldBreak ?? 0;
      fx.chainBonus += e.chainBonus ?? 0;
      fx.scatter += e.scatter ?? 0;
    }
    fx.skills.push(`${skill.id}-${level}`);
  }
  fx.burnChance = Math.min(LIMITS.maxBurnChance, fx.burnChance);
  fx.shieldBreak = Math.min(LIMITS.maxShieldBreak, fx.shieldBreak);
  fx.scatter = Math.min(LIMITS.maxScatter, fx.scatter);
  return fx;
}
