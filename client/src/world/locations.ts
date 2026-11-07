export type LocationKind = 'city' | 'village' | 'arena';

export interface LocationDef {
  id: string;
  name: string;
  kind: LocationKind;
  chapter: number;
  /** Merkez karo */
  x: number;
  y: number;
}

/** Surlu şehrin merkezden duvara yarı boyu (toplam 13x13 karo). */
export const CITY_HALF = 6;
/** Köy ve son arenanın temizlenen alanının yarı boyu. */
export const OPEN_HALF = 4;
/** Kapının önündeki, yolun bittiği noktaya uzaklık. */
const APPROACH_DISTANCE = 3;

/** Bölüm sırasına göre dizilidir; yollar bu sırayla birbirine bağlanır. */
export const LOCATIONS: readonly LocationDef[] = [
  { id: 'ignis', name: 'Ignis Surları', kind: 'city', chapter: 1, x: 64, y: 60 },
  { id: 'ash', name: 'Ash Kanyon', kind: 'village', chapter: 2, x: 78, y: 38 },
  { id: 'abyss', name: 'Abyss Tapınağı', kind: 'city', chapter: 3, x: 62, y: 16 },
  { id: 'vine', name: 'Vine Surları', kind: 'village', chapter: 4, x: 36, y: 14 },
  { id: 'stone-heart', name: 'Stone Heart Kalesi', kind: 'city', chapter: 5, x: 16, y: 30 },
  { id: 'marsh', name: 'Sisli Bataklık', kind: 'village', chapter: 6, x: 18, y: 60 },
  { id: 'still-crystal', name: 'Still Crystal', kind: 'city', chapter: 7, x: 36, y: 80 },
  { id: 'witch-pass', name: 'Cadı Sis Geçidi', kind: 'arena', chapter: 8, x: 70, y: 82 },
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
