import type { ChoiceLine } from '../morality/catalog';
import { LOCATIONS, type LocationDef } from '../world/locations';

/**
 * Ölüm ve ekonomi (Task 20): bir boss savaşında yenilip pes edince altının bir kısmı kaybolur ve en yakın
 * köyün şifacısının yanında ayılırsın. Yalnızca altın gider; XP, seviye, eşya, asa ve ekipman korunur.
 * Sayılar denge için ayarlanabilir.
 */

/** Altın kaybı oranı: 1. seviyede %6, her seviyede +%1, en çok %25 (yüksek seviye daha çok kaybeder) */
export const LOSS_BASE = 0.05;
export const LOSS_PER_LEVEL = 0.01;
export const LOSS_CAP = 0.25;

export function goldLossFraction(level: number): number {
  const lvl = Math.max(1, Math.floor(level));
  return Math.min(LOSS_CAP, LOSS_BASE + LOSS_PER_LEVEL * lvl);
}

/** Kaybedilecek altın (tam sayı, eldeki altını aşmaz, negatif olmaz). */
export function goldLoss(level: number, gold: number): number {
  if (!(gold > 0)) return 0;
  return Math.min(Math.floor(gold), Math.floor(gold * goldLossFraction(level)));
}

export interface HealerDef {
  id: string;
  name: string;
  /** Şifacının bulunduğu köy (world/locations.ts kimliği) */
  locationId: string;
  /** Ayıltırken söylediği söz */
  line: string;
}

/** Her köyde bir şifacı vardır (docs/hikaye.md bölüm 3: köyler her zaman açıktır, şifacı barındırır). */
export const HEALERS: readonly HealerDef[] = [
  { id: 'sifaci-hatice', name: 'Şifacı Hatice', locationId: 'ash', line: 'Sakin ol evladım, kanyonun rüzgârı yaralarını sarar. Bu sefer daha hazırlıklı dön.' },
  { id: 'sifaci-yasemin', name: 'Şifacı Yasemin', locationId: 'vine', line: 'Asmaların gölgesinde dinlen. Yaraların kapandı, ama cesaretini kendin toplayacaksın.' },
  { id: 'sifaci-tuna', name: 'Şifacı Tuna', locationId: 'marsh', line: 'Sisin içinden seni çektik. İyileştin, yine de bir daha dikkatli ol.' },
];

export function getHealer(id: string): HealerDef | undefined {
  return HEALERS.find((h) => h.id === id);
}

export interface HealerSpot {
  healer: HealerDef;
  location: LocationDef;
  /** Ayıldığın karo: köy merkezi (yürünebilir) */
  tileX: number;
  tileY: number;
}

export function healerSpots(locations: readonly LocationDef[] = LOCATIONS): HealerSpot[] {
  return HEALERS.flatMap((healer) => {
    const location = locations.find((l) => l.id === healer.locationId);
    return location ? [{ healer, location, tileX: location.x, tileY: location.y }] : [];
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

/** Ayılma diyaloğunun satırları: ne olduğu, kaybedilen altın ve şifacının sözü. */
export function respawnLines(spot: HealerSpot, lost: number, level: number): ChoiceLine[] {
  const loss =
    lost > 0
      ? `Yenilgi seni yordu. Baygınken ${lost} altın kaybettin (seviyene göre altınının %${Math.round(goldLossFraction(level) * 100)}'i).`
      : 'Yenilgi seni yordu, ama kaybedecek altının yoktu.';
  return [
    { speaker: 'Anlatıcı', text: `Gözlerini ${spot.location.name} köyünde açtın.` },
    { speaker: 'Anlatıcı', text: loss },
    { speaker: spot.healer.name, text: spot.healer.line },
  ];
}
