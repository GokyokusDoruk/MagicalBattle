import type { Element } from '../battle/damage/elements';
import { getSkill } from '../skills/catalog';
import { resolvePassives, resolveSpell, type Passives, type SpellResolver } from '../skills/resolver';
import type { Tier } from './catalog';

/**
 * Düşman yetenekleri (Task 45b): dünya düşmanları kendi elementlerinin yeteneklerini oyuncuya karşı kullanır.
 * Kademe yükseldikçe hem yetenek sayısı hem seviyeleri artar:
 *  - Kademe 1 (düşük): 2 yetenek, Sv 1
 *  - Kademe 2 (orta): 3 yetenek, Sv 2
 *  - Kademe 3 (orta-yüksek): elementin tüm yetenekleri, Sv 2
 *  - Kademe 4 (yüksek, "Kadim"): tüm yetenekler, Sv 3
 * Hangi yeteneğin önce geldiği elementin kişiliğine göre sabittir (aşağıdaki sıra).
 */

/** Elementin yeteneklerinin düşmanda açılma sırası: ilk birkaçı ucuz ve görünür etkilerdir (ekran engelleri, yanma) */
export const ENEMY_SKILL_ORDER: Readonly<Record<Element, readonly string[]>> = {
  fire: ['fire-burn', 'fire-scars', 'fire-breaker', 'fire-scatter', 'fire-chain'],
  water: ['water-fog', 'water-chill', 'water-mirror', 'water-bubble'],
  earth: ['earth-mud', 'earth-quake', 'earth-bulwark', 'earth-armor'],
  air: ['air-tremor', 'air-gale', 'air-rebound', 'air-edge'],
};

/** Kademeye göre: kaç yetenek (Infinity = hepsi) ve hangi seviye */
export const ENEMY_SKILL_PLAN: Readonly<Record<Tier, { count: number; level: 1 | 2 | 3 }>> = {
  1: { count: 2, level: 1 },
  2: { count: 3, level: 2 },
  3: { count: Infinity, level: 2 },
  4: { count: Infinity, level: 3 },
};

/** Düşmanın yetenek seviyeleri (id → seviye). */
export function enemySkillLevels(element: Element, tier: Tier): Map<string, number> {
  const plan = ENEMY_SKILL_PLAN[tier];
  const levels = new Map<string, number>();
  for (const id of ENEMY_SKILL_ORDER[element].slice(0, plan.count)) if (getSkill(id)) levels.set(id, plan.level);
  return levels;
}

export interface EnemySkills {
  spells: SpellResolver;
  passives: Passives;
  /** Savaş öncesi gösterim için yetenek adları ve seviyeleri */
  levels: ReadonlyMap<string, number>;
}

/** Savaşçıya verilecek çözücüler. Düşman başka bir element seçerse o elementin yeteneği olmadığı için etkisizdir. */
export function enemySkills(element: Element, tier: Tier): EnemySkills {
  const levels = enemySkillLevels(element, tier);
  return { levels, passives: resolvePassives(levels), spells: (el, role) => resolveSpell(levels, el, role) };
}
