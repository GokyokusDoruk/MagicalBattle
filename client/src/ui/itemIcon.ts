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
    case 'gloves':
      return `<path d="M14 40 L14 24 L18 24 L18 13 Q18 10 20.5 10 Q23 10 23 13 L23 21 L24.5 21 L24.5 8 Q24.5 5.5 27 5.5 Q29.5 5.5 29.5 8 L29.5 21 L31 21 L31 11 Q31 8.5 33.5 8.5 Q36 8.5 36 11 L36 24 L37.5 24 L37.5 17 Q37.5 14.5 40 14.5 Q42.5 14.5 42.5 17 L42.5 30 Q42.5 38 34 40 Z" fill="${p.main}" ${stroke}/>
        <rect x="12" y="37" width="26" height="7" rx="2" fill="${p.dark}" ${stroke}/><path d="M20 28 L36 28" stroke="${p.light}" stroke-width="1.4" opacity="0.7"/>`;
    case 'bracelet':
      return `<ellipse cx="24" cy="27" rx="15" ry="10" fill="none" stroke="${p.dark}" stroke-width="8"/><ellipse cx="24" cy="27" rx="15" ry="10" fill="none" stroke="${p.main}" stroke-width="5.2"/>
        <circle cx="24" cy="17.5" r="4.4" fill="${p.light}" ${stroke}/><circle cx="12" cy="31" r="2" fill="${p.light}"/><circle cx="36" cy="31" r="2" fill="${p.light}"/>`;
    case 'necklace':
      return `<path d="M8 9 Q24 44 40 9" fill="none" stroke="${p.dark}" stroke-width="3.6" stroke-linecap="round"/><path d="M8 9 Q24 44 40 9" fill="none" stroke="${p.main}" stroke-width="1.9" stroke-linecap="round" stroke-dasharray="3 2"/>
        <path d="M24 28 L31 36 L24 45 L17 36 Z" fill="${p.light}" ${stroke}/><path d="M24 28 L24 45 M17 36 L31 36" stroke="${p.main}" stroke-width="1"/>`;
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

/** Elementin sembolü (köşe rozeti içinde, 0,0 merkezli ~12x12): ateş alevi, su damlası, toprak dağı, hava girdabı. */
function elementGlyph(element: Element, color: string): string {
  switch (element) {
    case 'fire':
      return `<path d="M0 -6.2 C3 -2.4 5 0 5 3 A5 5 0 0 1 -5 3 C-5 0.6 -2.6 -1.6 -1.4 -4 C-0.6 -2.6 0 -2 0.6 -1.6 C0.8 -3 0.6 -4.6 0 -6.2 Z" fill="${color}"/>`;
    case 'water':
      return `<path d="M0 -6.4 C4 -1.4 5.2 1.4 5.2 3.6 A5.2 5.2 0 0 1 -5.2 3.6 C-5.2 1.4 -4 -1.4 0 -6.4 Z" fill="${color}"/>`;
    case 'earth':
      return `<path d="M-6.4 5 L-2 -3 L0.6 1.4 L2.6 -1.8 L6.4 5 Z" fill="${color}"/>`;
    case 'air':
      return `<path d="M-6 -2.6 H2.4 A2.2 2.2 0 1 0 0.4 -5.6 M-6 1.4 H5 A2.2 2.2 0 1 1 3 4.6 M-6 5.4 H-0.6" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round"/>`;
  }
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
    // Çerçeve her zaman nadirlik renginde; köşede elementin sembolü
    const rarityColor = RARITY_COLORS[(item.rarity ?? 1) as 1];
    front += `<rect x="1.4" y="1.4" width="45.2" height="45.2" rx="8" fill="none" stroke="${rarityColor}" stroke-width="2.8" data-frame="${item.rarity ?? 1}"/>`;
    if (item.element) front += `<g transform="translate(38 38)" data-element="${item.element}"><circle r="8" fill="#0f172a" fill-opacity="0.88" stroke="${ELEMENT_PALETTE[item.element].main}" stroke-width="1.2"/>${elementGlyph(item.element, ELEMENT_PALETTE[item.element].main)}</g>`;
  } else if (item.heal !== undefined) {
    const potion = item.heal >= 300 ? '#a21caf' : item.heal >= 150 ? '#dc2626' : '#f87171';
    body = `<path d="M20 6 L28 6 L28 16 L36 36 Q38 42 32 42 L16 42 Q10 42 12 36 L20 16 Z" fill="${potion}" stroke="#450a0a" stroke-width="1.6" stroke-linejoin="round"/><rect x="19" y="3" width="10" height="5" rx="1.5" fill="#a16207" stroke="#451a03" stroke-width="1.2"/><path d="M15 33 L33 33" stroke="#fecaca" stroke-width="2" opacity="0.7"/>`;
  } else {
    body = `<path d="M24 5 L40 20 L24 43 L8 20 Z" fill="#94a3b8" stroke="#1e293b" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 20 L40 20 M24 5 L18 20 L24 43 L30 20 Z" stroke="#e2e8f0" stroke-width="1" fill="none"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}" role="img" aria-label="${item.name.replace(/"/g, '')}" data-icon="${item.id}">${back}${body}${front}</svg>`;
}
