import type { Element } from '../damage/elements';

export interface ElementColors {
  /** Ana renk (cüppe, büyü çekirdeği) */
  main: number;
  /** Parlama ve kıvılcım rengi */
  glow: number;
}

export const ELEMENT_COLORS: Record<Element, ElementColors> = {
  fire: { main: 0xff6a2b, glow: 0xffb04d },
  water: { main: 0x3fa9ff, glow: 0x9fe0ff },
  earth: { main: 0xb98a4a, glow: 0xe3c885 },
  air: { main: 0xcfe9ff, glow: 0xffffff },
};

/** Savunma kalkanının rengi (element fark etmeksizin) */
export const SHIELD_COLORS: ElementColors = { main: 0x4ff0b8, glow: 0xb6ffe6 };

export const SKY_COLOR = 0x090c1e;
