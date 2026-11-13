import type { Element } from '../battle/damage/elements';
import { RARITY_COLORS } from '../wands/catalog';
import type { GearSlot, ItemDef } from '../economy/items';

/**
 * Eşya ikonları (koda çizilmiş SVG, telifsiz). Renk elementi belli eder: ateş kırmızı, su mavi, toprak kahverengi,
 * hava beyaz. Nadirlik arttıkça ikon gösterişlenir: Sıradan sade; Gelişmiş ince halka; Nadir parıltı; Destansı kıvılcımlar;
 * Efsanevi altın çift halka; Mistik ışınlar ve yıldız. Gradyan kullanılmaz (kimlik çakışması olmaz).
 */

export interface Palette {
  main: string;
  dark: string;
  light: string;
}

export const ELEMENT_PALETTE: Record<Element, Palette> = {
  fire: { main: '#ef4444', dark: '#7f1d1d', light: '#fecaca' },
  water: { main: '#3b82f6', dark: '#1e3a8a', light: '#bfdbfe' },
  earth: { main: '#a16207', dark: '#451a03', light: '#e0b36a' },
  air: { main: '#f8fafc', dark: '#64748b', light: '#ffffff' },
};

/** Elementi olmayan ekipman (eski çantalar): gri */
export const NEUTRAL_PALETTE: Palette = { main: '#94a3b8', dark: '#334155', light: '#e2e8f0' };

/** Yuva şekilleri (48x48). Dolgu: ana renk, çizgi: koyu renk. */
function shape(slot: GearSlot, p: Palette): string {
  const stroke = `stroke="${p.dark}" stroke-width="1.6" stroke-linejoin="round"`;
  switch (slot) {
    case 'robe':
      return `<path d="M17 9 L31 9 L38 41 L10 41 Z" fill="${p.main}" ${stroke}/>
        <path d="M17 9 L6 25 L12 29 L19 19 Z" fill="${p.main}" ${stroke}/><path d="M31 9 L42 25 L36 29 L29 19 Z" fill="${p.main}" ${stroke}/>
        <path d="M21 9 L24 17 L27 9 Z" fill="${p.light}" ${stroke}/><rect x="14" y="27" width="20" height="3.5" fill="${p.dark}"/>`;
    case 'hat':
      return `<path d="M24 5 L36 34 L12 34 Z" fill="${p.main}" ${stroke}/><ellipse cx="24" cy="36" rx="18" ry="5" fill="${p.main}" ${stroke}/>
        <path d="M14.5 30 Q24 35 33.5 30 L34.5 33 Q24 38 13.5 33 Z" fill="${p.dark}"/><circle cx="24" cy="9" r="2" fill="${p.light}"/>`;
    case 'pants':
      return `<path d="M13 7 L35 7 L37 41 L26 41 L24 21 L22 41 L11 41 Z" fill="${p.main}" ${stroke}/>
        <rect x="13" y="7" width="22" height="4" fill="${p.dark}"/><path d="M24 11 L24 21" stroke="${p.dark}" stroke-width="1.4"/>`;
    case 'bag':
      return `<path d="M17 17 Q24 3 31 17" fill="none" stroke="${p.dark}" stroke-width="3.5" stroke-linecap="round"/>
        <rect x="9" y="17" width="30" height="24" rx="6" fill="${p.main}" ${stroke}/>
        <path d="M9 23 Q24 33 39 23 L39 21 Q39 17 35 17 L13 17 Q9 17 9 21 Z" fill="${p.dark}" opacity="0.55"/>
        <rect x="21" y="25" width="6" height="7" rx="1.5" fill="${p.light}" ${stroke}/>`;
    case 'ring':
      return `<circle cx="24" cy="29" r="11" fill="none" stroke="${p.dark}" stroke-width="7"/><circle cx="24" cy="29" r="11" fill="none" stroke="${p.main}" stroke-width="4.4"/>
        <path d="M24 8 L30 15 L24 22 L18 15 Z" fill="${p.light}" ${stroke}/><path d="M24 8 L24 22 M18 15 L30 15" stroke="${p.main}" stroke-width="1"/>`;
    case 'boots':
      return `<path d="M14 6 L27 6 L27 26 L38 30 Q42 32 42 36 L42 41 L10 41 L10 36 Q10 32 14 30 Z" fill="${p.main}" ${stroke}/>
        <rect x="10" y="37" width="32" height="4.5" fill="${p.dark}"/><rect x="14" y="6" width="13" height="5" fill="${p.light}" ${stroke}/>`;
  }
}

const sparkle = (x: number, y: number, r: number, color: string): string =>
  `<path d="M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3} Z" fill="${color}"/>`;

/** Nadirliğe göre arka plan süsü (ikonun arkasında) ve ön süsü (ikonun önünde) */
function decorations(rarity: number): { back: string; front: string } {
  const color = RARITY_COLORS[rarity as 1];
  let back = '';
  let front = '';
  if (rarity >= 6) {
    // Işınlar
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      back += `<line x1="${24 + Math.cos(a) * 18}" y1="${24 + Math.sin(a) * 18}" x2="${24 + Math.cos(a) * 23.5}" y2="${24 + Math.sin(a) * 23.5}" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity="0.85"/>`;
    }
  }
  if (rarity >= 3) back += `<circle cx="24" cy="24" r="${rarity >= 5 ? 21 : 19}" fill="${color}" opacity="${rarity >= 5 ? 0.3 : 0.2}"/>`;
  if (rarity >= 2) back += `<circle cx="24" cy="24" r="22" fill="none" stroke="${color}" stroke-width="${rarity >= 5 ? 2 : 1.2}"/>`;
  if (rarity >= 5) back += `<circle cx="24" cy="24" r="19.2" fill="none" stroke="#fcd34d" stroke-width="1"/>`;
  if (rarity >= 4) front += sparkle(8, 9, 3.2, color) + sparkle(41, 13, 2.6, color) + sparkle(38, 40, 2.8, color);
  if (rarity >= 5) front += sparkle(10, 38, 2.6, '#fcd34d');
  if (rarity >= 6) front += sparkle(24, 4, 4.2, '#fff7ae');
  return { back, front };
}

/** Eşyanın ikonu (SVG metni). Ekipman: yuva şekli + element rengi + nadirlik süsü. Diğerleri sade. */
export function itemIconSvg(item: ItemDef, size = 40): string {
  let body: string;
  let back = '';
  let front = '';
  if (item.slot) {
    const palette = item.element ? ELEMENT_PALETTE[item.element] : NEUTRAL_PALETTE;
    body = shape(item.slot, palette);
    ({ back, front } = decorations(item.rarity ?? 1));
  } else if (item.heal !== undefined) {
    const potion = item.heal >= 300 ? '#a21caf' : item.heal >= 150 ? '#dc2626' : '#f87171';
    body = `<path d="M20 6 L28 6 L28 16 L36 36 Q38 42 32 42 L16 42 Q10 42 12 36 L20 16 Z" fill="${potion}" stroke="#450a0a" stroke-width="1.6" stroke-linejoin="round"/><rect x="19" y="3" width="10" height="5" rx="1.5" fill="#a16207" stroke="#451a03" stroke-width="1.2"/><path d="M15 33 L33 33" stroke="#fecaca" stroke-width="2" opacity="0.7"/>`;
  } else {
    body = `<path d="M24 5 L40 20 L24 43 L8 20 Z" fill="#94a3b8" stroke="#1e293b" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 20 L40 20 M24 5 L18 20 L24 43 L30 20 Z" stroke="#e2e8f0" stroke-width="1" fill="none"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}" role="img" aria-label="${item.name.replace(/"/g, '')}" data-icon="${item.id}">${back}${body}${front}</svg>`;
}
