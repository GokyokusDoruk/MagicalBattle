import type { ChoiceLine } from '../morality/catalog';
import { LOCATIONS, approachTile, type LocationDef } from '../world/locations';
import { CURRENCY_NAMES, type Currency } from './currency';
import { MERCHANTS } from './merchants';

/**
 * Ölüm ve ekonomi (Task 20, Task 55): bir savaşta yenilince bulunduğun bölgenin para biriminden bir kısmı kaybolur ve en yakın
 * şehrin hancısının yanında ayılırsın. Yalnızca o birimden para gider; XP, seviye, eşya, asa ve ekipman korunur.
 * Sayılar denge için ayarlanabilir.
 */

/** Para kaybı oranı: 1. seviyede %6, her seviyede +%1, en çok %25 (yüksek seviye daha çok kaybeder) */
export const LOSS_BASE = 0.05;
export const LOSS_PER_LEVEL = 0.01;
export const LOSS_CAP = 0.25;

export function moneyLossFraction(level: number): number {
  const lvl = Math.max(1, Math.floor(level));
  return Math.min(LOSS_CAP, LOSS_BASE + LOSS_PER_LEVEL * lvl);
}

/** Kaybedilecek para (tam sayı, o birimdeki bakiyeyi aşmaz, negatif olmaz). */
export function moneyLoss(level: number, balance: number): number {
  if (!(balance > 0)) return 0;
  return Math.min(Math.floor(balance), Math.floor(balance * moneyLossFraction(level)));
}

export interface HealerDef {
  id: string;
  name: string;
  /** Şifacının bulunduğu şehir (world/locations.ts kimliği) */
  locationId: string;
  /** Ayıltırken söylediği söz */
  line: string;
}

/** Şehir hancısının ayılan oyuncuya söylediği söz (şehre göre) */
const CITY_LINES: Record<string, string> = {
  ignis: 'Ateşin başında otur, yaraların sarılsın. Bu sefer daha hazırlıklı dön.',
  abyss: 'Rüzgâr yaralarını üfledi. Bu sefer daha dikkatli ol.',
  'stone-heart': 'Taş duvarlar seni korudu. Güçlenip dön.',
  'still-crystal': 'Durgun suyun sesiyle iyileştin. Acele etme.',
};

/** Savaşta yenilince en yakın **şehrin** hancısının yanında ayılırsın (Task 55): her şehir hancısı bir şifacıdır. */
export const HEALERS: readonly HealerDef[] = MERCHANTS.filter((m) => m.kind === 'innkeeper').map((m) => ({
  id: m.id,
  name: m.name,
  locationId: m.locationId,
  line: CITY_LINES[m.locationId] ?? 'Yaraların sarıldı. Dikkatli ol.',
}));

export function getHealer(id: string): HealerDef | undefined {
  return HEALERS.find((h) => h.id === id);
}

export interface HealerSpot {
  healer: HealerDef;
  location: LocationDef;
  /** Ayıldığın karo: şehrin kapısının önü (ana görev işaretinin durduğu yürünebilir karo) */
  tileX: number;
  tileY: number;
}

export function healerSpots(locations: readonly LocationDef[] = LOCATIONS): HealerSpot[] {
  return HEALERS.flatMap((healer) => {
    const location = locations.find((l) => l.id === healer.locationId);
    if (!location) return [];
    const at = approachTile(location);
    return [{ healer, location, tileX: at.x, tileY: at.y }];
  });
}

/** Verilen karoya en yakın şifacı; eşitlikte listedeki ilk. Şifacı yoksa null. */
export function nearestHealer(tileX: number, tileY: number, spots: readonly HealerSpot[] = healerSpots()): HealerSpot | null {
  let best: HealerSpot | null = null;
  let bestDist = Infinity;
  for (const s of spots) {
    const d = (s.tileX - tileX) ** 2 + (s.tileY - tileY) ** 2;
    if (d < bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}

/** Ayılma diyaloğunun satırları: ne olduğu, kaybedilen para ve şifacının sözü. */
export function respawnLines(spot: HealerSpot, lost: number, level: number, currency: Currency = 'kor'): ChoiceLine[] {
  const loss =
    lost > 0
      ? `Yenilgi seni yordu. Baygınken ${lost} ${CURRENCY_NAMES[currency]} kaybettin (seviyene göre bulunduğun bölgenin parasının %${Math.round(moneyLossFraction(level) * 100)}'i).`
      : 'Yenilgi seni yordu, ama kaybedecek paran yoktu.';
  return [
    { speaker: 'Anlatıcı', text: `Gözlerini ${spot.location.name} kapısında, hancının yanında açtın.` },
    { speaker: 'Anlatıcı', text: loss },
    { speaker: spot.healer.name, text: spot.healer.line },
  ];
}
