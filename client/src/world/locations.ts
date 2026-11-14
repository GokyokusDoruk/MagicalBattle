import type { Element } from '../battle/damage/elements';

export type LocationKind = 'city' | 'village' | 'arena';

export interface LocationDef {
  id: string;
  name: string;
  kind: LocationKind;
  chapter: number;
  /** Merkez karo */
  x: number;
  y: number;
  /**
   * Konumun elementleri: şehirler tek, köyler iki element taşır; son arena gölgedir (element yok). Kendi elementindeki
   * ayakkabı ve çanta burada %50 daha güçlüdür (docs/ekipman.md).
   */
  elements: readonly Element[];
}

/** Surlu şehrin merkezden duvara yarı boyu (toplam 13x13 karo). */
export const CITY_HALF = 6;
/** Köy ve son arenanın temizlenen alanının yarı boyu. */
export const OPEN_HALF = 4;
/** Kapının önündeki, yolun bittiği noktaya uzaklık. */
const APPROACH_DISTANCE = 3;

/**
 * Harita 96x96'dan 136x136'ya büyüdü (Task 39): konumlar yerini korur, hepsi 20 karo kaydırıldı (eski kayıtlar sunucuda ve
 * istemcide aynı kadar kaydırılır, bkz. save/saveData.ts). `MAP_OFFSET` bu kaymadır.
 */
export const MAP_OFFSET = 20;

/** Bölüm sırasına göre dizilidir; yollar bu sırayla birbirine bağlanır. */
export const LOCATIONS: readonly LocationDef[] = [
  { id: 'ignis', name: 'Ignis Surları', kind: 'city', chapter: 1, x: 84, y: 80, elements: ['fire'] },
  { id: 'ash', name: 'Ash Kanyon', kind: 'village', chapter: 2, x: 98, y: 58, elements: ['fire', 'air'] },
  { id: 'abyss', name: 'Abyss Tapınağı', kind: 'city', chapter: 3, x: 82, y: 36, elements: ['air'] },
  { id: 'vine', name: 'Vine Surları', kind: 'village', chapter: 4, x: 56, y: 34, elements: ['air', 'earth'] },
  { id: 'stone-heart', name: 'Stone Heart Kalesi', kind: 'city', chapter: 5, x: 36, y: 50, elements: ['earth'] },
  { id: 'marsh', name: 'Sisli Bataklık', kind: 'village', chapter: 6, x: 38, y: 80, elements: ['earth', 'water'] },
  { id: 'still-crystal', name: 'Still Crystal', kind: 'city', chapter: 7, x: 56, y: 100, elements: ['water'] },
  { id: 'witch-pass', name: 'Cadı Sis Geçidi', kind: 'arena', chapter: 8, x: 90, y: 102, elements: [] },
];

export function gateTile(loc: LocationDef): { x: number; y: number } {
  return { x: loc.x, y: loc.y + CITY_HALF };
}

/** Yolun bittiği ve ana görev işaretinin durduğu karo. */
export function approachTile(loc: LocationDef): { x: number; y: number } {
  if (loc.kind === 'city') return { x: loc.x, y: loc.y + CITY_HALF + APPROACH_DISTANCE };
  return { x: loc.x, y: loc.y };
}

export function getLocation(id: string): LocationDef {
  const loc = LOCATIONS.find((l) => l.id === id);
  if (!loc) throw new Error(`Bilinmeyen konum: ${id}`);
  return loc;
}
