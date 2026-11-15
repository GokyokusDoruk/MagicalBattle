import type { Element } from '../battle/damage/elements';
import { SKILLS, effectAt, type SpellRole } from './catalog';

/** Sınırlar: yetenekler ne kadar birikirse birikse dengeyi bozmasın. */
export const LIMITS = {
  maxBurnChance: 0.6,
  maxShieldBreak: 0.7,
  /** Alev Zinciri: bonus uygulanan en çok art arda büyü sayısı */
  maxChainStacks: 3,
  maxScatter: 0.5,
  maxChillChance: 0.7,
  maxLifesteal: 0.3,
  maxReflect: 0.5,
  maxFog: 3,
  maxStunChance: 0.9,
  maxMud: 3,
  maxTimeBonus: 1,
  maxCritBonus: 0.3,
  maxArmorStack: 0.05,
  /** Savaş boyunca biriken Taş Kabuk zırhının üst sınırı */
  maxArmorBonus: 0.3,
} as const;

/** Sarsıntı: saldırının savunmayı bu oranda ve üstü aşması gerekir */
export const STUN_HIT_RATIO = 0.8;
/** Çamurlu ekranda bir botun savunması yama başına bu oranda zayıflar */
export const MUD_BOT_BYPASS = 0.08;

/** Sisli savunma ekranında botun savunması bulut başına bu oranda zayıflar (savunmanın o kısmı geçer) */
export const FOG_BOT_BYPASS = 0.1;

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
  /** Su: yavaşlatma şansı ve kesilen süre (sn) */
  chillChance: number;
  chillSec: number;
  /** Su: savunma ekranına konan sis bulutu sayısı */
  fog: number;
  /** Toprak: savunmada kalıcı zırh (bu savunma başına), saldırıda sersemletme şansı ve çamur yaması sayısı */
  armorStack: number;
  stunChance: number;
  mud: number;
  /** Hava: çizim süresine eklenen sn, kritik şansı, geri savurma şansı ve oranı */
  timeBonus: number;
  critBonus: number;
  reboundChance: number;
  reboundShare: number;
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
  chillChance: 0,
  chillSec: 0,
  fog: 0,
  armorStack: 0,
  stunChance: 0,
  mud: 0,
  timeBonus: 0,
  critBonus: 0,
  reboundChance: 0,
  reboundShare: 0,
  skills: [],
});

/** Pasif yetenekler (büyü elementinden bağımsız): savaşçıya `passives` olarak verilir. */
export interface Passives {
  /** Yanık İzi: rakibin saldırı çizerken ekranında beliren yara izi sayısı */
  scars: number;
  /** Sarsıntılı Rüzgâr: rakibin saldırı çizim ekranının sarsıntı şiddeti (0-3) */
  shake: number;
  /** Sis Perdesi: rakibin savunma çiziminde sis bulutu sayısı (0-3); sahibi saldırırken geçerlidir */
  fog: number;
  /** Çamur Yaması: rakibin savunma çiziminde çamur yaması sayısı (0-3); sahibi saldırırken geçerlidir */
  mud: number;
}

export const NO_PASSIVES: Passives = { scars: 0, shake: 0, fog: 0, mud: 0 };

/** Pasifleri sahip olunan yetenek seviyelerinden okur. */
export function resolvePassives(levels: ReadonlyMap<string, number>): Passives {
  let scars = 0;
  let shake = 0;
  let fog = 0;
  let mud = 0;
  for (const skill of SKILLS) {
    const level = levels.get(skill.id) ?? 0;
    if (level > 0 && skill.passive) {
      const e = effectAt(skill, level);
      scars += e.scars ?? 0;
      shake += e.shake ?? 0;
      fog += e.fog ?? 0;
      mud += e.mud ?? 0;
    }
  }
  return { scars: Math.min(3, scars), shake: Math.min(3, shake), fog: Math.min(LIMITS.maxFog, fog), mud: Math.min(LIMITS.maxMud, mud) };
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
      fx.chillChance += e.chillChance ?? 0;
      fx.chillSec = Math.max(fx.chillSec, e.chillSec ?? 0);
      fx.lifesteal += e.lifesteal ?? 0;
      fx.fog += e.fog ?? 0;
      fx.stunChance += e.stunChance ?? 0;
      fx.mud += e.mud ?? 0;
      fx.critBonus += e.critBonus ?? 0;
      fx.timeBonus += e.timeBonus ?? 0;
    } else {
      fx.timeBonus += e.timeBonus ?? 0;
      fx.reboundChance += e.reboundChance ?? 0;
      fx.reboundShare = Math.max(fx.reboundShare, e.reboundShare ?? 0);
      fx.reflect += e.reflect ?? 0;
      fx.armorStack += e.armorStack ?? 0;
      fx.takenMultiplier *= 1 - (e.guard ?? 0);
    }
    fx.skills.push(`${skill.id}-${level}`);
  }
  fx.burnChance = Math.min(LIMITS.maxBurnChance, fx.burnChance);
  fx.shieldBreak = Math.min(LIMITS.maxShieldBreak, fx.shieldBreak);
  fx.scatter = Math.min(LIMITS.maxScatter, fx.scatter);
  fx.chillChance = Math.min(LIMITS.maxChillChance, fx.chillChance);
  fx.lifesteal = Math.min(LIMITS.maxLifesteal, fx.lifesteal);
  fx.reflect = Math.min(LIMITS.maxReflect, fx.reflect);
  fx.fog = Math.min(LIMITS.maxFog, Math.round(fx.fog));
  fx.stunChance = Math.min(LIMITS.maxStunChance, fx.stunChance);
  fx.mud = Math.min(LIMITS.maxMud, Math.round(fx.mud));
  fx.armorStack = Math.min(LIMITS.maxArmorStack, fx.armorStack);
  fx.timeBonus = Math.min(LIMITS.maxTimeBonus, fx.timeBonus);
  fx.critBonus = Math.min(LIMITS.maxCritBonus, fx.critBonus);
  fx.reboundChance = Math.min(0.9, fx.reboundChance);
  return fx;
}
