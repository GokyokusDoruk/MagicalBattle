import type { Element } from '../battle/damage/elements';
import { locationAt } from '../save/cityEntry';
import { tileAt, type WorldMap } from '../world/generateMap';
import { Tile } from '../world/tiles';
import { tierAt, type EnemySpot } from './spots';

/**
 * Bölge savaşları (Task 29): açık zeminde (çimen ve kumsal) yürürken her yeni karoda %10 şansla düşman çıkar.
 * Zemin elementi belirler: kumsal (su kenarı) → su; şehrin yakınındaki çimen o şehrin elementi (Ignis çevresi köz → ateş,
 * Abyss çevresi rüzgâr → hava, Still Crystal çevresi → su); geri kalan yeşillik → toprak. Yollar, şehir ve köy alanları güvenlidir.
 */

export const ENCOUNTER_CHANCE = 0.1;
/** Savaştan sonra karşılaşma olmayan süre (ms) */
export const GRACE_MS = 5000;
/** Şehrin elementinin çimene yayıldığı uzaklık (karo) */
export const CITY_ZONE_RADIUS = 18;

/** Bu karoda karşılaşma olabilir mi, olursa hangi elementten? Güvenli karoda null. */
export function zoneElementAt(map: WorldMap, x: number, y: number): Element | null {
  const tile = tileAt(map, x, y);
  if (tile !== Tile.Grass && tile !== Tile.Sand) return null;
  if (locationAt(map.locations, x, y) !== null) return null;
  if (tile === Tile.Sand) return 'water';
  let best: { d: number; el: Element } | null = null;
  for (const loc of map.locations) {
    if (loc.kind !== 'city') continue;
    const d = Math.hypot(loc.x - x, loc.y - y);
    if (d <= CITY_ZONE_RADIUS && (!best || d < best.d)) best = { d, el: loc.elements[0] };
  }
  return best ? best.el : 'earth';
}

/** Karşılaşma zarı ve savaş sonrası koruma süresi. */
export class EncounterGuard {
  private graceUntil = -Infinity;

  constructor(
    private readonly now: () => number,
    private readonly chance = ENCOUNTER_CHANCE,
    private readonly graceMs = GRACE_MS,
  ) {}

  /** Savaş bitti (zafer, kaçış ya da ölüm): bir süre karşılaşma olmaz. */
  startGrace(): void {
    this.graceUntil = this.now() + this.graceMs;
  }

  get inGrace(): boolean {
    return this.now() < this.graceUntil;
  }

  /** Yeni bir karoya girildi: koruma yoksa şansla true. */
  roll(rand: () => number): boolean {
    return !this.inGrace && rand() < this.chance;
  }
}

let counter = 0;

/** Bölge karşılaşmasının düşmanı (haritada sabit yeri yoktur; kimliği tek kullanımlıktır). */
export function zoneEncounter(map: WorldMap, x: number, y: number): EnemySpot | null {
  const element = zoneElementAt(map, x, y);
  if (!element) return null;
  return { id: `zone-${counter++}`, element, tier: tierAt(map, x, y), tileX: x, tileY: y };
}
