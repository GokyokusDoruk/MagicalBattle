import { ELEMENT_ADVANTAGE, ELEMENT_DISADVANTAGE } from './config';

export type Element = 'fire' | 'water' | 'earth' | 'air';

export const ELEMENTS: readonly Element[] = ['fire', 'water', 'earth', 'air'];

export const ELEMENT_NAMES: Record<Element, string> = {
  fire: 'Ateş',
  water: 'Su',
  earth: 'Toprak',
  air: 'Hava',
};

/**
 * Üstünlük döngüsü: anahtar elementin yendiği element.
 * Su ateşi yener, toprak suyu yener, hava toprağı yener, ateş havayı yener.
 * Ateş–toprak ve su–hava arasında etki yoktur.
 */
const BEATS: Record<Element, Element> = {
  water: 'fire',
  earth: 'water',
  air: 'earth',
  fire: 'air',
};

export type ElementRelation = 'advantage' | 'disadvantage' | 'neutral';

/** Saldıranın, savunana göre durumu. */
export function elementRelation(attacker: Element, defender: Element): ElementRelation {
  if (BEATS[attacker] === defender) return 'advantage';
  if (BEATS[defender] === attacker) return 'disadvantage';
  return 'neutral';
}

/** Saldıran üstünse hasar ×1.5, savunan üstünse ×0.5, aksi halde ×1. */
export function elementMultiplier(attacker: Element, defender: Element): number {
  const relation = elementRelation(attacker, defender);
  if (relation === 'advantage') return ELEMENT_ADVANTAGE;
  if (relation === 'disadvantage') return ELEMENT_DISADVANTAGE;
  return 1;
}
