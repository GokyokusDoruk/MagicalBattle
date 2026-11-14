import { ELEMENTS, ELEMENT_NAMES, type Element } from '../battle/damage/elements';

/**
 * Asalar (Task 22, v2): her asa bir element, bir rol (saldırı / savunma), bir nadirlik (1-6) ve bir seviye (1-30)
 * taşır. Aynı anda TEK asa kuşanılır. Asanın seviyesi, oyuncu o seviyeye gelene kadar kullanılmasını engeller.
 * Asa kimliği özelliklerini taşır: `wand-fire-attack-3-12` (ateş, saldırı, nadirlik 3, seviye 12).
 */

export type WandRole = 'attack' | 'defense';
export type Rarity = 1 | 2 | 3 | 4 | 5 | 6;

export const ROLES: readonly WandRole[] = ['attack', 'defense'];
export const RARITIES: readonly Rarity[] = [1, 2, 3, 4, 5, 6];
export const MAX_RARITY: Rarity = 6;
/** Asa seviyesi 1 ile oyuncunun en yüksek seviyesi arasındadır */
export const MIN_WAND_LEVEL = 1;
export const MAX_WAND_LEVEL = 30;

export const RARITY_NAMES: Record<Rarity, string> = {
  1: 'Sıradan',
  2: 'Gelişmiş',
  3: 'Nadir',
  4: 'Destansı',
  5: 'Efsanevi',
  6: 'Mistik',
};

export const RARITY_COLORS: Record<Rarity, string> = {
  1: '#cbd5e1',
  2: '#86efac',
  3: '#7dd3fc',
  4: '#c4b5fd',
  5: '#fcd34d',
  6: '#f9a8d4',
};

/** Element renkleri: ateş kırmızı, su mavi, toprak kahverengi, hava beyaz */
export const ELEMENT_COLORS: Record<Element, string> = {
  fire: '#ef4444',
  water: '#3b82f6',
  earth: '#a16207',
  air: '#f1f5f9',
};

export const ROLE_NAMES: Record<WandRole, string> = { attack: 'Saldırı Asası', defense: 'Savunma Asası' };

/** Tek bir asadan taşınabilecek en çok adet */
export const MAX_WAND_STACK = 999;

/** Güç göstergesi B = nadirlik ve seviye bonusu. Her ikisi de saldırıyı, savunmayı ve büyü süresini artırır. */
export const RARITY_BONUS = 0.04;
export const LEVEL_BONUS = 0.008;
/** Rol dengesi: saldırı asası saldırıda %25 güçlü, savunmada %25 zayıf; savunma asasında tersi */
export const ROLE_UP = 1.25;
export const ROLE_DOWN = 0.75;
/** Asanın elementi, seçilen büyünün elementiyle aynıysa hasar bu kadar artar (%50) */
export const ELEMENT_MATCH = 1.25;
/** Büyü süresi bonusu: B başına saniye (çizim süresi uzar) */
export const TIME_PER_STRENGTH_SEC = 2;

export interface WandSpec {
  element: Element;
  role: WandRole;
  rarity: Rarity;
  level: number;
}

export interface WandDef extends WandSpec {
  id: string;
  name: string;
  /** Güç göstergesi B (0 ile ~0.43 arası) */
  strength: number;
  /** Büyü süresine eklenen saniye (hem saldırı hem savunma çizimi) */
  timeBonusSec: number;
  /** Saldırıda hasar çarpanı (element eşleşmesi hariç) */
  attackMultiplier: number;
  /** Savunmada güç çarpanı (>1 güçlü, <1 zayıf); alınan hasar = 1 / bu */
  defenseMultiplier: number;
}

export const wandStrength = (rarity: Rarity, level: number): number => RARITY_BONUS * (rarity - 1) + LEVEL_BONUS * (level - 1);

export const wandIdOf = (spec: WandSpec): string => `wand-${spec.element}-${spec.role}-${spec.rarity}-${spec.level}`;

const ID = /^wand-(fire|water|earth|air)-(attack|defense)-([1-6])(?:-(\d{1,2}))?$/;

/** Kimlikten asa özelliklerini okur. Eski kayıtlardaki seviyesiz kimlik (`wand-fire-attack-3`) seviye 1 sayılır. */
export function parseWandId(id: string): WandSpec | null {
  const m = ID.exec(id);
  if (!m) return null;
  const level = m[4] === undefined ? 1 : Number(m[4]);
  if (level < MIN_WAND_LEVEL || level > MAX_WAND_LEVEL) return null;
  return { element: m[1] as Element, role: m[2] as WandRole, rarity: Number(m[3]) as Rarity, level };
}

const cache = new Map<string, WandDef>();

export function makeWand(spec: WandSpec): WandDef {
  const id = wandIdOf(spec);
  const hit = cache.get(id);
  if (hit) return hit;
  const strength = wandStrength(spec.rarity, spec.level);
  const def: WandDef = {
    ...spec,
    id,
    name: `${RARITY_NAMES[spec.rarity]} ${ELEMENT_NAMES[spec.element]} ${ROLE_NAMES[spec.role]}`,
    strength,
    timeBonusSec: Math.round(TIME_PER_STRENGTH_SEC * strength * 100) / 100,
    attackMultiplier: (1 + strength) * (spec.role === 'attack' ? ROLE_UP : ROLE_DOWN),
    defenseMultiplier: (1 + strength) * (spec.role === 'defense' ? ROLE_UP : ROLE_DOWN),
  };
  cache.set(id, def);
  return def;
}

/** Kimliği geçerli bir asaya çevirir; bilinmiyorsa undefined. Eski (seviyesiz) kimlikler seviye 1 olur. */
export function getWand(id: string): WandDef | undefined {
  const spec = parseWandId(id);
  return spec ? makeWand(spec) : undefined;
}

/** Eski seviyesiz kimliği yeni biçime çevirir (zaten yeniyse aynen verir). Geçersizse null. */
export function normalizeWandId(id: string): string | null {
  const spec = parseWandId(id);
  return spec ? wandIdOf(spec) : null;
}

/** Savaştaki etki: bir büyü için (element, aşama) asanın verdikleri. */
export interface WandSpellEffect {
  /** Taban güç (hasar) çarpanı: saldırıda asanın saldırı çarpanı, element eşleşirse ×1.5 */
  powerMultiplier: number;
  /** Alınan hasar çarpanı: savunmada 1 / savunma çarpanı */
  takenMultiplier: number;
  /** Çizim süresine eklenen saniye */
  timeBonusSec: number;
  /** Seçilen büyünün elementi asanınkiyle aynı mı */
  elementMatch: boolean;
}

/** Bir asanın, verilen elementteki büyü için saldırı ya da savunma aşamasındaki etkisi. */
export function wandEffect(wand: WandDef, element: Element, phase: WandRole): WandSpellEffect {
  const match = wand.element === element;
  return {
    powerMultiplier: phase === 'attack' ? wand.attackMultiplier * (match ? ELEMENT_MATCH : 1) : 1,
    takenMultiplier: phase === 'defense' ? 1 / wand.defenseMultiplier : 1,
    timeBonusSec: wand.timeBonusSec,
    elementMatch: match,
  };
}

/** Tüm kimliklerin üretimi (testler ve arayüz için): 4 element × 2 rol × 6 nadirlik × 30 seviye = 1440 asa */
export function allWands(): WandDef[] {
  return ELEMENTS.flatMap((element) =>
    ROLES.flatMap((role) =>
      RARITIES.flatMap((rarity) =>
        Array.from({ length: MAX_WAND_LEVEL }, (_, i) => makeWand({ element, role, rarity, level: i + 1 })),
      ),
    ),
  );
}

/** Fiyat modeli: nadirlik başına ×2.2, seviye başına +%8 */
export const WAND_BASE_PRICE = 40;
export const PRICE_PER_RARITY = 2.2;
export const PRICE_PER_LEVEL = 0.08;

export function wandPrice(rarity: Rarity, level: number): number {
  return Math.round(WAND_BASE_PRICE * PRICE_PER_RARITY ** (rarity - 1) * (1 + PRICE_PER_LEVEL * (level - 1)));
}

/** Kısa Türkçe açıklama satırları */
export function describeWand(w: WandDef): string[] {
  const pct = (v: number): string => `${v >= 1 ? '+' : '-'}%${Math.round(Math.abs(v - 1) * 100)}`;
  return [
    `Saldırı hasarı ${pct(w.attackMultiplier)}`,
    `Savunma gücü ${pct(w.defenseMultiplier)}`,
    `Büyü süresi +${w.timeBonusSec.toFixed(2)} sn`,
    `${ELEMENT_NAMES[w.element]} büyüsünde hasar +%50 daha`,
  ];
}

/** Yeni oyuna eşyasız başlanır, yalnızca bir asa verilir: Sıradan Ateş Saldırı Asası (Sv 1). */
export const STARTER_WAND_ID = wandIdOf({ element: 'fire', role: 'attack', rarity: 1, level: 1 });
