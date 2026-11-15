import type { Element } from '../battle/damage/elements';
import type { FighterInit } from '../battle/flow/engine';
import { playerMaxHp } from '../economy/health';
import type { PlayerStats } from '../boss/bosses';
import { enemySkills } from './skills';

/**
 * Dünya düşmanları (Task 28): haritada dolaşan yaratıklar. Dokunursan savaş başlar; yenince ganimet (loot.ts) düşer.
 * Her düşmanın bir elementi ve bir kademesi (1-4) vardır; kademe haritanın başlangıçtan uzaklığına göre artar.
 */

export type Tier = 1 | 2 | 3 | 4;
export const TIERS: readonly Tier[] = [1, 2, 3, 4];

export interface EnemyKind {
  element: Element;
  name: string;
  /** Yenince düşebilen ticari mal (düşmanın elementinin malı) */
  material: string;
}

export const ENEMY_KINDS: Readonly<Record<Element, EnemyKind>> = {
  fire: { element: 'fire', name: 'Köz Cini', material: 'kor-baharati' },
  water: { element: 'water', name: 'Dalga Hayaleti', material: 'derin-inci' },
  earth: { element: 'earth', name: 'Taş Bekçi', material: 'tas-cevheri' },
  air: { element: 'air', name: 'Fırtına Kurdu', material: 'bulut-ipegi' },
};

/** Kademeye göre düşmanın seviyesi (can, güç ve ödül buradan gelir) */
export const TIER_LEVEL: Readonly<Record<Tier, number>> = { 1: 2, 2: 5, 3: 9, 4: 14 };

export interface EnemyStats {
  name: string;
  level: number;
  hp: number;
  basePower: number;
  armor: number;
  skill: number;
  money: number;
  xp: number;
}

/**
 * Denge turu (Task 46): yetenekli vekil oyuncuya (tipik kit, beceri 0.6) karşı hedefler: kademe 1 ~%95 galibiyet / ~%25 can kaybı,
 * kademe 2 ~%92 / %40, kademe 3 ~%85 / %55, kademe 4 ~%75 / %65. Çarpanlar can ve güce uygulanır.
 */
export const ENEMY_TUNING: Readonly<Record<Tier, { hp: number; power: number }>> = {
  1: { hp: 1.5, power: 1.3 },
  2: { hp: 1.6, power: 1.35 },
  3: { hp: 1.75, power: 1.45 },
  4: { hp: 1.9, power: 1.55 },
};

/** Bir düşmanın sayıları. Boss'lardan belirgin zayıftır (Vael: 310 can, 115 güç). */
export function enemyStats(element: Element, tier: Tier): EnemyStats {
  const level = TIER_LEVEL[tier];
  return {
    name: tier === 4 ? `Kadim ${ENEMY_KINDS[element].name}` : ENEMY_KINDS[element].name,
    level,
    hp: Math.round((90 + level * 12) * ENEMY_TUNING[tier].hp),
    basePower: Math.round((60 + level * 2) * ENEMY_TUNING[tier].power),
    armor: Math.min(0.2, 0.01 * level),
    skill: Math.min(0.55, 0.2 + level * 0.02),
    money: 6 + level * 4,
    xp: 12 + level * 6,
  };
}

/** Savaşın dövüşçüleri: takım 0 = oyuncu (mevcut canıyla), takım 1 = düşman. */
export function enemyFighters(element: Element, tier: Tier, player: PlayerStats): FighterInit[] {
  const s = enemyStats(element, tier);
  const skills = enemySkills(element, tier);
  return [
    {
      name: player.name,
      team: 0,
      control: 'human',
      maxHp: playerMaxHp(player.level),
      hp: player.hp,
      armor: player.armor,
      gear: player.gear,
      dealtMultiplier: player.dealtMultiplier,
      takenMultiplier: player.takenMultiplier,
      spells: player.spells,
      passives: player.passives,
      wands: player.wands,
    },
    {
      name: s.name,
      team: 1,
      control: 'bot',
      maxHp: s.hp,
      basePower: s.basePower,
      armor: s.armor,
      spells: skills.spells,
      passives: skills.passives,
      ai: { skill: s.skill, elements: { [element]: 3 } },
    },
  ];
}
