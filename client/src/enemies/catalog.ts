import type { Element } from '../battle/damage/elements';
import type { FighterInit } from '../battle/flow/engine';
import { playerMaxHp } from '../economy/health';
import type { PlayerStats } from '../boss/bosses';

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

/** Bir düşmanın sayıları. Boss'lardan belirgin zayıftır (Vael: 310 can, 115 güç). */
export function enemyStats(element: Element, tier: Tier): EnemyStats {
  const level = TIER_LEVEL[tier];
  return {
    name: tier === 4 ? `Kadim ${ENEMY_KINDS[element].name}` : ENEMY_KINDS[element].name,
    level,
    hp: 90 + level * 12,
    basePower: 60 + level * 2,
    armor: Math.min(0.2, 0.01 * level),
    skill: Math.min(0.55, 0.2 + level * 0.02),
    money: 6 + level * 3,
    xp: 12 + level * 6,
  };
}

/** Savaşın dövüşçüleri: takım 0 = oyuncu (mevcut canıyla), takım 1 = düşman. */
export function enemyFighters(element: Element, tier: Tier, player: PlayerStats): FighterInit[] {
  const s = enemyStats(element, tier);
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
      ai: { skill: s.skill, elements: { [element]: 3 } },
    },
  ];
}
