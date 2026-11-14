import type { Element } from '../battle/damage/elements';
import { locationAt } from '../save/cityEntry';
import { tileAt, type WorldMap } from '../world/generateMap';
import { Tile } from '../world/tiles';
import { tierAt, type EnemySpot } from './spots';

/**
 * Bölge savaşları (Task 29, Task 40'ta çalılığa taşındı): **yalnızca çalılıkta** yürürken her yeni karoda %10 şansla düşman
 * çıkar. Düşmanın elementi çalılığa en yakın şehrin elementidir (Ignis çevresi ateş, Abyss hava, Stone Heart toprak, Still
 * Crystal su). Çimen, kumsal, yol, şehir ve köy alanları güvenlidir; çalılıktan kaçınarak huzurla yürünebilir.
 */

export const ENCOUNTER_CHANCE = 0.1;
/** Savaştan sonra karşılaşma olmayan süre (ms) */
export const GRACE_MS = 5000;
/** Bu karoda karşılaşma olabilir mi, olursa hangi elementten? Çalılık dışında her yer güvenlidir (null). */
export function zoneElementAt(map: WorldMap, x: number, y: number): Element | null {
  if (tileAt(map, x, y) !== Tile.Thicket) return null;
  if (locationAt(map.locations, x, y) !== null) return null;
  let best: { d: number; el: Element } | null = null;
  for (const loc of map.locations) {
    if (loc.kind !== 'city') continue;
    const d = Math.hypot(loc.x - x, loc.y - y);
    if (!best || d < best.d) best = { d, el: loc.elements[0] };
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
